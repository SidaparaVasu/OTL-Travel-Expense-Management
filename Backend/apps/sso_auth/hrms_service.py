import requests
import logging
from django.conf import settings
from django.contrib.auth import get_user_model
from apps.authentication.models.profiles import OrganizationalProfile
from apps.master_data.models import (
    DepartmentMaster, DesignationMaster, GradeMaster, 
    LocationMaster, CityMaster, StateMaster, CountryMaster,
    CompanyInformation, EmployeeTypeMaster
)
import os

logger = logging.getLogger('sso_auth')
User = get_user_model()

class HRMSSyncService:
    """
    Service to synchronize data from HRMS API
    """
    BASE_URL = os.getenv(
        'HRMS_API_BASE_URL',
        'http://192.168.1.251:8583'
    )
    COMPANY_ID = 2  # Default as per user request

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
    
    @classmethod
    def fetch_employee_data(cls, hrms_id):
        """Fetch full employee details from HRMS API"""
        url = f"{cls.BASE_URL}/api/Employee/GetAllEmployees"
        params = {'cmpId': cls.COMPANY_ID, 'empId': hrms_id}
        
        try:
            response = requests.get(url, params=params, timeout=10, headers=cls._get_headers())
            response.raise_for_status()
            result = response.json()
            
            if result.get('status') and result.get('data', {}).get('data'):
                return result['data']['data'][0]
            
            logger.warning(f"HRMS API returned no data for Employee ID: {hrms_id}")
            logger.debug(f"HRMS Request URL: {response.request.url}")
            logger.debug(f"HRMS Request Headers: {response.request.headers}")
            logger.debug(f"HRMS Response Status Code: {response.status_code}")
            logger.debug(f"HRMS Response Content: {response.content}")
            return None
        except Exception as e:
            logger.error(f"Failed to fetch HRMS data for ID {hrms_id}: {str(e)}")
            return None

    @classmethod
    def sync_user(cls, hrms_id_or_data):
        """
        Synchronize a user and their profile from HRMS data.
        If hrms_id_or_data is an ID, it fetches data first.
        """
        if isinstance(hrms_id_or_data, (int, str)):
            data = cls.fetch_employee_data(hrms_id_or_data)
        else:
            data = hrms_id_or_data

        if not data:
            return None

        hrms_id = data.get('Employee_ID')
        email = data.get('Work_Email')
        full_name = data.get('Name', '')
        
        logger.info(f"Syncing HRMS User: {full_name} (ID: {hrms_id}, Email: {email})")
        logger.debug(f"Raw HRMS Data: {data}")

        # Split Name
        name_parts = full_name.split(' ', 1)
        first_name = name_parts[0]
        last_name = name_parts[1] if len(name_parts) > 1 else ""

        # Find or Create User
        user, created = User.objects.get_or_create(
            hrms_id=hrms_id,
            defaults={
                'username': email,
                'email': email,
                'first_name': first_name,
                'last_name': last_name,
                'gender': 'M' if data.get('Gender') == 'Male' else 'F' if data.get('Gender') == 'Female' else 'N',
                'mobile_no': data.get('Mobile_No'),
                'is_active': data.get('Emp_Status') == 'Active',
            }
        )

        if not created:
            # Update existing user
            user.email = email
            user.username = email
            user.first_name = first_name
            user.last_name = last_name
            user.mobile_no = data.get('Mobile_No')
            user.is_active = data.get('Emp_Status') == 'Active'
            user.save()

        # Sync Master Data
        company, _ = CompanyInformation.objects.get_or_create(pk=cls.COMPANY_ID, defaults={'name': 'TSF'})
        
        dept, _ = DepartmentMaster.objects.get_or_create(
            dept_name=data.get('Department'),
            company=company,
            defaults={'dept_code': data.get('Department')[:10].upper()} # Safe fallback
        )
        
        desig, _ = DesignationMaster.objects.get_or_create(
            designation_name=data.get('Designation'),
            defaults={'designation_code': data.get('Designation')[:10].upper()}
        )
        
        grade, _ = GradeMaster.objects.get_or_create(
            name=data.get('Grade'),
            defaults={'sorting_no': 99, 'is_active': True} # Default sorting
        )

        # Sync Location (Branch)
        location = cls._sync_location(data, company)

        # Update Profille
        profile, _ = OrganizationalProfile.objects.get_or_create(user=user)
        profile.employee_id = data.get('Employee_ID') # Ensure this is also populated
        profile.employee_code = data.get('Alpha_Emp_Code')
        profile.company = company
        profile.department = dept
        profile.designation = desig
        profile.grade = grade
        profile.base_location = location
        
        logger.info(f"Profile updated for {user.username}: Dept={dept}, Desig={desig}, Grade={grade}, Branch={location}")
        
        # Sync Manager Recursive Loop
        manager_name = data.get('Reporting_Manager_Name')
        if manager_name:
            manager = cls._resolve_manager(manager_name)
            if manager:
                profile.reporting_manager = manager

        profile.save()
        return user

    @classmethod
    def get_employee_leaves(cls, hrms_id, from_date, to_date):
        """Fetch real-time leave data from HRMS API"""
        url = f"{cls.BASE_URL}/api/Employee/GetEmployeeLeaves"
        params = {
            'From_Date': from_date,
            'ToDate': to_date,
            'Flag': 'Summary', # Or as per HRMS spec
            'cmpId': cls.COMPANY_ID
        }
        
        try:
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Failed to fetch leaves for ID {hrms_id}: {str(e)}")
            return None

    @classmethod
    def _sync_location(cls, data, company):
        """Sync location data with city mapping"""
        branch_name = data.get('Branch')
        city_name = data.get('Branch_City')
        address = data.get('Branch_Address', '')

        # Standard entities for location
        country, _ = CountryMaster.objects.get_or_create(country_name='India', defaults={'country_code': 'IND'})
        state, _ = StateMaster.objects.get_or_create(state_name='Jharkhand', country=country) # Fallback state
        
        # Resolve City
        city, _ = CityMaster.objects.get_or_create(
            city_name=city_name,
            state=state,
            defaults={'category_id': 1} # Default category
        )

        location, _ = LocationMaster.objects.get_or_create(
            location_name=branch_name,
            company=company,
            defaults={
                'location_code': branch_name[:10].upper(),
                'city': city,
                'state': state,
                'country': country,
                'address': address
            }
        )
        return location

    @classmethod
    def _resolve_manager(cls, name):
        """Try to find manager by name, or if not found, we might need an ID to fetch them"""
        # Search by full name combined
        manager = User.objects.filter(first_name__icontains=name.split(' ')[0]).first()
        if not manager:
            # In a real scenario, we'd want the Manager's ID from the API
            # For now, we search by name. If not found, we can't create them without an ID.
            logger.info(f"Manager '{name}' not found locally.")
        return manager
