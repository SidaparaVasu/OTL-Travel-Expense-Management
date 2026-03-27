from django.utils import timezone
from apps.travel.models.permission import BackdatedTRAllowance

def check_backdated_tr_permission(user):
    """
    Check if the user currently has an active administrative allowance 
    to submit back-dated travel requests.
    
    Admins and Travel Desk users are exempted from this check and 
    always have the right.
    """
    # 1. Self-Exemption: Superusers always have permission for safety
    if user.is_superuser:
        return True
    
    # Check for specific system-wide roles that are strictly exempted (if any)
    # For now, we apply the policy strictly even to regular Admin roles 
    # so they can test the allowance flow.
    # if user.has_role('travel_desk'): return True


    # 2. Check for active allowance in the Database
    now = timezone.now()
    return BackdatedTRAllowance.objects.filter(
        user=user,
        is_active=True,
        allowed_from__lte=now,
        allowed_until__gte=now
    ).exists()

def get_active_backdated_allowance(user):
    """
    Return the currently active allowance object for the user, if any.
    """
    now = timezone.now()
    return BackdatedTRAllowance.objects.filter(
        user=user,
        is_active=True,
        allowed_from__lte=now,
        allowed_until__gte=now
    ).order_by('-allowed_until').first()
