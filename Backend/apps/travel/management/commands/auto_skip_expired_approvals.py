"""
Management command: auto_skip_expired_approvals

Marks TravelApprovalFlow entries as 'skipped' when:
  - status = 'pending'
  - travel_application.status = 'completed'
  - travel_application.settlement_due_date < today  (30-day window has passed)

Idempotency:
  - Only processes flows still in 'pending' state — already-skipped rows are ignored.
  - Safe to run multiple times per day; will not double-process.

Intended to run daily via cron AFTER auto_complete_bookings.

Usage:
    python manage.py auto_skip_expired_approvals
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.travel.models.approval import TravelApprovalFlow


class Command(BaseCommand):
    help = "Auto-skip pending TR approval flows whose settlement period has expired."

    def handle(self, *args, **options):
        today = timezone.now().date()

        # Find all pending required approval flows where the settlement window has closed.
        # We only target 'completed' TRs — if a TR is still in any other status,
        # the approval flow is still legitimately pending.
        expired_flows = TravelApprovalFlow.objects.filter(
            status="pending",
            is_required=True,
            travel_application__status="completed",
            travel_application__settlement_due_date__lt=today,
        ).select_related("travel_application", "approver")

        count = expired_flows.count()

        if count == 0:
            self.stdout.write("No expired approval flows found.")
            return

        skipped_ids = []
        for flow in expired_flows:
            flow.status = "skipped"
            flow.notes = (
                f"Auto-skipped: settlement period expired on "
                f"{flow.travel_application.settlement_due_date}. "
                f"No action taken by approver within 30 days."
            )
            flow.approved_at = timezone.now()
            flow.save(update_fields=["status", "notes", "approved_at"])
            skipped_ids.append(flow.id)

            self.stdout.write(
                f"  SKIPPED flow #{flow.id} | "
                f"TR: {flow.travel_application.get_travel_request_id()} | "
                f"Approver: {flow.approver.get_full_name()} | "
                f"Level: {flow.approval_level}"
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"Done. Auto-skipped {len(skipped_ids)} approval flow(s)."
            )
        )
