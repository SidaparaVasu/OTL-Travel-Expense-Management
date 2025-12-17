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
            external_profile__profile_type="booking_agent",
            external_profile__service_categories__contains=["flight_booking"],
            is_active=True
        )
        .select_related("external_profile")
        .first()
    )


def auto_forward_flight_train_bookings(application: TravelApplication, system_user):
    """
    Auto-assign flight & train bookings to central booking agent.
    Safe, idempotent, and auditable.
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
        .select_related("booking_type")
    )

    for booking in bookings:
        mode_name = booking.booking_type.name.lower()

        if "flight" not in mode_name and "train" not in mode_name:
            continue

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

        from apps.notifications.center import NotificationCenter
        NotificationCenter.notify(
            event_name="travel.booking.auto_assigned",
            reference={"type": "Booking", "id": booking.id},
            payload={
                "request_id": application.get_travel_request_id(),
                "booking_agent_id": agent.id,
                "employee_name": application.employee.get_full_name(),
                "booking_agent_name": agent.get_full_name(),
                "booking_id": booking.id,
                "action_required": "Start booking immediately",
            },
        )

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


