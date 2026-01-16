from rest_framework.permissions import BasePermission
from apps.authentication.models import BookingAgentProfile 

class IsAdminUser(BasePermission):
    """
    Permission for admin dashboard users only
    """
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            request.user.has_role('admin')
        )
    
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
        return (
            request.user and 
            request.user.is_authenticated and 
            request.user.has_role('employee')
        )
    
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
    Only the user who created the application or the current approver can access it
    """
    def has_object_permission(self, request, view, obj):
        user = request.user
        # Allow if user is the requester
        if obj.employee == user:
            return True
        
        # Allow if user is an approver in the workflow
        if hasattr(obj, 'approval_flows'):
            is_approver = obj.approval_flows.filter(
                approver=user
            ).exists()
            if is_approver:
                return True
        
        # Super-users / Executives visibility
        if user.has_role('Admin') or user.has_role('admin') or user.has_role('CEO') or user.has_role('CHRO'):
            return True

        # Branch Admin visibility
        if user.has_role('Branch Admin'):
            profile = user.get_profile()
            obj_profile = obj.employee.get_profile()
            if profile and obj_profile and profile.base_location == obj_profile.base_location:
                return True
        
        # Manager visibility for subordinates
        if user.has_role('Manager'):
            obj_profile = obj.employee.get_profile()
            if obj_profile and obj_profile.reporting_manager == user:
                return True
        
        # Travel Desk visibility
        if user.has_role('Travel Desk'):
            return True
        
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
        return request.user.has_role('Travel Desk')
    
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

        return bool(profile and profile.profile_type == "booking_agent")

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
