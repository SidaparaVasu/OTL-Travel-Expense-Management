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
    
    # Find trips that have ended (return_date is in the past)
    past_trip_ids = TripDetails.objects.filter(
        return_date__lt=today
    ).values_list('id', flat=True)

    # Update bookings for those trips: confirmed -> completed
    updated_count = Booking.objects.filter(
        trip_details_id__in=past_trip_ids,
        status='confirmed'  # Only confirmed, not cancelled or already completed
    ).update(status='completed')
    
    logger.info(f"Auto-completed {updated_count} bookings for past trips.")
    return updated_count
