from apps.authentication.mixins import BranchFilterMixin
from apps.travel.models import TravelApplication, Booking


class _BranchAccessHelper(BranchFilterMixin):
    """Minimal helper to reuse branch access checks outside generic views."""


def user_can_view_travel_application(user, application: TravelApplication) -> bool:
    """
    Mirror TravelApplicationDetailsView access rules.
    """
    if application.employee_id == user.id:
        return True

    if application.approval_flows.filter(approver=user).exists():
        return True

    if application.travel_desk_user_id == user.id:
        return True

    has_staff_role = (
        user.has_role("Admin")
        or user.has_role("admin")
        or user.has_role("Travel Desk")
        or user.has_role("Finance")
    )
    if has_staff_role:
        return _BranchAccessHelper().check_branch_access(user, application.employee)

    return False


def user_can_preview_booking_bulk(user, booking: Booking) -> bool:
    """
    Booking agents may preview bulk data for bookings assigned to them.
    Other roles use travel application visibility rules.
    """
    assignment = getattr(booking, "assignment", None)
    if assignment is not None and assignment.assigned_to_id == user.id:
        return True

    application = booking.trip_details.travel_application
    return user_can_view_travel_application(user, application)
