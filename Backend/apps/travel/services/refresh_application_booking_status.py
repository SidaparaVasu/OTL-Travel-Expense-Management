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

    # All done
    if statuses.issubset({"confirmed", "completed"}):
        # Only allow valid transitions
        if application.status in [
            "pending_travel_desk",
            "booking_in_progress",
            "approved_manager",
            "approved_chro",
            "approved_ceo",
        ]:
            application.status = "booked"
            application.save(update_fields=["status"])
        return

    # If any work remains and app was still before, move it to booking_in_progress
    if any(s in {"pending", "requested", "in_progress"} for s in statuses):
        if application.status in [
            "pending_travel_desk",
            "approved_manager",
            "approved_chro",
            "approved_ceo",
        ]:
            application.status = "booking_in_progress"
            application.save(update_fields=["status"])
