from django.shortcuts import redirect
from django.views import View
from django.http import JsonResponse
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
from apps.authentication.models import Role, UserRole, OrganizationalProfile
from .utils import SSOTokenHandler
from .validators import SSOTokenValidator
from .hrms_service import HRMSSyncService
import logging

logger = logging.getLogger('sso_auth')
User = get_user_model()


class SSOLoginView(View):
    """
    Handle HRMS SSO login
    Returns SAME response format as /auth/login/ for frontend compatibility
    """
    
    def get(self, request):
        encrypted_token = request.GET.get('auth')
        
        if not encrypted_token:
            return JsonResponse({
                'success': False,
                'message': 'Missing authentication token',
                'data': None
            }, status=400)
        
        try:
            # Step 1: Decrypt token
            decrypted = SSOTokenHandler.decrypt_token(encrypted_token)
            logger.info(f"Token decrypted")
            
            # Step 2: Parse parameters
            params = SSOTokenValidator.parse_params(decrypted)
            
            # Step 3: Validate
            is_valid, error = SSOTokenValidator.validate_params(params)
            if not is_valid:
                return JsonResponse({
                    'success': False,
                    'message': error,
                    'data': None
                }, status=400)
            
            # Step 4: Handle Login
            emp_id = params['emp_id']
            username = params['username']
            logger.info(f"SSO Login attempt: username={username}, emp_id={emp_id}")
            
            if emp_id == '0':
                # LOCAL ADMIN / SUPERUSER (via SSO)
                return self._handle_sso_login(username, params, is_admin=True)
            else:
                # REAL HRMS EMPLOYEE
                user = HRMSSyncService.sync_user(emp_id)
                if not user:
                    return JsonResponse({
                        'success': False,
                        'message': 'Failed to sync employee data from HRMS',
                        'data': None
                    }, status=400)
                
                return self._handle_sso_login(user.username, params, user_obj=user)
                
        except Exception as e:
            logger.error(f"SSO login failed: {str(e)}", exc_info=True)
            return JsonResponse({
                'success': False,
                'message': 'Authentication failed',
                'data': None,
                'error': str(e)
            }, status=401)
    
    def _handle_sso_login(self, username, params, is_admin=False, user_obj=None):
        """
        Unified handler for SSO logins. 
        Creates/Syncs user and returns JWT tokens.
        """
        # Get user
        user = user_obj or User.objects.filter(username=username).first()
        
        if not user:
            if is_admin:
                # Create local admin user if it doesn't exist (emergency fallback)
                user = User.objects.create_user(
                    username=username,
                    email=f"{username.replace('@', '_at_')}@sso.local",
                    user_type='organizational',
                    is_active=True,
                    first_name=username.split('@')[0] if '@' in username else username,
                    last_name='(SSO Admin)'
                )
                logger.info(f"Created SSO admin user: {username}")
            else:
                # Should have been synced by HRMSSyncService
                return JsonResponse({'success': False, 'message': 'User sync failed'}, status=500)
        
        # Ensure OrganizationalProfile exists for all organizational users
        if user.user_type == 'organizational':
            OrganizationalProfile.objects.get_or_create(
                user=user,
                defaults={'employee_code': f"SSO-{user.id}"}
            )
        
        # Ensure Roles exist
        self._ensure_user_roles(user, is_admin)
        
        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)
        primary_role = user.get_primary_role()
        all_roles = user.get_all_roles()
        profile = user.get_profile()
        
        # Profile Data Mapping
        profile_data = self._get_profile_response_data(profile)
        
        # Return standard response
        response_data = {
            'success': True,
            'message': 'Login successful',
            'data': {
                'tokens': {
                    'access': str(refresh.access_token),
                    'refresh': str(refresh)
                },
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'full_name': user.get_full_name(),
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'gender': user.gender,
                    'user_type': user.user_type,
                    'mobile_no': getattr(user, 'mobile_no', None)
                },
                'profile': profile_data,
                'roles': [
                    {
                        'id': role.id,
                        'name': role.name,
                        'role_type': role.role_type,
                        'description': role.description,
                        'is_primary': primary_role and role.id == primary_role.id
                    } for role in all_roles
                ],
                'permissions': user.get_user_permissions_list()
            }
        }
        
        logger.info(f"SSO login successful: {username}")
        return JsonResponse(response_data, status=200)

    def _ensure_user_roles(self, user, is_admin):
        """Standardize role assignment for SSO users"""
        role_name = 'Admin' if is_admin else 'Employee'
        role_type = 'admin' if is_admin else 'employee'
        
        role, _ = Role.objects.get_or_create(
            name=role_name,
            defaults={'role_type': role_type, 'is_active': True}
        )
        
        if not UserRole.objects.filter(user=user, role=role).exists():
            UserRole.objects.create(
                user=user,
                role=role,
                is_primary=True
            )
            
        # If user has subordinates, also give 'Manager' role
        if user.subordinates.exists():
            mgr_role, _ = Role.objects.get_or_create(
                name='Manager',
                defaults={'role_type': 'manager', 'is_active': True}
            )
            if not UserRole.objects.filter(user=user, role=mgr_role).exists():
                UserRole.objects.create(user=user, role=mgr_role, is_primary=False)

    def _get_profile_response_data(self, profile):
        if not profile:
            return None
            
        return {
            'type': 'organizational',
            'employee_id': profile.employee_code, # Business code like 00017
            'hrms_id': profile.user.hrms_id,      # Numerical ID like 2
            'company': {'id': profile.company.id, 'name': profile.company.name} if profile.company else None,
            'department': {'id': profile.department.department_id, 'name': profile.department.dept_name} if profile.department else None,
            'designation': {'id': profile.designation.designation_id, 'name': profile.designation.designation_name} if profile.designation else None,
            'grade': {'id': profile.grade.id, 'name': profile.grade.name} if profile.grade else None,
            'base_location': {
                'id': profile.base_location.location_id,
                'name': profile.base_location.location_name,
                'city_name': profile.base_location.city.city_name if profile.base_location.city else None
            } if profile.base_location else None,
            'reporting_manager': {
                'id': profile.reporting_manager.id,
                'name': profile.reporting_manager.get_full_name(),
                'username': profile.reporting_manager.username
            } if profile.reporting_manager else None
        }
