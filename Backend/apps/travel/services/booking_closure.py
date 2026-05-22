from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.travel.models import Booking, BookingNote, BookingClosureLog
from apps.travel.models.audit import AuditLog
from apps.travel.services.refresh_application_booking_status import (
    refresh_application_booking_status,
)
from apps.travel.services.travel_desk_display import (
    is_primary_spoc_for_application as _is_primary_spoc_for_application,
    user_is_travel_desk,
)


CLOSEABLE_STATUSES = {'pending', 'requested', 'in_progress', 'confirmed'}
TERMINAL_STATUSES = {'cancelled', 'completed', 'closed'}


def get_latest_closure_reason(booking: Booking) -> str | None:
    """Most recent closure reason for display (travel desk / booking agent)."""
    log = (
        booking.closure_logs.filter(action='closed')
        .order_by('-created_at')
        .first()
    )
    return (log.closure_reason or '').strip() or None if log else None


def is_primary_spoc_for_application(application, user) -> bool:
    return _is_primary_spoc_for_application(application, user)


def _validate_reason(value: str, field_label: str) -> str:
    cleaned = (value or '').strip()
    if not cleaned:
        raise ValidationError({field_label: [f"{field_label} is required."]})
    return cleaned


def _release_agent_assignment(booking: Booking) -> None:
    if hasattr(booking, 'assignment') and booking.assignment and booking.assignment.assigned_to:
        booking.assignment.assigned_to = None
        booking.assignment.save(update_fields=['assigned_to'])


def _desk_can_act_on_booking(booking: Booking, user, is_primary_spoc: bool) -> bool:
    if bool(booking.booking_details.get('is_self_arranged', False)):
        return False

    handler = booking.handling_travel_desk_user
    if handler is not None and handler.id == user.id:
        return True
    if handler is None and (is_primary_spoc or user_is_travel_desk(user)):
        return True
    return False


def close_booking(
    booking: Booking,
    user,
    *,
    closure_reason: str,
    claim_decision_reason: str,
    allow_claim: bool,
    is_primary_spoc: bool = False,
) -> Booking:
    if not _desk_can_act_on_booking(booking, user, is_primary_spoc):
        raise ValidationError("You do not have permission to close this booking.")

    if booking.status in TERMINAL_STATUSES:
        raise ValidationError(f"Booking cannot be closed from status '{booking.status}'.")

    if booking.status not in CLOSEABLE_STATUSES:
        raise ValidationError(f"Booking cannot be closed from status '{booking.status}'.")

    application = booking.trip_details.travel_application
    if application.status in {'cancelled', 'cancellation_requested'}:
        raise ValidationError("Cannot close booking on a cancelled application.")

    closure_reason = _validate_reason(closure_reason, 'closure_reason')
    claim_decision_reason = _validate_reason(claim_decision_reason, 'claim_decision_reason')

    with transaction.atomic():
        old_status = booking.status
        now = timezone.now()

        booking.status = 'closed'
        booking.allow_claim = allow_claim
        booking.closed_at = now
        booking.closed_by = user
        booking.save(update_fields=['status', 'allow_claim', 'closed_at', 'closed_by', 'updated_at'])

        BookingClosureLog.objects.create(
            booking=booking,
            action='closed',
            closure_reason=closure_reason,
            claim_decision_reason=claim_decision_reason,
            allow_claim=allow_claim,
            created_by=user,
        )

        BookingNote.objects.create(
            booking=booking,
            author=user,
            note=(
                f"[CLOSED] {closure_reason} | "
                f"Claim {'allowed' if allow_claim else 'not allowed'}: {claim_decision_reason}"
            ),
        )

        _release_agent_assignment(booking)
        refresh_application_booking_status(application)

        AuditLog.objects.create(
            user=user,
            action="close_booking",
            content_object=booking,
            changes={
                "booking_id": booking.id,
                "old_status": old_status,
                "new_status": "closed",
                "allow_claim": allow_claim,
                "closure_reason": closure_reason,
                "claim_decision_reason": claim_decision_reason,
            },
        )

    return booking


