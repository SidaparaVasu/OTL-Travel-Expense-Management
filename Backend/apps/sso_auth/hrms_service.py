import os
import logging
import requests
from django.contrib.auth import get_user_model
from apps.authentication.models.profiles import OrganizationalProfile
from apps.master_data.models import (
    DepartmentMaster, DesignationMaster, GradeMaster,
    LocationMaster, CityMaster, StateMaster, CountryMaster,
    CompanyInformation
)

logger = logging.getLogger('sso_auth')
User = get_user_model()


class HRMSSyncService:
    """
    Service to synchronize HRMS employee data into the system.
    All company context is derived dynamically from SSO token.
    """

    BASE_URL = os.getenv(
        'HRMS_API_BASE_URL',
        'http://192.168.1.251:8583'
    )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @classmethod
    def _get_headers(cls):
        token = os.getenv("HRMS_API_TOKEN")
        if not token:
            raise RuntimeError("HRMS_API_TOKEN is missing in environment")

        return {
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

    @staticmethod
    def _resolve_username(data: dict) -> str:
        """
        Resolve a deterministic, unique username for HRMS users.
        Priority:
        1. Work_Email
        2. Alpha_Emp_Code
        3. hrms_<Employee_ID>
        """
        if data.get("Work_Email"):
            return data["Work_Email"].strip().lower()

        if data.get("Alpha_Emp_Code"):
            return f"{data['Alpha_Emp_Code'].strip().lower()}@hrms"

        if data.get("Employee_ID"):
            return f"hrms_{data['Employee_ID']}"

        return ""

    # ------------------------------------------------------------------
    # HRMS API calls
    # ------------------------------------------------------------------

    @classmethod
    def fetch_employee_data(cls, emp_id: str, company_id: str) -> dict | None:
        """
        Fetch employee data from HRMS for given employee & company.
        """
        url = f"{cls.BASE_URL}/api/Employee/GetAllEmployees"
        params = {
            "cmpId": company_id,
            "empId": emp_id,
        }

        try:
            response = requests.get(
                url,
                params=params,
                headers=cls._get_headers(),
                timeout=10
            )
            response.raise_for_status()

            payload = response.json()
            records = payload.get("data", {}).get("data", [])

            return records[0] if records else None

        except Exception as exc:
            logger.error(
                f"HRMS fetch failed (emp_id={emp_id}, company_id={company_id}): {exc}"
            )
            return None

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    @classmethod
    def sync_user(cls, emp_id: str, company_id: str) -> User | None:
        """
        Sync HRMS employee into local system using dynamic company context.
        """
        data = cls.fetch_employee_data(emp_id, company_id)
        if not data:
            return None

        hrms_id = data.get("Employee_ID")
        username = cls._resolve_username(data)
        email = data.get('Work_Email') or ""
        full_name = data.get("Name", "").strip()

        logger.info(
            f"Syncing HRMS User: {full_name} "
            f"(HRMS_ID={hrms_id}, Email={email}, Company={company_id})"
        )

        # --------------------------------------------------------------
        # User creation / update
        # --------------------------------------------------------------

        first_name, last_name = cls._split_name(full_name)

        emp_status = (data.get("Emp_Status") or "").strip().lower()
        is_active = emp_status == "active"

        user, created = User.objects.get_or_create(
            hrms_id=hrms_id,
            defaults={
                'username': username,
                'email': email,
                'first_name': first_name,
                'last_name': last_name,
                'mobile_no': data.get('Mobile_No'),
                'gender': cls._map_gender(data.get('Gender')),
                'is_active': is_active,
            }
        )

        if not created:
            user.username = username
            user.email = email
            user.first_name = first_name
            user.last_name = last_name
            user.mobile_no = data.get("Mobile_No")
            user.is_active = is_active
            user.save()

        # --------------------------------------------------------------
        # Company & Masters
        # --------------------------------------------------------------

        company, _ = CompanyInformation.objects.get_or_create(
            id=company_id,
            defaults={"name": f"Company-{company_id}"}
        )

        department, _ = DepartmentMaster.objects.get_or_create(
            dept_name=data.get("Department"),
            company=company,
            defaults={"dept_code": cls._safe_code(data.get("Department"))},
        )

        designation, _ = DesignationMaster.objects.get_or_create(
            designation_name=data.get("Designation"),
            defaults={"designation_code": cls._safe_code(data.get("Designation"))},
        )

        grade, _ = GradeMaster.objects.get_or_create(
            name=data.get("Grade"),
            defaults={"sorting_no": 99, "is_active": True},
        )

        location = cls._sync_location(data, company)

        # --------------------------------------------------------------
        # Profile
        # --------------------------------------------------------------

        profile, _ = OrganizationalProfile.objects.get_or_create(user=user)
        profile.employee_id = hrms_id
        profile.employee_code = data.get("Alpha_Emp_Code")
        profile.company = company
        profile.department = department
        profile.designation = designation
        profile.grade = grade
        profile.base_location = location

        manager_name = data.get("Reporting_Manager_Name")
        if manager_name:
            manager = cls._resolve_manager(manager_name)
            if manager:
                profile.reporting_manager = manager

        profile.save()

        logger.info(
            f"Profile synced for {email} | "
            f"Dept={department.dept_name}, "
            f"Desig={designation.designation_name}, "
            f"Grade={grade.name}, "
            f"Location={location.location_name}"
        )

        return user

    # ------------------------------------------------------------------
    # Utility methods
    # ------------------------------------------------------------------

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
    def _safe_code(value: str | None, length: int = 10) -> str:
        if not value:
            return ""
        return value[:length].upper()

    @classmethod
    def _sync_location(cls, data: dict, company):
        """
        Sync branch / city / state / country dynamically.
        """
        country, _ = CountryMaster.objects.get_or_create(
            country_name="India",
            defaults={"country_code": "IND"},
        )

        state, _ = StateMaster.objects.get_or_create(
            state_name="Jharkhand",
            country=country,
        )

        city, _ = CityMaster.objects.get_or_create(
            city_name=data.get("Branch_City"),
            state=state,
            defaults={"category_id": 1},
        )

        location, _ = LocationMaster.objects.get_or_create(
            location_name=data.get("Branch"),
            company=company,
            defaults={
                "location_code": cls._safe_code(data.get("Branch")),
                "city": city,
                "state": state,
                "country": country,
                "address": data.get("Branch_Address", ""),
            },
        )

        return location

    @staticmethod
    def _resolve_manager(name: str):
        """
        Resolve reporting manager by name (best-effort).
        """
        return User.objects.filter(
            first_name__icontains=name.split(" ")[0]
        ).first()
