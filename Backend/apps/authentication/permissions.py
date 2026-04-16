from rest_framework.permissions import BasePermission
from apps.authentication.models import BookingAgentProfile 

class IsAdminUser(BasePermission):
    """
    Permission for admin dashboard users only
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return request.user.has_role('admin')
    
    message = "Admin access required"

class IsEmployee(BasePermission):
    """
    Permission for employee dashboard users
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return request.user.has_role('employee')
    
    message = "Employee access required"


class IsOwnerOrApprover(BasePermission):
    """
    Only the user who created the application or the current approver can access it.
    
    Enhanced with branch-based access control:
    - CEO/CHRO: Company-wide access
    - Admin/Travel Desk/Finance: Branch-level access only
    - Manager: Branch subordinates only
    - Employee: Own data only
    """
    def has_object_permission(self, request, view, obj):
        user = request.user
        
        # Allow if user is the requester (owner)
        if obj.employee == user:
            return True
        
        # Allow if user is an approver in the workflow
        if hasattr(obj, 'approval_flows'):
            is_approver = obj.approval_flows.filter(
                approver=user
            ).exists()
            if is_approver:
                return True
        
        # CEO/CHRO have company-wide access (no branch restriction)
        if user.has_role('CEO') or user.has_role('CHRO'):
            return True
        
        # Get user and object employee profiles for branch checking
        user_profile = user.get_profile()
        obj_profile = obj.employee.get_profile()
        
        # If either profile is missing, deny access (except for roles already checked above)
        if not user_profile or not obj_profile:
            return False
        
        # Check if both users are in the same branch
        same_branch = (user_profile.base_location == obj_profile.base_location)
        
        # Staff roles with branch-level access control
        staff_roles = ['Admin', 'admin', 'Travel Desk', 'Finance', 'Branch Admin']
        if any(user.has_role(role) for role in staff_roles):
            # Same branch check
            if same_branch:
                return True
                
            # Cross-branch SPOC assignment check
            from apps.authentication.mixins import ENABLE_SPOC_BASED_FILTERING
            if ENABLE_SPOC_BASED_FILTERING:
                from apps.authentication.models.spoc import LocationSPOCAssignment
                from django.db.models import Q
                
                return LocationSPOCAssignment.objects.filter(
                    user=user,
                    is_active=True
                ).filter(
                    Q(is_global=True) | Q(locations__location_id=obj_profile.base_location.location_id)
                ).exists()
            
            return False
            
        # Manager visibility - subordinates within their branch only
        if user.has_role('Manager'):
            is_subordinate = (obj_profile.reporting_manager == user)
            return same_branch and is_subordinate
        
        return False
    
    message = "You don't have permission to access this travel application"

class HasCustomPermission(BasePermission):
    """
    Check custom permission by codename
    Usage: Set permission_required = 'permission_codename' on view
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            self.message = "Authentication required"
            return False
        
        required_permission = getattr(view, 'permission_required', None)
        if not required_permission:
            # If no permission specified, allow (view should define it)
            return True
        
        user_permissions = request.user.get_user_permissions_list()
        has_perm = required_permission in user_permissions
        
        if not has_perm:
            self.message = f"Permission '{required_permission}' required"
        
        return has_perm
    

class IsTravelDesk(BasePermission):
    """Permission for Travel Desk users"""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return request.user.has_role('Travel Desk') or request.user.has_role('Global Travel Desk')
    
    message = "Travel Desk access required"

class IsBookingAgent(BasePermission):
    """
    Allow only booking agent users.
    """

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        if hasattr(user, "user_type") and user.user_type != "external":
            return False

        profile = getattr(user, "booking_agent_profile", None)
        if not profile:
            profile = (
                BookingAgentProfile.objects.filter(user=user).first()
                if BookingAgentProfile is not None
                else None
            )

        # Fix: Check user_type and profile existence instead of removed 'profile_type' field
        return bool(request.user.user_type == 'external' and profile)

class IsSPOC(BasePermission):
    """Permission for SPOC users"""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        # Check if user is assigned as SPOC for any location
        return request.user.locationspoc_set.filter(is_active=True).exists()
    
    message = "SPOC access required"

class IsBranchAdmin(BasePermission):
    """
    Permission for Branch Administrators who only manage data for their location
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return request.user.has_role('Branch Admin')
    
    message = "Branch Admin access required"
