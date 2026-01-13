import os
import logging
import requests

from django.contrib.auth import get_user_model
from django.db import transaction

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
    Synchronizes HRMS employee data into the local system.
    HRMS remains the source of truth for employee and reporting hierarchy.
    """

    # BASE_URL = os.getenv('HRMS_API_BASE_URL', 'http://192.168.1.251:8583')
    BASE_URL = os.getenv('HRMS_API_BASE_URL', 'https://hrms.orangetechnolab.com:8598')

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
    # HRMS API calls
    # ------------------------------------------------------------------

    @classmethod
    def fetch_employee_data(cls, emp_id: str, company_id: str) -> dict | None:
        url = f"{cls.BASE_URL}/api/Employee/GetAllEmployees"
        params = {"cmpId": company_id, "empId": emp_id}

        try:
            resp = requests.get(url, params=params, headers=cls._get_headers(), timeout=10)
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
                    "is_active": is_active,
                },
            )

            if not created:
                user.username = username
                user.email = email
                user.first_name = first_name
                user.last_name = last_name
                user.mobile_no = data.get("Mobile_No")
                user.is_active = is_active
                user.save(update_fields=[
                    "username", "email", "first_name",
                    "last_name", "mobile_no", "is_active"
                ])

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

            grade = GradeMaster.objects.filter(name=data.get("Grade")).first()
            if not grade:
                max_no = GradeMaster.objects.values_list("sorting_no", flat=True)
                grade = GradeMaster.objects.create(
                    name=data.get("Grade"),
                    sorting_no=(max(max_no) if max_no else 100) + 1,
                    is_active=True,
                )

            location = cls._sync_location(data, company)

            profile, _ = OrganizationalProfile.objects.get_or_create(user=user)
            profile.employee_id = hrms_id
            profile.employee_code = data.get("Alpha_Emp_Code")
            profile.company = company
            profile.department = department
            profile.designation = designation
            profile.grade = grade
            profile.base_location = location

            rm_emp_id = data.get("RM_Emp_id")
            if rm_emp_id:
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
            return f"{data['Alpha_Emp_Code'].strip().lower()}@hrms"
        if data.get("Work_Email"):
            return data["Work_Email"].strip().lower()
        if data.get("Employee_ID"):
            return f"hrms_{data['Employee_ID']}"
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
    def _safe_code(value: str | None, length: int = 10) -> str:
        return (value or "")[:length].upper()

    @classmethod
    def _sync_location(cls, data: dict, company):
        location_name = data.get("Branch")
        location_code = cls._safe_code(location_name)

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

        location = LocationMaster.objects.filter(
            location_name=location_name,
            company=company
        ).first()

        if location:
            return location

        location = LocationMaster.objects.filter(
            location_code=location_code
        ).first()

        if location:
            return location

        return LocationMaster.objects.create(
            location_name=location_name,
            company=company,
            location_code=location_code,
            city=city,
            state=state,
            country=country,
            address=data.get("Branch_Address", ""),
        )
