import os
import logging
import requests

from django.contrib.auth import get_user_model
from django.db import transaction, IntegrityError, models

from apps.authentication.models.profiles import OrganizationalProfile
from apps.master_data.models import (
    DepartmentMaster, DesignationMaster, GradeMaster,
    LocationMaster, CityMaster, StateMaster, CountryMaster,
    CompanyInformation
)
try:
    import dotenv
except ImportError:
    dotenv = None

logger = logging.getLogger('sso_auth')
User = get_user_model()


class HRMSSyncService:
    """
    Synchronizes HRMS employee data into the local system.
    HRMS remains the source of truth for employee and reporting hierarchy.
    """

    # BASE_URL = os.getenv('HRMS_API_BASE_URL', 'http://192.168.1.251:8583')
    BASE_URL = os.getenv('HRMS_API_BASE_URL', 'https://hrms.orangetechnolab.com:8598')
    ENV_FILE_PATH = os.getenv("HRMS_ENV_PATH", ".env.prod")

    # ------------------------------------------------------------------
    # HTTP helpers
    # ------------------------------------------------------------------

    @classmethod
    def _get_headers(cls):
        token = os.getenv("HRMS_API_TOKEN")
        if not token:
            raise RuntimeError("HRMS_API_TOKEN is missing")

        return {
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

    # ------------------------------------------------------------------
    # [DORMANT] New Auth Resolver Logic
    # ------------------------------------------------------------------

    @classmethod
    def _regenerate_hrms_token(cls) -> str | None:
        """
        Calls HRMS API to generate a new token and persists it to the env file.
        Requires HRMS_API_USERNAME and HRMS_API_PASSWORD in environment.
        """
        username = os.getenv("HRMS_API_USERNAME")
        password = os.getenv("HRMS_API_PASSWORD")

        if not username or not password:
            logger.error("HRMS token regeneration failed: Credentials missing in environment")
            return None

        url = f"{cls.BASE_URL}/api/Account/GenerateToken"
        params = {"UserName": username, "Password": password}

        try:
            logger.info(f"HRMS: Attempting token regeneration for user={username}")
            resp = requests.get(url, params=params, timeout=15)
            resp.raise_for_status()
            
            # Assuming API returns {"data": "new_token_string", ...} or similar based on user description
            # Adjusting based on standard pattern: retrieve token from response
            res_data = resp.json()
            new_token = res_data.get("data")

            if not new_token:
                logger.error(f"HRMS: Regeneration API responded but 'data' (token) is missing: {res_data}")
                return None

            # 1. Update current process memory
            os.environ["HRMS_API_TOKEN"] = new_token
            logger.info("HRMS: New token applied to current process memory.")

            # 2. Persist to .env file for future reboots/processes
            if dotenv:
                try:
                    dotenv.set_key(cls.ENV_FILE_PATH, "HRMS_API_TOKEN", new_token)
                    logger.info(f"HRMS: Token persisted successfully to {cls.ENV_FILE_PATH}")
                except Exception as env_err:
                    logger.warning(f"HRMS: Token updated in memory but persistence to {cls.ENV_FILE_PATH} failed: {env_err}")
            else:
                logger.warning("HRMS: python-dotenv not installed. Skipping file persistence.")

            return new_token

        except Exception as exc:
            logger.error(f"HRMS: Token regeneration API call failed: {exc}")
            return None

    @classmethod
    def _make_hrms_request(cls, method: str, url: str, **kwargs) -> requests.Response:
        """
        Unified request wrapper with 401 detection and single auto-retry.
        """
        # Ensure headers include the latest token
        headers = cls._get_headers()
        kwargs['headers'] = headers

        # Step 1: Initial Attempt
        response = requests.request(method, url, **kwargs)

        # Step 2: Detection of expiry (401)
        if response.status_code == 401:
            logger.info("HRMS: Received 401 Unauthorized. Attempting token regeneration...")
            new_token = cls._regenerate_hrms_token()
            
            if new_token:
                # Step 3: Single Retry with NEW token
                logger.info("HRMS: Retrying original request with new token.")
                # Refresh headers for the retry
                kwargs['headers'] = cls._get_headers()
                return requests.request(method, url, **kwargs)
            else:
                logger.error("HRMS: Token regeneration failed. Cannot retry request.")

        return response

    # ------------------------------------------------------------------
    # HRMS API calls
    # ------------------------------------------------------------------

    @classmethod
    def fetch_employee_data(cls, emp_id: str, company_id: str) -> dict | None:
        url = f"{cls.BASE_URL}/api/Employee/GetAllEmployees"
        params = {"cmpId": company_id, "empId": emp_id}

        try:
            # --- [FUTURE LINKER] ---
            # To enable auto-token-regeneration, replace the next 2 lines with:
            resp = cls._make_hrms_request("GET", url, params=params, timeout=10)
            # resp = requests.get(url, params=params, headers=cls._get_headers(), timeout=10)
            resp.raise_for_status()
            
            records = resp.json().get("data", {}).get("data", [])
            return records[0] if records else None
        except Exception as exc:
            logger.error(f"HRMS fetch failed (emp_id={emp_id}): {exc}")
            return None

    @classmethod
    def fetch_employee_by_hrms_id(cls, hrms_emp_id: int, company_id: str) -> dict | None:
        return cls.fetch_employee_data(str(hrms_emp_id), company_id)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    @classmethod
    def _safe_get_or_create(cls, model_class, lookup_fields, defaults=None):
        """
        Attempts to fetch a record; creates it if missing.
        Handles race conditions where a parallel request creates the record
        between the get and create steps.
        """
        defaults = defaults or {}
        
        # 1. Try to fetch existing
        try:
            return model_class.objects.get(**lookup_fields), False
        except model_class.DoesNotExist:
            pass

        # 2. Attempt creation
        try:
            with transaction.atomic():
                return model_class.objects.create(**lookup_fields, **defaults), True
        except IntegrityError:
            # Race condition hit: record was created by another process
            return model_class.objects.get(**lookup_fields), False

    @classmethod
    def _ensure_grade(cls, grade_name):
        if not grade_name:
            return None
            
        # Check existence first to avoid expensive aggregation query
        grade = GradeMaster.objects.filter(name=grade_name).first()
        if grade:
            return grade

        # Calculate next sorting number
        # Note: A tiny race condition exists here for sorting_no uniqueness, 
        # but safely handled for name uniqueness via _safe_get_or_create
        max_no = GradeMaster.objects.aggregate(models.Max('sorting_no'))['sorting_no__max']
        next_sorting_no = (max_no or 100) + 1
        
        grade, _ = cls._safe_get_or_create(
            GradeMaster,
            lookup_fields={'name': grade_name},
            defaults={
                'sorting_no': next_sorting_no,
                'is_active': True
            }
        )
        return grade

    @classmethod
    def sync_user(cls, emp_id: str, company_id: str, *, _depth: int = 0) -> User | None:
        """
        Syncs a single HRMS employee.
        Depth guard ensures only employee + direct manager are synced.
        """
        if _depth > 1:
            return None

        data = cls.fetch_employee_data(emp_id, company_id)
        if not data:
            return None

        hrms_id = data.get("Employee_ID")
        username = cls._resolve_username(data)
        email = data.get("Work_Email") or ""
        
        # Use direct fields for names if available, else fallback
        first_name = (data.get("Emp_First_Name") or "").strip()
        last_name = (data.get("Emp_Last_Name") or "").strip()
        
        if not first_name:
            full_name = data.get("Name", "").strip()
            first_name, last_name = cls._split_name(full_name)

        is_active = (data.get("Emp_Status") or "").lower() == "active"

        with transaction.atomic():

            user, created = User.objects.get_or_create(
                hrms_id=hrms_id,
                defaults={
                    "username": username,
                    "email": email,
                    "first_name": first_name,
                    "last_name": last_name,
                    "mobile_no": data.get("Mobile_No"),
                    "gender": cls._map_gender(data.get("Gender")),
                    "date_of_birth": cls._parse_date(data.get("Date_Of_Birth")),
                    "is_active": is_active,
                },
            )

            if not created:
                user.username = username
                user.email = email
                user.first_name = first_name
                user.last_name = last_name
                user.mobile_no = data.get("Mobile_No")
                user.gender = cls._map_gender(data.get("Gender"))
                user.date_of_birth = cls._parse_date(data.get("Date_Of_Birth"))
                user.is_active = is_active
                user.save(update_fields=[
                    "username", "email", "first_name",
                    "last_name", "mobile_no", "gender", "date_of_birth", "is_active"
                ])

            company, _ = cls._safe_get_or_create(
                CompanyInformation,
                lookup_fields={'name': "Tata Steel Foundation"}
            )

            # --- Sync Master Data ---
            
            dept_name = (data.get("Department") or "").strip()
            # Generate code using acronyms (no uniqueness constraint now)
            dept_code = cls._generate_acronym(dept_name)
            
            department, _ = cls._safe_get_or_create(
                DepartmentMaster,
                lookup_fields={'dept_name': dept_name, 'company': company},
                defaults={'dept_code': dept_code}
            )

            desig_name = (data.get("Designation") or "").strip()
            desig_code = cls._generate_acronym(desig_name)
            
            designation, _ = cls._safe_get_or_create(
                DesignationMaster,
                lookup_fields={'designation_name': desig_name, 'department': department},
                defaults={'designation_code': desig_code}
            )

            grade_name = (data.get("Grade") or "").strip()
            grade = cls._ensure_grade(grade_name)

            location = cls._sync_location(data, company)

            profile, _ = OrganizationalProfile.objects.get_or_create(user=user)
            profile.employee_id = data.get("Alpha_Emp_Code")
            profile.employee_code = data.get("Alpha_Emp_Code")
            profile.company = company
            profile.department = department
            profile.designation = designation
            profile.grade = grade
            profile.base_location = location

            rm_emp_id = data.get("RM_Emp_id")
            if rm_emp_id:
                manager = User.objects.filter(hrms_id=rm_emp_id).first()
                
                if not manager:
                    rm_data = cls.fetch_employee_by_hrms_id(rm_emp_id, company_id)
                    if rm_data:
                        manager = cls.sync_user(
                            emp_id=str(rm_data.get("Employee_ID")),
                            company_id=company_id,
                            _depth=_depth + 1
                        )
                
                if manager:
                    profile.reporting_manager = manager

            profile.save()

        logger.info(
            f"HRMS sync completed | hrms_id={hrms_id} | email={email}"
        )
        return user

    # ------------------------------------------------------------------
    # Utilities
    # ------------------------------------------------------------------

    @staticmethod
    def _resolve_username(data: dict) -> str:
        if data.get("Alpha_Emp_Code"):
            return f"{data['Alpha_Emp_Code'].strip().lower()}@tsf.com"
        if data.get("Employee_ID"):
            return f"{data['Employee_ID']}_hrms@tsf.com"
        return ""

    @staticmethod
    def _split_name(full_name: str) -> tuple[str, str]:
        parts = full_name.split(" ", 1)
        return parts[0], parts[1] if len(parts) > 1 else ""

    @staticmethod
    def _map_gender(value: str | None) -> str:
        if not value:
            return "N"
        value = value.lower()
        if value == "male":
            return "M"
        if value == "female":
            return "F"
        return "N"

    @staticmethod
    def _parse_date(date_str: str | None) -> str | None:
        if not date_str:
            return None
        # HRMS might return "1990-01-01" or "01-01-1990" or "1990-01-01T00:00:00"
        # We try to handle common formats or at least take the date part
        try:
            if "T" in date_str:
                return date_str.split("T")[0]
            return date_str
        except Exception:
            return None

    @staticmethod
    def _safe_code(value: str | None, length: int = 10) -> str:
        return (value or "")[:length].upper()

    @staticmethod
    def _generate_acronym(text: str) -> str:
        """
        Generates acronym from the first letter of each word.
        Example: "Assistant Manager" -> "AM"
        """
        if not text:
            return ""
        # Filter out empty strings from split and take first char of each word
        acronym = "".join(word[0].upper() for word in text.split() if word)
        return acronym[:50]  # Ensure it fits in db field

    @classmethod
    def _sync_location(cls, data: dict, company):
        branch_name = data.get("Branch")
        branch_city = data.get("Branch_City")
        branch_state = data.get("Branch_State")
        branch_address = data.get("Branch_Address", "")
        
        if not branch_name:
            return None
        
        # 1. Try to fetch existing location first (fast path)
        existing_location = LocationMaster.objects.filter(
            location_name=branch_name,
            company=company
        ).first()
        
        if existing_location:
            return existing_location
        
        cleaned_city = (branch_city or "").strip()
        cleaned_state = (branch_state or "Jharkhand").strip()
        
        # 2. Safe sync for dependencies
        country, _ = cls._safe_get_or_create(
            CountryMaster,
            lookup_fields={'country_name': "India"},
            defaults={'country_code': "IND"}
        )
        
        state, _ = cls._safe_get_or_create(
            StateMaster,
            lookup_fields={'state_name': cleaned_state, 'country': country}
        )
        
        city, _ = cls._safe_get_or_create(
            CityMaster,
            lookup_fields={'city_name': cleaned_city, 'state': state},
            defaults={'category_id': 2}
        )
        
        # Ensure correct hierarchy if fetched
        state = city.state
        country = state.country if state else None
        
        location_code = f"{cls._safe_code(branch_name, 20)}-{cls._safe_code(branch_city, 10)}"
        
        # 3. Finally, safe create location
        location, _ = cls._safe_get_or_create(
            LocationMaster,
            lookup_fields={
                'location_name': branch_name,
                'company': company
            },
            defaults={
                'location_code': location_code,
                'city': city,
                'state': state,
                'country': country,
                'address': branch_address,
                'is_active': True
            }
        )
        return location
