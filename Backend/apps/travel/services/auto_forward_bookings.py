from django.utils import timezone
from apps.authentication.models import User
from apps.travel.models import Booking, BookingAssignment, TravelApplication
from apps.travel.models.audit import AuditLog


def get_central_flight_train_agent():
    """
    Returns the single booking agent responsible for flight & train bookings.
    """
    return (
        User.objects
        .filter(
            user_type="external",
            booking_agent_profile__services__service_categories__service_category__code="flight_booking",
            is_active=True,
            booking_agent_profile__is_active=True,
        )
        .select_related("booking_agent_profile")
        .distinct()
        .first()
    )


def auto_forward_flight_train_bookings(application: TravelApplication, system_user, request=None):
    """
    Auto-assign flight & train bookings to central booking agent.
    Safe, idempotent, and auditable.

    Pass `request` when calling from a view so that bulk file URLs in email
    notifications are built as absolute URLs (same as the portal uses).
    """

    agent = get_central_flight_train_agent()
    if not agent:
        return

    forwarded_any = False

    bookings = (
        Booking.objects
        .filter(
            trip_details__travel_application=application,
            status="pending"
        )
        .exclude(booking_details__is_self_arranged=True)  # Exclude self-arranged
        .exclude(booking_type__is_self_arranged=True)
        .exclude(sub_option__is_self_arranged=True)
        .select_related("booking_type")
    )

    for booking in bookings:
        if getattr(booking.booking_type, 'booking_category', None) != 'ticketing':
            continue

        if booking.handling_travel_desk_user_id:
            booking.handling_travel_desk_user = None
            booking.save(update_fields=["handling_travel_desk_user"])

        BookingAssignment.objects.update_or_create(
            booking=booking,
            defaults={
                "assigned_to": agent,
                "assigned_by": system_user,
                "assignment_scope": "single_booking",
                "accepted_at": None,
                "completed_at": None,
            }
        )

        booking.status = "requested"
        booking.save(update_fields=["status"])

        forwarded_any = True

        if agent.email:
            from apps.travel.services.notification_service import notify_booking_agent_of_assignment
            notify_booking_agent_of_assignment(booking, agent, event_name="travel.booking.auto_assigned", request=request)
        else:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Skipping auto-assignment notification for agent {agent.id}: No email found.")

        AuditLog.objects.create(
            user=system_user,
            action="auto_assign_booking",
            content_object=booking,
            changes={
                "booking_id": booking.id,
                "application_id": application.id,
                "agent_id": agent.id,
                "reason": "Auto-forwarded flight/train booking (priority)",
            },
        )

    # IMPORTANT: Update application status ONCE
    if forwarded_any and application.status == "pending_travel_desk":
        application.status = "booking_in_progress"
        application.save(update_fields=["status"])

        AuditLog.objects.create(
            user=system_user,
            action="application_status_updated",
            content_object=application,
            changes={
                "from": "pending_travel_desk",
                "to": "booking_in_progress",
                "reason": "Auto-forwarded flight/train bookings",
            },
        )


def auto_confirm_self_arranged_bookings(application: TravelApplication, system_user):
    """
    Auto-confirm 'Self-Arranged' accommodation bookings.
    These don't need vendor assignment - they go directly to 'confirmed' status.
    
    Also checks if all bookings are now confirmed and updates application status to 'booked'.
    """
    bookings = (
        Booking.objects
        .filter(
            trip_details__travel_application=application,
            status="pending"
        )
        .select_related("sub_option", "booking_type")
    )

    confirmed_count = 0
    for booking in bookings:
        from apps.travel.services.travel_desk_display import is_self_arranged_booking

        if is_self_arranged_booking(booking):
            booking.status = "confirmed"
            booking.save(update_fields=["status"])
            confirmed_count += 1

            AuditLog.objects.create(
                user=system_user,
                action="auto_confirm_booking",
                content_object=booking,
                changes={
                    "booking_id": booking.id,
                    "application_id": application.id,
                    "reason": f"Auto-confirmed personal/self-arranged booking ({booking.booking_type.name if booking.booking_type else 'N/A'})",
                },
            )

    # Check if ALL bookings are now confirmed (no pending bookings remain)
    # If so, transition application directly to 'booked' status
    if confirmed_count > 0:
        pending_bookings = Booking.objects.filter(
            trip_details__travel_application=application,
            status__in=["pending", "requested", "in_progress"]
        ).exists()
        
        if not pending_bookings:
            # All bookings are confirmed - skip booking_in_progress and go to booked
            application.status = "booked"
            application.save(update_fields=["status"])
            
            AuditLog.objects.create(
                user=system_user,
                action="application_status_updated",
                content_object=application,
                changes={
                    "from": "pending_travel_desk",
                    "to": "booked",
                    "reason": "All bookings confirmed (self-arranged) - no vendor booking required",
                },
            )

    return confirmed_count
