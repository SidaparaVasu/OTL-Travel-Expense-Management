from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.notifications.models import NotificationEvent
from apps.travel.models import TravelApplication

class Command(BaseCommand):
    help = 'Cleans up legacy travel settlement reminder events'

    def handle(self, *args, **options):
        # 1. Fetch pending settlement reminders
        pending_events = NotificationEvent.objects.filter(
            event_name='travel.settlement.reminder',
            is_resolved=False
        )
        
        resolved_count = 0
        today_date = timezone.now().date()
        
        for event in pending_events:
            try:
                # 2. Get the actual travel application
                app = TravelApplication.objects.get(id=event.reference_id)
                
                # The conditions to resolve:
                # - Already Sent At Least Once (reminder_index > 0)
                # - Already Settled
                # - Missed Deadline (Expired)
                # - Employee has already created a claim application (settlement initiated)
                from apps.expenses.models import ExpenseClaim
                claim_exists = ExpenseClaim.objects.filter(travel_application=app).exists()

                if (
                    event.reminder_index > 0
                    or app.is_settled
                    or claim_exists
                    or (app.settlement_due_date and today_date >= app.settlement_due_date)
                ):
                    event.is_resolved = True
                    event.save(update_fields=['is_resolved'])
                    resolved_count += 1
                    
            except TravelApplication.DoesNotExist:
                # If application doesn't exist anymore, it's safe to resolve the zombie event
                event.is_resolved = True
                event.save(update_fields=['is_resolved'])
                resolved_count += 1
                
        self.stdout.write(self.style.SUCCESS(f"Successfully resolved {resolved_count} legacy reminder events."))
