"""
Per-booking lock after travel application approval cycle completes.
"""
from apps.travel.models import Booking
from apps.travel.services.booking_closure import CLOSEABLE_STATUSES, TERMINAL_STATUSES

# Application has passed all approvers (travel desk / booking may be in progress).
POST_APPROVAL_APP_STATUSES = frozenset({
    "pending_travel_desk",
    "booking_in_progress",
    "booked",
    "completed",
})

PENDING_APPROVAL_APP_STATUSES = frozenset({
    "draft",
    "submitted",
    "pending_manager",
    "pending_ceo",
    "pending_chro",
    "approved_manager",
    "approved_chro",
    "approved_ceo",
    "rejected_manager",
    "rejected_ceo",
    "rejected_chro",
    "cancellation_requested",
})


def application_approvals_complete(application) -> bool:
    return application.status in POST_APPROVAL_APP_STATUSES


def sync_booking_approval_locks(application) -> int:
    """Set is_approved on all line items when the TR is past the approval gate."""
    approved = application_approvals_complete(application)
    return Booking.objects.filter(
        trip_details__travel_application=application,
    ).update(is_approved=approved)


def unlock_booking_approval_locks(application) -> int:
    """Critical edit reset to draft — allow booking edits again until re-approved."""
    return Booking.objects.filter(
        trip_details__travel_application=application,
    ).update(is_approved=False)


def is_booking_actionable(booking: Booking) -> bool:
    """Applicant may edit or hard-delete (pre-approval only)."""
    if booking.status in TERMINAL_STATUSES:
        return False
    if booking.is_approved:
        return False
    return True


def should_skip_nested_booking_update(booking: Booking) -> bool:
    """
    Nested TR save must not apply payload fields to this line.
    Closed/cancelled/completed lines stay as-is; approval-locked lines use close API.
    """
    if booking.status in TERMINAL_STATUSES:
        return True
    if booking.is_approved:
        return True
    return False


def can_applicant_close_booking(booking: Booking) -> bool:
    """Replace delete with close once the line is approval-locked."""
    if not booking.is_approved:
        return False
    if booking.status in TERMINAL_STATUSES:
        return False
    return booking.status in CLOSEABLE_STATUSES


def booking_payload_differs(booking: Booking, booking_data: dict) -> bool:
    """Detect material changes in a nested booking update payload."""
    if booking.status in TERMINAL_STATUSES:
        return False

    if booking.booking_type_id != booking_data.get("booking_type"):
        return True
    if booking.sub_option_id != booking_data.get("sub_option"):
        return True

    new_cost = booking_data.get("estimated_cost")
    if new_cost is not None and str(booking.estimated_cost or 0) != str(new_cost):
        return True

    new_details = booking_data.get("booking_details") or {}
    if new_details != (booking.booking_details or {}):
        return True

    new_instruction = booking_data.get("special_instruction")
    if new_instruction is not None and (booking.special_instruction or "") != new_instruction:
        return True

    incoming_status = booking_data.get("status")
    if incoming_status and incoming_status != booking.status:
        # Closing via nested payload is not supported; applicant uses close API.
        if incoming_status == "closed":
            return False
        return True

    return False
