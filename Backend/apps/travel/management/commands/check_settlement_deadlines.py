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
            
            # Send reminder email
            from apps.notifications.services import EmailNotificationService
            # TODO: Create settlement reminder template
            
        self.stdout.write(self.style.SUCCESS(f'Found {overdue_apps.count()} overdue settlements'))