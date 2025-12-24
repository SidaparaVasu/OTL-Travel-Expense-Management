from django.shortcuts import redirect
from django.views import View
from django.http import JsonResponse
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
from apps.authentication.models import Role, UserRole
from .utils import SSOTokenHandler
from .validators import SSOTokenValidator
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
            
            # Step 4: Check if admin (emp_id == '0')
            emp_id = params['emp_id']
            username = params['username']
            
            if emp_id == '0':
                # ADMIN USER
                return self._handle_admin_login(username, params)
            else:
                # EMPLOYEE USER (for now, treat as admin until HRMS API ready)
                # TODO: Implement virtual session
                return self._handle_admin_login(username, params)
                
        except Exception as e:
            logger.error(f"SSO login failed: {str(e)}", exc_info=True)
            return JsonResponse({
                'success': False,
                'message': 'Authentication failed',
                'data': None,
                'error': str(e)
            }, status=401)
    
    def _handle_admin_login(self, username, params):
        """
        Handle admin login (emp_id='0')
        Creates user if doesn't exist, returns JWT tokens
        """
        # Check if user exists
        user = User.objects.filter(username=username).first()
        
        if not user:
            # Create admin user
            user = User.objects.create_user(
                username=username,
                email=f"{username.replace('@', '_at_')}@sso.local",
                user_type='organizational',
                is_active=True,
                first_name=username.split('@')[0] if '@' in username else username,
                last_name='(SSO)',
                gender='M'
            )
            logger.info(f"Created SSO admin user: {username}")
            
            # Assign Admin role
            admin_role, _ = Role.objects.get_or_create(
                name='Admin',
                defaults={
                    'role_type': 'admin',
                    'is_active': True,
                    'description': 'System Administrator'
                }
            )
            
            UserRole.objects.create(
                user=user,
                role=admin_role,
                is_primary=True
            )
            logger.info(f"Assigned Admin role to: {username}")
        
        # Generate JWT tokens (same as regular login)
        refresh = RefreshToken.for_user(user)
        
        # Get user roles
        primary_role = user.get_primary_role()
        all_roles = user.get_all_roles()
        
        # Get profile data
        profile_data = None
        if user.user_type == 'organizational':
            profile = getattr(user, 'organizational_profile', None)
            if profile:
                profile_data = {
                    'type': 'organizational',
                    'employee_id': profile.employee_id,
                    'company': {
                        'id': profile.company.id,
                        'name': profile.company.name
                    } if profile.company else None,
                    'department': {
                        'id': profile.department.department_id,
                        'name': profile.department.dept_name
                    } if profile.department else None,
                    'designation': {
                        'id': profile.designation.designation_id,
                        'name': profile.designation.designation_name
                    } if profile.designation else None,
                    'grade': {
                        'id': profile.grade.id,
                        'name': profile.grade.name
                    } if profile.grade else None,
                    'base_location': {
                        'id': profile.base_location.location_id,
                        'name': profile.base_location.location_name,
                        'city_id': profile.base_location.city_id,
                        'city_name': profile.base_location.city.city_name,
                        'state_id': profile.base_location.state_id,
                        'state_name': profile.base_location.state.state_name
                    } if profile.base_location else None,
                    'reporting_manager': {
                        'id': profile.reporting_manager.id,
                        'name': profile.reporting_manager.get_full_name(),
                        'username': profile.reporting_manager.username
                    } if profile.reporting_manager else None
                }
        
        # Return EXACT SAME format as /auth/login/
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
                    'user_type': user.user_type
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
        
        # Return JSON response
        return JsonResponse(response_data, status=200)
