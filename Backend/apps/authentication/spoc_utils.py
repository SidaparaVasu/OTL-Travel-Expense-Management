from django.db import models
from .models.spoc import LocationSPOCAssignment

def get_spoc_users(location_id, role_name):
    """
    Retrieve a QuerySet of Users who are assigned as SPOCs for the given location and role.
    
    Logic:
    - User has an active assignment for the given Role.
    - Assignment covers the specific location OR is Global (no locations assigned).
    """
    if not location_id or not role_name:
        return []

    assignments = LocationSPOCAssignment.objects.filter(
        role__name__iexact=role_name,
        is_active=True
    ).filter(
        models.Q(locations__location_id=location_id) | models.Q(is_global=True)
    ).distinct()
    
    # Return User objects directly
    return User.objects.filter(
        spoc_assignments__in=assignments
    ).distinct()
