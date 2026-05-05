from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.notifications.models import NotificationEvent, NotificationRule
from apps.travel.models import TravelApplication


class Command(BaseCommand):
    help = (
        'Backfills a resolved NotificationEvent receipt for every overdue travel application '
        'that has been receiving daily settlement-expired emails but has no event record. '
        'This stops the daily cron from re-firing for those applications. '
        'Also resolves any genuine duplicate events that may exist.'
    )

    def handle(self, *args, **options):
        from apps.expenses.models import ExpenseClaim

        today = timezone.now().date()
        backfilled_count = 0
        resolved_count = 0

        # ------------------------------------------------------------------
        # Part 1: Backfill receipt events for applications that have been
        # getting daily emails but have no NotificationEvent row yet.
        # These are the applications currently affected by the bug.
        # ------------------------------------------------------------------

        # Applications that already have an event (skip them)
        already_has_event_ids = set(
            NotificationEvent.objects.filter(
                event_name='travel.settlement.expired'
            ).values_list('reference_id', flat=True)
        )

        # Applications where the employee has already submitted a claim
        claimed_app_ids = set(
            ExpenseClaim.objects.values_list('travel_application_id', flat=True)
        )

        # All overdue applications with no event record
        affected_apps = TravelApplication.objects.filter(
            status='completed',
            is_settled=False,
            settlement_due_date__lt=today,
        ).exclude(
            travel_for='guest'
        ).exclude(
            id__in=already_has_event_ids
        )

        rule = NotificationRule.objects.filter(
            event_name='travel.settlement.expired'
        ).first()

        for app in affected_apps:
            # If a claim exists, the employee has already settled — mark resolved
            # and skip (no need to ever send this notification)
            is_resolved = ExpenseClaim.objects.filter(travel_application=app).exists()

            NotificationEvent.objects.create(
                event_name='travel.settlement.expired',
                reference_type='TravelApplication',
                reference_id=app.id,
                rule=rule,
                data={
                    'employee_id': app.employee.id,
                    'employee_name': app.employee.get_full_name(),
                    'request_id': app.get_travel_request_id(),
                    'settlement_due_date': str(app.settlement_due_date),
                    'purpose': app.purpose,
                    '_backfilled': True,
                },
                next_reminder_at=None,
                reminder_index=0,
                is_resolved=True,  # always resolved — one-shot receipt
            )
            backfilled_count += 1
            self.stdout.write(
                f'  Backfilled receipt event for TR {app.get_travel_request_id()} '
                f'(id={app.id})'
                + (' [claim exists]' if is_resolved else '')
            )

        # ------------------------------------------------------------------
        # Part 2: Resolve any genuine duplicate events that do exist
        # (handles edge cases where the event was created more than once).
        # ------------------------------------------------------------------

        all_events = (
            NotificationEvent.objects
            .filter(event_name='travel.settlement.expired')
            .order_by('reference_id', 'created_at')
        )

        seen_reference_ids = set()

        for event in all_events:
            travel_app_id = event.reference_id

            if travel_app_id in seen_reference_ids:
                # Duplicate — resolve it
                if not event.is_resolved:
                    event.is_resolved = True
                    event.save(update_fields=['is_resolved'])
                    resolved_count += 1
                    self.stdout.write(
                        f'  Resolved duplicate event id={event.id} for TR id={travel_app_id}'
                    )
            else:
                seen_reference_ids.add(travel_app_id)

        self.stdout.write(
            self.style.SUCCESS(
                f'Done. Backfilled {backfilled_count} receipt events, '
                f'resolved {resolved_count} duplicate events.'
            )
        )
