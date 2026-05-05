from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.notifications.models import NotificationEvent
from apps.travel.models import TravelApplication


class Command(BaseCommand):
    help = (
        'Cleans up duplicate travel.settlement.expired notification events. '
        'Keeps the oldest event per travel application and resolves all subsequent duplicates. '
        'Also resolves events where the employee has already submitted a claim.'
    )

    def handle(self, *args, **options):
        from apps.expenses.models import ExpenseClaim

        # Fetch all expired settlement events grouped by reference_id
        all_events = (
            NotificationEvent.objects
            .filter(event_name='travel.settlement.expired')
            .order_by('reference_id', 'created_at')
        )

        resolved_count = 0
        seen_reference_ids = set()

        for event in all_events:
            travel_app_id = event.reference_id

            # --- Check if the travel application still exists ---
            try:
                app = TravelApplication.objects.get(id=travel_app_id)
            except TravelApplication.DoesNotExist:
                # Zombie event — application no longer exists, resolve it
                if not event.is_resolved:
                    event.is_resolved = True
                    event.save(update_fields=['is_resolved'])
                    resolved_count += 1
                    self.stdout.write(
                        f'  Resolved zombie event id={event.id} (TR {travel_app_id} not found)'
                    )
                continue

            # --- Check if employee already has a claim (settlement initiated) ---
            claim_exists = ExpenseClaim.objects.filter(travel_application=app).exists()
            if claim_exists:
                if not event.is_resolved:
                    event.is_resolved = True
                    event.save(update_fields=['is_resolved'])
                    resolved_count += 1
                    self.stdout.write(
                        f'  Resolved event id={event.id} for TR {travel_app_id} '
                        f'(claim already exists)'
                    )
                continue

            # --- Deduplication: keep the first (oldest) event, resolve the rest ---
            if travel_app_id in seen_reference_ids:
                # This is a duplicate — resolve it
                if not event.is_resolved:
                    event.is_resolved = True
                    event.save(update_fields=['is_resolved'])
                    resolved_count += 1
                    self.stdout.write(
                        f'  Resolved duplicate event id={event.id} for TR {travel_app_id}'
                    )
            else:
                # First occurrence for this travel application — keep it
                seen_reference_ids.add(travel_app_id)
                self.stdout.write(
                    f'  Keeping oldest event id={event.id} for TR {travel_app_id}'
                )

        self.stdout.write(
            self.style.SUCCESS(
                f'Done. Resolved {resolved_count} duplicate/stale expired settlement events.'
            )
        )
