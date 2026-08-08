from apps.notifications.center import NotificationCenter

def notify_booking_agent_of_assignment(booking, agent_user, event_name=None, request=None):
    """
    Sends the appropriate notification to a booking agent based on the booking type.
    Handles Flight, Train, Hotel, and Vehicle bookings.

    Pass `request` (HttpRequest) when calling from a view so that any relative file
    URLs in the payload (e.g. bulk_booking_file_url) are upgraded to absolute URLs
    that work correctly in email links.
    """
    if not agent_user.email:
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(f"Skipping assignment notification for agent {agent_user.id}: No email found.")
        return

    # 1. Determine if duty slip should be attached (for vehicle/taxi).
    # Conveyance bookings (booking_category == 'conveyance') get a duty slip;
    # ticketing, accommodation, and bulk bookings do not.
    attach_duty_slip = False
    if not booking.booking_details.get("is_self_arranged"):
        if getattr(booking.booking_type, 'booking_category', None) == 'conveyance':
            attach_duty_slip = True

    # 2. Dynamic Event Selection (if not provided)
    if not event_name:
        b_type_name = (booking.booking_type.name or "").strip().lower()
        
        if "accommodation" in b_type_name:
            event_name = "travel.hotel.requested"
        elif any(word in b_type_name for word in ["flight", "train"]):
            event_name = "travel.ticket.requested"
        else:
            event_name = "travel.vehicle.requested"

    # 3. Get enriched payload from booking
    notification_payload = booking.get_booking_payload()

    # Upgrade bulk_booking_file_url to an absolute URL using the current request.
    # This ensures email links work correctly — the same URL the portal uses.
    if request and notification_payload.get("bulk_booking_file_url"):
        relative_url = notification_payload["bulk_booking_file_url"]
        if not relative_url.startswith("http"):
            notification_payload["bulk_booking_file_url"] = request.build_absolute_uri(relative_url)

    notification_payload.update({
        "booking_agent_id": agent_user.id,
        "booking_agent_name": agent_user.get_full_name(),
        "booking_id": booking.id,
        "attach_duty_slip": attach_duty_slip,
    })

    # 4. Notify
    NotificationCenter.notify(
        event_name=event_name,
        reference={"type": "Booking", "id": booking.id},
        payload=notification_payload
    )
