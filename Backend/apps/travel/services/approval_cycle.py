"""
Approval cycle: one TravelApprovalFlow row per (application, approver, level).
edit_count bumps on resubmit after prior submission; flows update in place.
"""
from django.utils import timezone

from apps.travel.models import TravelApprovalFlow


def current_cycle(application) -> int:
    return application.edit_count or 0


def current_flows_for_application(application):
    """Flows for the application's current modification version."""
    return application.approval_flows.filter(edit_count=current_cycle(application))


def all_flows_for_history(application):
    return application.approval_flows.all().select_related("approver").order_by(
        "sequence", "approval_level"
    )


def resolve_cycle_on_submit(application) -> int:
    """
    First submit keeps edit_count=0.
    Resubmit (submitted_at already set) increments before rebuilding flows.
    """
    if application.submitted_at:
        application.edit_count = (application.edit_count or 0) + 1
        application.save(update_fields=["edit_count", "updated_at"])
    return current_cycle(application)


def bump_existing_flows_to_cycle(application, cycle: int) -> None:
    """Align all existing rows to the new version; approved steps must re-approve."""
    for flow in application.approval_flows.all():
        if flow.status == "approved":
            flow.edit_count = cycle
            flow.status = "pending"
            flow.approved_at = None
            flow.save(update_fields=["edit_count", "status", "approved_at"])
        elif flow.status == "pending":
            flow.edit_count = cycle
            flow.save(update_fields=["edit_count"])


def upsert_approval_flow(
    *,
    travel_application,
    cycle: int,
    approver,
    approval_level: str,
    sequence: int,
    status: str = "pending",
    **kwargs,
) -> TravelApprovalFlow:
    """
    One row per approver/level. On resubmit, update in place — do not create duplicates.
    """
    flow, created = TravelApprovalFlow.objects.get_or_create(
        travel_application=travel_application,
        approver=approver,
        approval_level=approval_level,
        defaults={
            "sequence": sequence,
            "edit_count": cycle,
            "status": status,
            **kwargs,
        },
    )
    if not created:
        flow.sequence = sequence
        flow.edit_count = cycle
        for key, value in kwargs.items():
            setattr(flow, key, value)
        if status == "approved":
            flow.status = "approved"
        elif flow.status == "approved" and status == "pending":
            flow.status = "pending"
            flow.approved_at = None
        else:
            flow.status = status
        flow.save()
    return flow


def sync_approval_chain(application, approver_entries, *, is_resubmission: bool) -> list:
    """
    Build or refresh approval flows for the current cycle.
    Returns list of flow instances in chain order.
    """
    cycle = current_cycle(application)
    if is_resubmission:
        bump_existing_flows_to_cycle(application, cycle)

    chain_keys = set()
    flows = []

    for entry in approver_entries:
        key = (entry.user.id, entry.level)
        chain_keys.add(key)
        flow = upsert_approval_flow(
            travel_application=application,
            cycle=cycle,
            approver=entry.user,
            approval_level=entry.level,
            sequence=entry.sequence,
            status="pending",
            can_view=entry.can_view,
            can_approve=entry.can_approve,
            is_required=entry.is_required,
            triggered_by_rule=getattr(entry, "triggered_by_rule", ""),
        )
        flows.append(flow)

    for flow in application.approval_flows.all():
        if (flow.approver_id, flow.approval_level) not in chain_keys:
            if flow.edit_count == cycle and flow.status not in ("rejected", "skipped"):
                flow.status = "skipped"
                flow.save(update_fields=["status"])

    return flows