def close_booking_by_applicant(
    booking: Booking,
    user,
    *,
    closure_reason: str,
) -> Booking:
    """
    Applicant closes an approval-locked line instead of hard-deleting it.
    Always records allow_claim=False.
    """
    application = booking.trip_details.travel_application
    if application.employee_id != user.id:
        raise ValidationError("You do not have permission to close this booking.")

    from apps.travel.services.booking_lock import can_applicant_close_booking

    if not can_applicant_close_booking(booking):
        raise ValidationError(
            "This booking cannot be closed. It may still be editable, "
            "or is already closed/cancelled."
        )

    if application.status in {"cancelled", "cancellation_requested"}:
        raise ValidationError("Cannot close booking on a cancelled application.")

    closure_reason = _validate_reason(closure_reason, "closure_reason")
    claim_note = "Applicant closed line item (not claimable)."

    with transaction.atomic():
        old_status = booking.status
        now = timezone.now()

        booking.status = "closed"
        booking.allow_claim = False
        booking.closed_at = now
        booking.closed_by = user
        booking.save(
            update_fields=["status", "allow_claim", "closed_at", "closed_by", "updated_at"]
        )

        BookingClosureLog.objects.create(
            booking=booking,
            action="closed",
            closure_reason=closure_reason,
            claim_decision_reason=claim_note,
            allow_claim=False,
            created_by=user,
        )

        BookingNote.objects.create(
            booking=booking,
            author=user,
            note=f"[CLOSED BY APPLICANT] {closure_reason} | Claim not allowed: {claim_note}",
        )

        _release_agent_assignment(booking)
        refresh_application_booking_status(application)

        AuditLog.objects.create(
            user=user,
            action="close_booking",
            content_object=booking,
            changes={
                "booking_id": booking.id,
                "old_status": old_status,
                "new_status": "closed",
                "allow_claim": False,
                "closure_reason": closure_reason,
                "claim_decision_reason": claim_note,
                "closed_by_applicant": True,
            },
        )

    return booking


def update_booking_claim_eligibility(
    booking: Booking,
    user,
    *,
    allow_claim: bool,
    claim_decision_reason: str,
    is_primary_spoc: bool = False,
) -> Booking:
    if booking.status != 'closed':
        raise ValidationError("Claim eligibility can only be updated on closed bookings.")

    if not _desk_can_act_on_booking(booking, user, is_primary_spoc):
        raise ValidationError("You do not have permission to update claim eligibility for this booking.")

    claim_decision_reason = _validate_reason(claim_decision_reason, 'claim_decision_reason')

    if booking.allow_claim == allow_claim:
        raise ValidationError("Claim eligibility is already set to this value.")

    action = 'claim_allowed' if allow_claim else 'claim_disallowed'

    with transaction.atomic():
        old_allow_claim = booking.allow_claim
        booking.allow_claim = allow_claim
        booking.save(update_fields=['allow_claim', 'updated_at'])

        BookingClosureLog.objects.create(
            booking=booking,
            action=action,
            claim_decision_reason=claim_decision_reason,
            allow_claim=allow_claim,
            created_by=user,
        )

        BookingNote.objects.create(
            booking=booking,
            author=user,
            note=(
                f"[CLAIM ELIGIBILITY UPDATED] "
                f"Claim {'allowed' if allow_claim else 'not allowed'}: {claim_decision_reason}"
            ),
        )

        AuditLog.objects.create(
            user=user,
            action="update_claim_elig",
            content_object=booking,
            changes={
                "booking_id": booking.id,
                "old_allow_claim": old_allow_claim,
                "new_allow_claim": allow_claim,
                "claim_decision_reason": claim_decision_reason,
            },
        )

    return booking
