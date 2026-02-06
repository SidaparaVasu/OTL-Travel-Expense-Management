import logging
from django.views import View
from django.http import JsonResponse
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken

from apps.authentication.models import Role, UserRole, OrganizationalProfile
from .utils import SSOTokenHandler
from .validators import SSOTokenValidator
from .hrms_service import HRMSSyncService

logger = logging.getLogger('sso_auth')
User = get_user_model()


class SSOLoginView(View):
    """
    HRMS SSO Login Entry Point

    Flow:
    1. Decrypt HRMS SSO token
    2. Validate parameters
    3. Resolve admin vs employee
    4. Sync HRMS data (if employee)
    5. Enforce HRMS active status
    6. Issue JWT tokens
    """

    def get(self, request):
        encrypted_token = request.GET.get('auth')

        if not encrypted_token:
            return self._error("Missing authentication token", status=400)

        try:
            # ----------------------------------------------------------
            # Step 1: Decrypt token
            # ----------------------------------------------------------
            decrypted = SSOTokenHandler.decrypt_token(encrypted_token)
            logger.info("SSO token decrypted")

            # ----------------------------------------------------------
            # Step 2: Parse + validate
            # ----------------------------------------------------------
            params = SSOTokenValidator.parse_params(decrypted)
            is_valid, error = SSOTokenValidator.validate_params(params)

            if not is_valid:
                return self._error(error, status=400)

            company_id = params['company_id']
            emp_id = params['emp_id']
            username = params['username']

            logger.info(
                f"SSO Login attempt | username={username} "
                f"| emp_id={emp_id} | company_id={company_id}"
            )

            # ----------------------------------------------------------
            # Step 3: Admin SSO (emp_id == 0)
            # ----------------------------------------------------------
            if emp_id == '0':
                user = self._get_or_create_admin(username)
                return self._finalize_login(user, is_admin=True, is_hrms=True)

            # ----------------------------------------------------------
            # Step 4: HRMS Employee SSO
            # ----------------------------------------------------------
            try:
                user = HRMSSyncService.sync_user(emp_id, company_id)
            except Exception as sync_exc:
                logger.error(f"HRMS Sync Error: {str(sync_exc)}", exc_info=True)
                return self._error(
                    "System synchronization error. Please contact Administrator.",
                    status=500,
                    extra=str(sync_exc)
                )

            if not user:
                return self._error(
                    "Failed to sync employee data from HRMS",
                    status=400
                )

            # HARD SAFETY CHECK
            if not user.username:
                return JsonResponse({
                    'success': False,
                    'message': 'Unable to resolve username from HRMS data',
                    'data': None
                }, status=400)

            # ----------------------------------------------------------
            # Step 5: Enforce HRMS active status
            # ----------------------------------------------------------
            if not user.is_active:
                return self._error(
                    "Your HRMS account is inactive. Please contact HR.",
                    status=403
                )

            return self._finalize_login(user, is_hrms=True)

        except ValueError as val_err:
            # Crypto/Token format errors
            logger.error(f"SSO Decryption Error: {str(val_err)}")
            return self._error("Invalid or malformed authentication token", status=401, extra=str(val_err))
        except Exception as exc:
            logger.error("SSO login failed", exc_info=True)
            return self._error("Authentication failed due to an unexpected error", status=401, extra=str(exc))

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _get_or_create_admin(self, username: str) -> User:
        """
        Create or fetch a local admin user via SSO.
        """
        user = User.objects.filter(username=username).first()
        if user:
            return user

        user = User.objects.create_user(
            username=username,
            email=f"{username.replace('@', '_at_')}@sso.local",
            user_type='organizational',
            is_active=True,
            first_name=username.split('@')[0],
            last_name='(SSO Admin)',
        )

        logger.info(f"Created SSO admin user: {username}")
        return user

    def _finalize_login(self, user: User, is_admin: bool = False, is_hrms: bool = True):
        """
        Assign roles, ensure profile, and issue JWT tokens.
        """

        # Ensure profile exists
        if user.user_type == 'organizational':
            OrganizationalProfile.objects.get_or_create(
                user=user,
                defaults={'employee_code': f"SSO-{user.id}"}
            )

        # Ensure roles
        self._ensure_roles(user, is_admin)

        # Issue JWT tokens
        refresh = RefreshToken.for_user(user)

        response = {
            'success': True,
            'message': 'Login successful',
            'data': {
                'tokens': {
                    'access': str(refresh.access_token),
                    'refresh': str(refresh),
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
                    'mobile_no': getattr(user, 'mobile_no', None),
                    'is_hrms_user': is_hrms,
                },
                'profile': self._profile_payload(user),
                'roles': self._roles_payload(user),
                'permissions': user.get_user_permissions_list(),
            },
        }

        logger.info(f"SSO login successful: {user.username}")
        return JsonResponse(response, status=200)

    def _ensure_roles(self, user: User, is_admin: bool):
        """
        Ensure base roles for SSO users.
        """
        base_role = 'Admin' if is_admin else 'Employee'
        base_type = 'admin' if is_admin else 'employee'

        role, _ = Role.objects.get_or_create(
            name=base_role,
            defaults={'role_type': base_type, 'is_active': True}
        )

        UserRole.objects.get_or_create(
            user=user,
            role=role,
            defaults={'is_primary': True}
        )

        # Manager role (derived)
        if user.subordinates.exists():
            mgr_role, _ = Role.objects.get_or_create(
                name='Manager',
                defaults={'role_type': 'manager', 'is_active': True}
            )
            UserRole.objects.get_or_create(
                user=user,
                role=mgr_role,
                defaults={'is_primary': False}
            )

    def _profile_payload(self, user: User):
        profile = user.get_profile()
        if not profile:
            return None

        return {
            'type': 'organizational',
            'employee_id': profile.employee_code,
            'hrms_id': user.hrms_id,
            'company': (
                {'id': profile.company.id, 'name': profile.company.name}
                if profile.company else None
            ),
            'department': (
                {'id': profile.department.department_id, 'name': profile.department.dept_name}
                if profile.department else None
            ),
            'designation': (
                {'id': profile.designation.designation_id, 'name': profile.designation.designation_name}
                if profile.designation else None
            ),
            'grade': (
                {'id': profile.grade.id, 'name': profile.grade.name}
                if profile.grade else None
            ),
            'base_location': (
                {
                    'id': profile.base_location.location_id,
                    'name': profile.base_location.location_name,
                    'city_name': profile.base_location.city.city_name,
                }
                if profile.base_location else None
            ),
            'reporting_manager': (
                {
                    'id': profile.reporting_manager.id,
                    'name': profile.reporting_manager.get_full_name(),
                    'username': profile.reporting_manager.username,
                }
                if profile.reporting_manager else None
            ),
        }

    def _roles_payload(self, user: User):
        primary = user.get_primary_role()
        return [
            {
                'id': role.id,
                'name': role.name,
                'role_type': role.role_type,
                'description': role.description,
                'is_primary': primary and role.id == primary.id,
            }
            for role in user.get_all_roles()
        ]

    def _error(self, message, status=400, extra=None):
        payload = {
            'success': False,
            'message': message,
            'data': None,
        }
        if extra:
            payload['error'] = extra
        return JsonResponse(payload, status=status)
