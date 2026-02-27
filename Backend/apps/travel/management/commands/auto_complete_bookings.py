"""
Management command to auto-complete bookings for past trips
and auto-confirm self-arranged bookings.

Usage:
    python manage.py auto_complete_bookings

This command:
1. Marks all 'confirmed' bookings for trips that have ended as 'completed'.
2. Marks all 'self-arranged' accommodation bookings as 'confirmed' (fix for existing data).
3. Updates application status to 'booked' if all bookings are confirmed.

Intended to be run periodically via a cron job or scheduler.
"""

from django.core.management.base import BaseCommand
from django.db.models import Q, Count
from apps.travel.services.auto_complete_bookings import auto_complete_past_trip_bookings
from apps.travel.models import Booking, TravelApplication


class Command(BaseCommand):
    help = "Auto-complete bookings for trips that have ended and confirm self-arranged bookings."

    def handle(self, *args, **options):
        # 1. Auto-complete past trip bookings & applications
        completed_count = auto_complete_past_trip_bookings()
        self.stdout.write(
            self.style.SUCCESS(f"Successfully processed auto-completions for past trips. Marked booking(s) status as completed: {completed_count}")
        )
        
        # 2. Auto-confirm any self-arranged bookings that are still pending
        confirmed_count = Booking.objects.filter(
            status='pending',
            sub_option__name__icontains='self'
        ).update(status='confirmed')
        
        if confirmed_count > 0:
            self.stdout.write(
                self.style.SUCCESS(f"Successfully auto-confirmed {confirmed_count} self-arranged booking(s).")
            )
        
        # 3. Fix application statuses - applications in pending_travel_desk 
        #    with all bookings confirmed should be moved to 'booked'
        apps_updated = 0
        pending_apps = TravelApplication.objects.filter(status='pending_travel_desk')
        
        for app in pending_apps:
            # Check if there are any non-confirmed bookings
            has_pending = Booking.objects.filter(
                trip_details__travel_application=app,
                status__in=['pending', 'requested', 'in_progress']
            ).exists()
            
            if not has_pending:
                # All bookings are confirmed (or completed/cancelled) - move to booked
                has_confirmed = Booking.objects.filter(
                    trip_details__travel_application=app,
                    status='confirmed'
                ).exists()
                
                if has_confirmed:
                    app.status = 'booked'
                    app.save(update_fields=['status'])
                    apps_updated += 1
        
        if apps_updated > 0:
            self.stdout.write(
                self.style.SUCCESS(f"Successfully updated {apps_updated} application(s) to 'booked' status.")
            )
