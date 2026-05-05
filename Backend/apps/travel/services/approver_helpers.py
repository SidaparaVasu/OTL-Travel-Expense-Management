"""
Approver Helper Service

Single source of truth for resolving the manager-level approver for a
TravelApplication. Handles:
  - User-selected approver (new feature)
  - Fallback to reporting_manager (backward compatible)
  - Eligibility checks (grade B-2A/B-2B/B-3 or TemporaryApproverAuthorization)
  - Listing eligible approvers for the frontend dropdown
"""

import logging
from django.utils import timezone

logger = logging.getLogger(__name__)

# Grades that are permanently eligible to approve travel requests per TSF policy
ELIGIBLE_APPROVER_GRADES = ('B-2A', 'B-2B', 'B-3')


def is_eligible_approver(user) -> bool:
    """
    Check if a user is eligible to act as a manager-level approver.

    A user is eligible if:
      1. Their grade is B-2A, B-2B, or B-3, OR
      2. They have an active TemporaryApproverAuthorization for today.

    Args:
        user: User instance

    Returns:
        bool
    """
    if user is None:
        return False

    try:
        # 1. Grade-based eligibility
        grade = getattr(user, 'grade', None)
        if grade and grade.name.upper() in ELIGIBLE_APPROVER_GRADES:
            return True

        # Also check via organizational_profile (in case User.grade is not synced)
        profile = getattr(user, 'organizational_profile', None)
        if profile and profile.grade and profile.grade.name.upper() in ELIGIBLE_APPROVER_GRADES:
            return True

        # 2. Temporary authorization
        from apps.authentication.models import TemporaryApproverAuthorization
        today = timezone.now().date()
        has_temp_auth = TemporaryApproverAuthorization.objects.filter(
            user=user,
            is_active=True,
            valid_from__lte=today,
            valid_until__gte=today,
        ).exists()
        if has_temp_auth:
            return True

    except Exception as e:
        logger.warning("is_eligible_approver: error checking user %s: %s", getattr(user, 'id', None), e)

    return False


def resolve_manager_approver(travel_app, request_user):
    """
    Resolve the manager-level approver for a TravelApplication.

    Priority:
      1. travel_app.selected_approver — if set AND still eligible today
      2. request_user.organizational_profile.reporting_manager — backward-compatible fallback

    Args:
        travel_app: TravelApplication instance (may be None for engine init)
        request_user: User instance submitting the application

    Returns:
        User instance or None
    """
    # --- 1. Try selected_approver ---
    if travel_app is not None:
        selected = getattr(travel_app, 'selected_approver', None)
        if selected is not None:
            if is_eligible_approver(selected):
                logger.debug(
                    "resolve_manager_approver: using selected_approver=%s for TR=%s",
                    selected.id,
                    getattr(travel_app, 'id', None),
                )
                return selected
            else:
                # selected_approver lost eligibility (grade change / temp auth expired)
                logger.warning(
                    "resolve_manager_approver: selected_approver=%s is no longer eligible "
                    "for TR=%s — falling back to reporting_manager",
                    selected.id,
                    getattr(travel_app, 'id', None),
                )

    # --- 2. Fallback: reporting_manager (original behavior) ---
    org_profile = getattr(request_user, 'organizational_profile', None)
    reporting_manager = getattr(org_profile, 'reporting_manager', None)
    return reporting_manager


def get_eligible_approvers():
    """
    Return a queryset of all users currently eligible to be selected as approvers.

    Includes:
      - Users with grade B-2A, B-2B, or B-3
      - Users with an active TemporaryApproverAuthorization for today

    Returns:
        QuerySet of User instances (distinct, ordered by name)
    """
    from django.contrib.auth import get_user_model
    from django.db.models import Q
    from apps.authentication.models import TemporaryApproverAuthorization

    User = get_user_model()
    today = timezone.now().date()

    # Grade-based eligible users
    grade_based = User.objects.filter(
        organizational_profile__grade__name__in=ELIGIBLE_APPROVER_GRADES,
        is_active=True,
    )

    # Temp-authorized users
    temp_auth_user_ids = TemporaryApproverAuthorization.objects.filter(
        is_active=True,
        valid_from__lte=today,
        valid_until__gte=today,
    ).values_list('user_id', flat=True)

    temp_authorized = User.objects.filter(
        id__in=temp_auth_user_ids,
        is_active=True,
    )

    # Combine and deduplicate
    return (grade_based | temp_authorized).select_related(
        'organizational_profile__grade'
    ).distinct().order_by('first_name', 'last_name')
