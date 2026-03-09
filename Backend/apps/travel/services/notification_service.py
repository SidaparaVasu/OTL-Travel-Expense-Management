from apps.notifications.center import NotificationCenter

def notify_booking_agent_of_assignment(booking, agent_user, event_name=None):
    """
    Sends the appropriate notification to a booking agent based on the booking type.
    Handles Flight, Train, Hotel, and Vehicle bookings.
    """
    if not agent_user.email:
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(f"Skipping assignment notification for agent {agent_user.id}: No email found.")
        return

    # 1. Determine if duty slip should be attached (for vehicle/taxi)
    attach_duty_slip = False
    if not booking.booking_details.get("is_self_arranged"):
        excluded_types = ["Flight", "Train", "Accommodation", "Bulk Booking"]
        b_type = (booking.booking_type.name or "").strip()
        if b_type not in excluded_types:
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
    # Note: get_booking_payload is expected to be on the Booking model
    notification_payload = booking.get_booking_payload()
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
