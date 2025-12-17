from decimal import Decimal
from django.utils import timezone
from django.db.models import Q

from apps.master_data.models import TravelPolicyMaster
from apps.travel.models import TravelApprovalFlow
from apps.travel.models.audit import AuditLog
from apps.notifications.center import NotificationCenter
from utils.get_ceo_approver import get_ceo_approver


def get_effective_amount_policy(booking):
    """
    Fetch active amount_limit policy for this booking's travel mode.
    """
    today = timezone.now().date()

    return (
        TravelPolicyMaster.objects
        .filter(
            policy_type="amount_limit",
            is_active=True,
            travel_mode=booking.booking_type,
            effective_from__lte=today
        )
        .filter(Q(effective_to__isnull=True) | Q(effective_to__gte=today))
        .order_by("-effective_from")
        .first()
    )


def requires_ceo_escalation(application, booking):
    """
    Returns (bool, reason_string)
    """

    policy = get_effective_amount_policy(booking)
    if not policy:
        return False, None

    params = policy.rule_parameters or {}
    max_amount = Decimal(str(params.get("max_amount", 0)))

    estimated = Decimal(str(booking.estimated_cost or 0))
    actual = Decimal(str(booking.actual_cost or 0))

    # Check if CEO already approved
    ceo_already_approved = application.approval_flows.filter(
        approval_level="ceo",
        status="approved"
    ).exists()

    # -----------------------------
    # Rule A — Crossed threshold
    # -----------------------------
    if estimated <= max_amount and actual > max_amount:
        return True, "actual_cost_crossed_policy_limit"

    # -----------------------------
    # Rule B — Large delta after CEO approval
    # -----------------------------
    reapproval = params.get("reapproval", {})
    if ceo_already_approved and reapproval.get("enabled"):

        delta_type = reapproval.get("threshold_type", "percentage")
        delta_value = Decimal(str(reapproval.get("threshold_value", 0)))

        if delta_type == "percentage":
            allowed = estimated + (estimated * delta_value / 100)
        else:  # absolute
            allowed = estimated + delta_value

        if actual > allowed:
            return True, "actual_cost_exceeded_allowed_delta"

    return False, None


def escalate_application_to_ceo(application, booking, triggered_by, reason):
    """
    Push application back to CEO approval due to cost escalation.
    """

    # Reset app state
    application.status = "pending_ceo"
    application.current_approver = None
    application.save(update_fields=["status", "current_approver"])

    # Create CEO approval flow if missing
    TravelApprovalFlow.objects.get_or_create(
        travel_application=application,
        approval_level="ceo",
        defaults={
            "approver": TravelApprovalFlow.objects
                .filter(approval_level="ceo")
                .first()
                .approver,
            "sequence": 999,
            "status": "pending",
            "is_required": True,
            "triggered_by_rule": reason,
        }
    )

    ceo_flow = get_ceo_approver(application)
    if not ceo_flow:
        raise RuntimeError("CEO approver not configured for this application")

    ceo_user = ceo_flow.approver

    # Send notification to CEO for reapproval
    NotificationCenter.notify(
        event_name="travel.ceo.reapproval_required",
        reference={"type": "TravelRequest", "id": application.id},
        payload={
            "request_id": application.get_travel_request_id(),
            "employee_name": application.employee.get_full_name(),
            "estimated_cost": str(booking.estimated_cost),
            "actual_cost": str(booking.actual_cost),
            "reason": "Actual booking cost exceeded policy limit",
            "action_required": "Approve revised cost",
        },
        recipients=[ceo_user],
    )

    # Notify Applicant (awareness)
    NotificationCenter.notify(
        event_name="travel.cost.escalation",
        reference={"type": "Booking", "id": booking.id},
        payload={
            "request_id": application.get_travel_request_id(),
            "actual_cost": str(booking.actual_cost),
            "reason": "Booking paused due to cost escalation",
        },
        recipients=[application.employee],
    )

    # Audit
    AuditLog.objects.create(
        user=triggered_by,
        action="cost_escalation",
        content_object=booking,
        changes={
            "booking_id": booking.id,
            "application_id": application.id,
            "estimated_cost": str(booking.estimated_cost),
            "actual_cost": str(booking.actual_cost),
            "reason": reason,
        },
    )
