from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.travel.models import TravelApplication

class Command(BaseCommand):
    help = 'Check and notify overdue settlement deadlines'

    def handle(self, *args, **options):
        today = timezone.now().date()
        
        overdue_apps = TravelApplication.objects.filter(
            status='completed',
            is_settled=False,
            settlement_due_date__lt=today
        ).exclude(travel_for='guest')
        
        for app in overdue_apps:
            self.stdout.write(f'OVERDUE: {app.get_travel_request_id()} - {app.employee.username}')
            
            # Send expiration notification
            from apps.notifications.center import NotificationCenter
            NotificationCenter.notify(
                event_name='travel.settlement.expired',
                reference={'type': 'TravelApplication', 'id': app.id},
                payload={
                    'employee_id': app.employee.id,
                    'employee_name': app.employee.get_full_name(),
                    'request_id': app.get_travel_request_id(),
                    'settlement_due_date': str(app.settlement_due_date),
                    'purpose': app.purpose
                }
            )
            
        self.stdout.write(self.style.SUCCESS(f'Found {overdue_apps.count()} overdue settlements'))