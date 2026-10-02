import logging

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.travel.models.hrms_leave import HRMSLeaveRecord
from apps.travel.services.hrms_leave_service import HRMSLeaveService

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = (
        "Retry all FAILED HRMS OD Leave records by re-calling the OdLeaveApprove API. "
        "Successful retries update the existing record to ACTIVE. "
        "Optionally filter by a specific travel application ID."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be retried without making any API calls or DB changes.',
        )
        parser.add_argument(
            '--app-id',
            type=int,
            default=None,
            metavar='TRAVEL_APP_ID',
            help='Only retry failed records for a specific TravelApplication ID.',
        )
        parser.add_argument(
            '--limit',
            type=int,
            default=None,
            metavar='N',
            help='Process at most N failed records (useful for incremental retries).',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        app_id  = options['app_id']
        limit   = options['limit']

        # ── 1. Build queryset ────────────────────────────────────────────────────
        base_qs = (
            HRMSLeaveRecord.objects
            .select_related(
                'travel_application',
                'travel_application__employee',
            )
            .filter(status='FAILED')
            .order_by('created_at')   # oldest-first so we replay in chronological order
        )

        if app_id:
            base_qs = base_qs.filter(travel_application_id=app_id)

        total = base_qs.count()

        if limit:
            qs = base_qs[:limit]
        else:
            qs = base_qs

        self.stdout.write(
            self.style.MIGRATE_HEADING(
                f"\n{'[DRY RUN] ' if dry_run else ''}Found {total} FAILED HRMS leave record(s)"
                + (f" (processing first {limit})" if limit and limit < total else "")
                + ".\n"
            )
        )

        if total == 0:
            self.stdout.write(self.style.SUCCESS("Nothing to do. All HRMS leave records look good!"))
            return

        succeeded   = 0
        still_failed = 0
        skipped     = 0

        # ── 2. Iterate and retry each failed record ──────────────────────────────
        for record in qs:
            travel_app = record.travel_application
            employee   = travel_app.employee

            label = (
                f"Record #{record.id} | TR #{travel_app.id} "
                f"({travel_app.get_travel_request_id() if hasattr(travel_app, 'get_travel_request_id') else ''}) "
                f"| empId={getattr(employee, 'hrms_id', 'N/A')}"
            )

            # ── Eligibility guards ───────────────────────────────────────────────
            if travel_app.travel_for not in ('self', 'self_guest'):
                self.stdout.write(
                    self.style.WARNING(
                        f"  SKIP  {label} — travel_for='{travel_app.travel_for}' (not eligible for OD leave)"
                    )
                )
                skipped += 1
                continue

            if not employee or not employee.hrms_id:
                self.stdout.write(
                    self.style.WARNING(f"  SKIP  {label} — employee has no hrms_id")
                )
                skipped += 1
                continue

            start_date = travel_app.get_travel_start_date()
            end_date   = travel_app.get_travel_end_date()
            if not start_date or not end_date:
                self.stdout.write(
                    self.style.WARNING(f"  SKIP  {label} — missing travel dates")
                )
                skipped += 1
                continue

            # ── Skip if an ACTIVE record already exists (from a prior successful retry) ──
            active_exists = travel_app.hrms_leave_records.filter(status='ACTIVE').exists()
            if active_exists:
                self.stdout.write(
                    self.style.SUCCESS(
                        f"  DONE  {label} — already has an ACTIVE record; annotating this FAILED record as superseded."
                    )
                )
                if not dry_run:
                    record.error_message = (
                        f"[retry_failed_hrms_leaves @ {timezone.now().isoformat()}] "
                        "Superseded by an existing ACTIVE record."
                    )
                    record.save(update_fields=['error_message', 'updated_at'])
                skipped += 1
                continue

            self.stdout.write(f"  RETRY {label}")

            if dry_run:
                self.stdout.write(self.style.NOTICE("         → [Dry Run] Would call OdLeaveApprove API."))
                succeeded += 1   # optimistic for dry-run display
                continue

            # ── 3. Re-call the HRMS API via the existing service ─────────────────
            try:
                new_record = HRMSLeaveService.approve_od_leave(
                    travel_app=travel_app,
                    approver=employee,       # self-approval context
                    client_ip="127.0.0.1",
                )

                if new_record and new_record.status == 'ACTIVE':
                    # Annotate the old FAILED record so the admin panel stays clean
                    record.error_message = (
                        f"[retry_failed_hrms_leaves @ {timezone.now().isoformat()}] "
                        f"Superseded by new ACTIVE record #{new_record.id} "
                        f"(leaveApprovalId={new_record.leave_approval_id})."
                    )
                    record.save(update_fields=['error_message', 'updated_at'])

                    self.stdout.write(
                        self.style.SUCCESS(
                            f"         SUCCESS — new HRMSLeaveRecord #{new_record.id} "
                            f"(leaveApprovalId={new_record.leave_approval_id})"
                        )
                    )
                    succeeded += 1
                else:
                    err = (
                        getattr(new_record, 'error_message', 'Unknown error')
                        if new_record else 'No record returned'
                    )
                    self.stdout.write(
                        self.style.ERROR(f"         FAILED again — {err}")
                    )
                    still_failed += 1

            except Exception as exc:
                logger.exception(
                    "[retry_failed_hrms_leaves] Unexpected error retrying record #%s: %s",
                    record.id,
                    exc,
                )
                self.stdout.write(
                    self.style.ERROR(f"         EXCEPTION — {exc}")
                )
                still_failed += 1

        # ── 4. Summary ───────────────────────────────────────────────────────────
        self.stdout.write("")
        self.stdout.write(self.style.MIGRATE_HEADING("─── Retry Summary ───────────────────"))
        self.stdout.write(self.style.SUCCESS(  f"  Succeeded   : {succeeded}"))
        self.stdout.write(self.style.WARNING(  f"  Skipped     : {skipped}"))
        if still_failed:
            self.stdout.write(self.style.ERROR(f"  Still FAILED : {still_failed}"))
        else:
            self.stdout.write(self.style.SUCCESS("  Still FAILED : 0"))
        self.stdout.write("")

        if still_failed and not dry_run:
            self.stdout.write(
                self.style.WARNING(
                    "Some records could not be retried. "
                    "Check the Django logs or the HRMS Leave Records admin panel for details."
                )
            )
