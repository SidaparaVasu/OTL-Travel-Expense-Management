from django.utils import timezone
from apps.travel.models.permission import BackdatedTRAllowance

def check_backdated_tr_permission(user):
    """
    Check if the user currently has an active administrative allowance 
    to submit back-dated travel requests.
    
    STRICT POLICY: Everyone (including Admins and Superusers) must have 
    an explicit allowance in the database to enable this feature.
    """
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
