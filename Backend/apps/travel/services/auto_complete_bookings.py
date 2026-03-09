"""
Auto-complete bookings for trips that have ended.

This service marks all 'confirmed' bookings for past trips as 'completed'.
Can be called periodically via a scheduled task or management command.
"""

from django.utils import timezone
from apps.travel.models import Booking, TripDetails
import logging

logger = logging.getLogger(__name__)


def auto_complete_past_trip_bookings():
    """
    Marks all 'confirmed' bookings for trips that have ended as 'completed'.
    
    Returns:
        int: Number of bookings updated.
    """
    today = timezone.now().date()
    
    # 1. Update individual bookings: confirmed -> completed
    # Find trips that have ended (return_date is in the past)
    past_trip_ids = TripDetails.objects.filter(
        return_date__lt=today
    ).values_list('id', flat=True)
    
    updated_count = Booking.objects.filter(
        trip_details_id__in=past_trip_ids,
        status='confirmed'  # Only confirmed, not cancelled or already completed
    ).update(status='completed')
    
    # 2. Update parent applications: booked -> completed
    # This acts as a safety net if the one-off task failed or wasn't scheduled
    from apps.travel.models import TravelApplication
    
    # Logic: Applications that are in 'booked' state but their latest return datetime is in the past
    booked_apps = TravelApplication.objects.filter(status='booked')
    app_count = 0
    
    for app in booked_apps:
        end_dt = app.get_travel_end_datetime()
        if end_dt and timezone.now() >= end_dt:
            # 2.1 Update child bookings first
            Booking.objects.filter(
                trip_details__travel_application=app,
                status='confirmed'
            ).update(status='completed')
            
            # 2.2 Update application status
            app.status = 'completed'
            app.save(update_fields=['status'])
            app_count += 1
    
    if app_count > 0:
        logger.info(f"Auto-completed {app_count} TravelApplications.")

    logger.info(f"Auto-completed {updated_count} bookings for past trips.")
    return updated_count
