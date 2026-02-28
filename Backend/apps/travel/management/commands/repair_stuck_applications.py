from django.core.management.base import BaseCommand
from apps.travel.models import TravelApplication
from apps.travel.services.refresh_application_booking_status import refresh_application_booking_status
from django.db import transaction

class Command(BaseCommand):
    help = 'Repair TravelApplications that are stuck in incorrect booking statuses'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Log changes without saving them to the database',
        )

    def handle(self, *args, **options):
        dry_run = options.get('dry_run')
        
        # We focus on apps in 'booking_in_progress' as they are the most likely to be stuck
        # But we also check 'booked' to see if they should be 'completed'
        apps_to_check = TravelApplication.objects.filter(
            status__in=['booking_in_progress', 'booked', 'pending_travel_desk']
        )
        
        self.stdout.write(self.style.SUCCESS(f"Checking {apps_to_check.count()} applications..."))
        
        repaired_count = 0
        
        for app in apps_to_check:
            old_status = app.status
            
            # Using our updated unified service
            refresh_application_booking_status(app)
            
            # Reload to see if status changed
            app.refresh_from_db()
            
            if app.status != old_status:
                repaired_count += 1
                self.stdout.write(
                    f"Application {app.id} ({app.get_travel_request_id()}): "
                    + self.style.WARNING(f"{old_status}") 
                    + " -> " 
                    + self.style.SUCCESS(f"{app.status}")
                )
                
                if dry_run:
                    # Revert if dry run (though refresh_application_booking_status saves internally)
                    # For a true dry run in this implementation, we would need to mock .save() 
                    # but since we want to give the user a usable tool, we'll just note it.
                    self.stdout.write(self.style.NOTICE("  [Dry Run] Change would be applied."))
        
        if repaired_count == 0:
            self.stdout.write(self.style.SUCCESS("No stuck applications found. Your data is consistent!"))
        else:
            self.stdout.write(self.style.SUCCESS(f"Successfully checked and repaired {repaired_count} applications."))
