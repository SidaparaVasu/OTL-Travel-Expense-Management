from django.db import models
from .models.spoc import LocationSPOCAssignment


def get_user_spoc_assignments(user, role_name=None):
    """Active LocationSPOCAssignment rows for a user, optionally scoped to a role name."""
    assignments = LocationSPOCAssignment.objects.filter(
        user=user,
        is_active=True,
    ).prefetch_related("locations")
    if role_name:
        assignments = assignments.filter(role__name__iexact=role_name)
    return assignments


def get_user_assigned_location_ids(user, role_name=None, include_base_location=True):
    """
    Location IDs the user may access via SPOC assignments.
    Returns None when the user has a global assignment (all locations).
    """
    assignments = get_user_spoc_assignments(user, role_name=role_name)
    if not assignments.exists():
        if include_base_location:
            profile = user.get_profile()
            if profile and profile.base_location:
                return {profile.base_location.location_id}
        return set()

    if assignments.filter(is_global=True).exists():
        return None

    location_ids = set()
    for assignment in assignments:
        location_ids.update(
            assignment.locations.values_list("location_id", flat=True)
        )
    if include_base_location:
        profile = user.get_profile()
        if profile and profile.base_location:
            location_ids.add(profile.base_location.location_id)
    return location_ids


def get_user_assigned_locations(user, role_name=None, include_base_location=True):
    """LocationMaster instances for dropdowns (id + name)."""
    from apps.master_data.models.geography import LocationMaster

    location_ids = get_user_assigned_location_ids(
        user,
        role_name=role_name,
        include_base_location=include_base_location,
    )
    if location_ids is None:
        return list(LocationMaster.objects.order_by("location_name"))
    if not location_ids:
        return []
    return list(
        LocationMaster.objects.filter(location_id__in=location_ids).order_by(
            "location_name"
        )
    )


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
