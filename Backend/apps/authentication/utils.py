from django.db import transaction
from .models import User, Role, Permission, UserRole, RolePermission

class RoleManager:
    """
    Utility class for role and permission management
    """
    
    @staticmethod
    def assign_role_to_user(user, role_name, is_primary=False, assigned_by=None):
        """
        Assign a role to a user
        """
        try:
            role = Role.objects.get(name=role_name, is_active=True)
            user_role, created = UserRole.objects.get_or_create(
                user=user,
                role=role,
                defaults={
                    'is_primary': is_primary,
                    'assigned_by': assigned_by
                }
            )
            
            if not created and is_primary:
                user_role.is_primary = True
                user_role.save()
                
            return user_role, created
        except Role.DoesNotExist:
            raise ValueError(f"Role '{role_name}' does not exist")
    
    @staticmethod
    def remove_role_from_user(user, role_name):
        """
        Remove a role from a user
        """
        try:
            role = Role.objects.get(name=role_name)
            UserRole.objects.filter(user=user, role=role).delete()
            return True
        except Role.DoesNotExist:
            return False
    
    @staticmethod
    def switch_primary_role(user, role_name):
        """
        Switch user's primary role
        """
        if not user.has_role(role_name):
            raise ValueError("User does not have this role assigned")
        
        with transaction.atomic():
            # Remove primary from all roles
            UserRole.objects.filter(user=user).update(is_primary=False)
            # Set new primary
            UserRole.objects.filter(
                user=user, 
                role__name=role_name
            ).update(is_primary=True)
    
    @staticmethod
    def create_default_roles():
        """
        Create default system roles with permissions
        """
        default_roles = {
            'Employee': {
                'role_type': 'employee',
                'dashboard_access': 'employee',
                'description': 'Standard employee with travel request capabilities',
                'permissions': [
                    'travel_request_create',
                    'travel_request_view_own',
                    'expense_claim_create',
                    'profile_view_own',
                ]
            },
            'Manager': {
                'role_type': 'manager',
                'dashboard_access': 'admin',
                'description': 'Team manager with approval capabilities',
                'permissions': [
                    'travel_request_create',
                    'travel_request_view_own',
                    'travel_request_approve_subordinate',
                    'expense_claim_create',
                    'expense_claim_approve_subordinate',
                    'profile_view_own',
                    'reports_view_team',
                ]
            },
            'Travel Desk': {
                'role_type': 'travel_desk',
                'dashboard_access': 'admin',
                'description': 'Travel booking and coordination team',
                'permissions': [
                    'travel_request_view_all',
                    'booking_manage',
                    'accommodation_manage',
                    'vehicle_coordinate',
                    'reports_view_all',
                ]
            },
            'Admin': {
                'role_type': 'admin',
                'dashboard_access': 'admin',
                'description': 'System administrator with full access',
                'permissions': [
                    'user_management',
                    'master_data_manage',
                    'travel_request_view_all',
                    'expense_claim_view_all',
                    'reports_view_all',
                    'system_configure',
                ]
            },
            'CHRO': {
                'role_type': 'chro',
                'dashboard_access': 'admin',
                'description': 'Chief Human Resources Officer',
                'permissions': [
                    'travel_request_approve_all',
                    'expense_claim_approve_all',
                    'user_management',
                    'reports_view_all',
                    'policy_manage',
                ]
            },
            'CEO': {
                'role_type': 'ceo',
                'dashboard_access': 'admin',
                'description': 'Chief Executive Officer',
                'permissions': [
                    'travel_request_approve_all',
                    'expense_claim_approve_all',
                    'user_management',
                    'master_data_manage',
                    'reports_view_all',
                    'system_configure',
                    'policy_manage',
                ]
            }
        }
        
        # Create permissions first
        PermissionManager.create_default_permissions()
        
        for role_name, role_data in default_roles.items():
            role, created = Role.objects.get_or_create(
                name=role_name,
                defaults={
                    'role_type': role_data['role_type'],
                    'dashboard_access': role_data['dashboard_access'],
                    'description': role_data['description']
                }
            )
            
            if created:
                # Assign permissions to role
                for perm_codename in role_data['permissions']:
                    try:
                        permission = Permission.objects.get(codename=perm_codename)
                        RolePermission.objects.get_or_create(
                            role=role,
                            permission=permission
                        )
                    except Permission.DoesNotExist:
                        print(f"Warning: Permission '{perm_codename}' not found")

class PermissionManager:
    """
    Utility class for permission management
    """
    
    @staticmethod
    def create_default_permissions():
        """
        Create default system permissions
        """
        default_permissions = [
            # Travel permissions
            ('travel_request_create', 'Create Travel Request', 'travel'),
            ('travel_request_view_own', 'View Own Travel Requests', 'travel'),
            ('travel_request_view_all', 'View All Travel Requests', 'travel'),
            ('travel_request_approve_subordinate', 'Approve Subordinate Travel Requests', 'approvals'),
            ('travel_request_approve_all', 'Approve Any Travel Request', 'approvals'),
            ('travel_request_modify', 'Modify Travel Requests', 'travel'),
            ('travel_request_cancel', 'Cancel Travel Requests', 'travel'),
            
            # Booking permissions
            ('booking_manage', 'Manage Bookings', 'booking'),
            ('accommodation_manage', 'Manage Accommodation', 'booking'),
            ('vehicle_coordinate', 'Coordinate Vehicle Bookings', 'booking'),
            
            # Expense permissions
            ('expense_claim_create', 'Create Expense Claims', 'expenses'),
            ('expense_claim_view_own', 'View Own Expense Claims', 'expenses'),
            ('expense_claim_view_all', 'View All Expense Claims', 'expenses'),
            ('expense_claim_approve_subordinate', 'Approve Subordinate Expense Claims', 'approvals'),
            ('expense_claim_approve_all', 'Approve Any Expense Claim', 'approvals'),
            
            # User management permissions
            ('user_management', 'Manage Users', 'user_management'),
            ('profile_view_own', 'View Own Profile', 'user_management'),
            ('profile_view_all', 'View All Profiles', 'user_management'),
            
            # Master data permissions
            ('master_data_manage', 'Manage Master Data', 'master_data'),
            ('master_data_view', 'View Master Data', 'master_data'),
            
            # Reports permissions
            ('reports_view_own', 'View Own Reports', 'reports'),
            ('reports_view_team', 'View Team Reports', 'reports'),
            ('reports_view_all', 'View All Reports', 'reports'),
            
            # System permissions
            ('system_configure', 'System Configuration', 'user_management'),
            ('policy_manage', 'Manage Policies', 'user_management'),
        ]
        
        for codename, name, category in default_permissions:
            Permission.objects.get_or_create(
                codename=codename,
                defaults={
                    'name': name,
                    'category': category,
                    'description': f'Permission to {name.lower()}'
                }
            )

# DEPRECATED: This model/component is not in use anymore and is marked for deletion.
# Status: Deprecated since June 2, 2026 — no active usage recorded.
def setup_initial_data():
    """
    Set up initial roles and permissions
    """
    PermissionManager.create_default_permissions()
    RoleManager.create_default_roles()
    print("Initial roles and permissions created successfully")