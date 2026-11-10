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
        category = getattr(booking.booking_type, 'booking_category', None)
        if category == 'accommodation':
            event_name = "travel.hotel.requested"
        elif category == 'ticketing':
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

    if attach_duty_slip:
        cc_emails = []

        desk_user = booking.handling_travel_desk_user
        if desk_user and desk_user.email:
            cc_emails.append(desk_user.email)

        try:
            from apps.authentication.models.spoc import LocationSPOCAssignment
            from apps.authentication.models import UserRole

            emp_location = None
            profile = booking.trip_details.travel_application.employee.get_profile()
            if profile and profile.base_location:
                emp_location = profile.base_location

            if emp_location:
                spoc_user_ids = (
                    LocationSPOCAssignment.objects
                    .filter(locations=emp_location, is_active=True)
                    .exclude(user__id=desk_user.id if desk_user else None)
                    .values_list("user_id", flat=True)
                )
                if spoc_user_ids:
                    from apps.authentication.models import User
                    spoc_users = User.objects.filter(
                        id__in=spoc_user_ids,
                        is_active=True,
                    ).exclude(email="")
                    for u in spoc_users:
                        if u.email and u.email not in cc_emails:
                            cc_emails.append(u.email)
        except Exception:
            import logging
            logging.getLogger(__name__).exception("Failed to resolve SPOC CC for booking %s", booking.id)

        if cc_emails:
            notification_payload["cc_emails"] = cc_emails

    # 4. Notify
    NotificationCenter.notify(
        event_name=event_name,
        reference={"type": "Booking", "id": booking.id},
        payload=notification_payload
    )
