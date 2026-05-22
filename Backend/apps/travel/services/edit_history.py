"""
Record and validate travel application edit reasons.
"""
from django.core.exceptions import ValidationError

from apps.travel.models.edit_history import TravelApplicationEditHistory

MIN_EDIT_REASON_LENGTH = 10


def requires_edit_reason(application) -> bool:
    """Reason required when editing a previously submitted application."""
    return application.submitted_at is not None


def validate_edit_reason(application, edit_reason: str) -> str:
    if not requires_edit_reason(application):
        return ""
    cleaned = (edit_reason or "").strip()
    if len(cleaned) < MIN_EDIT_REASON_LENGTH:
        raise ValidationError(
            {
                "edit_reason": [
                    f"Please provide a detailed reason for this modification "
                    f"(at least {MIN_EDIT_REASON_LENGTH} characters)."
                ]
            }
        )
    return cleaned


def resolve_history_edit_count(application, needs_reapproval: bool) -> int:
    if needs_reapproval:
        return (application.edit_count or 0) + 1
    return application.edit_count or 0


def record_edit_history(
    application,
    user,
    reason: str,
    *,
    needs_reapproval: bool,
    system_change_summary: str,
    previous_status: str,
    status_after_update: str,
) -> TravelApplicationEditHistory:
    return TravelApplicationEditHistory.objects.create(
        travel_application=application,
        edit_count=resolve_history_edit_count(application, needs_reapproval),
        reason=reason,
        edited_by=user,
        needs_reapproval=needs_reapproval,
        system_change_summary=system_change_summary or "",
        previous_status=previous_status or "",
        status_after_update=status_after_update or "",
    )


def mark_edit_history_submitted(application) -> int:
    """After successful resubmit, stamp the latest open history row for this cycle."""
    from django.utils import timezone

    cycle = application.edit_count or 0
    latest = (
        TravelApplicationEditHistory.objects.filter(
            travel_application=application,
            edit_count=cycle,
            submitted_at__isnull=True,
        )
        .order_by("-created_at")
        .first()
    )
    if latest:
        latest.submitted_at = timezone.now()
        latest.save(update_fields=["submitted_at"])
        return 1
    return 0
