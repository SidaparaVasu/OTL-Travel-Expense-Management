from apps.travel.models import TravelApplication, Booking

def refresh_application_booking_status(application: TravelApplication):
    """
    Recompute high-level booking status for an application based on child bookings.
    - If all bookings are confirmed/completed -> mark application as 'booked'
    - If any bookings are pending/requested/in_progress -> keep 'booking_in_progress'
    (Extend later for auto 'completed', etc.)
    """
    qs = Booking.objects.filter(trip_details__travel_application=application)
    if not qs.exists():
        return

    statuses = set(qs.values_list("status", flat=True))

    # 1. Handle "All Cancelled" Scenario
    if statuses == {"cancelled"}:
        if application.status != "cancelled":
            application.status = "cancelled"
            application.save(update_fields=["status"])
        return

    # 2. Handle "Processing" Scenario
    # If any work remains, mark it as 'booking_in_progress'
    if any(s in {"pending", "requested", "in_progress"} for s in statuses):
        if application.status in [
            "pending_travel_desk",
            "approved_manager",
            "approved_chro",
            "approved_ceo",
        ]:
            application.status = "booking_in_progress"
            application.save(update_fields=["status"])
        return

    # 3. Handle "All Finished" Scenario (mixture of confirmed/completed/cancelled/closed)
    # If no work remains and we have at least one confirmed/completed/closed booking
    finished_subset = {"confirmed", "completed", "cancelled", "closed"}
    has_positive_resolution = any(s in {"confirmed", "completed", "closed"} for s in statuses)
    all_work_done = not any(s in {"pending", "requested", "in_progress"} for s in statuses)

    if all_work_done and statuses.issubset(finished_subset) and has_positive_resolution:
        # Only allow valid transitions
        if application.status in [
            "pending_travel_desk",
            "booking_in_progress",
            "approved_manager",
            "approved_chro",
            "approved_ceo",
        ]:
            # [ENHANCED] Proactive check: if travel has already ended, move to completed
            # Otherwise, move to 'booked'
            from django.utils import timezone
            end_datetime = application.get_travel_end_datetime()
            
            if end_datetime and timezone.now() >= end_datetime:
                application.status = "completed"
            else:
                application.status = "booked"
                
            application.save(update_fields=["status"])
        return
