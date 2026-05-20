"""
Helpers for travel desk / booking agent display on application details and PDF reports.
"""
from django.db.models import Q

from apps.travel.models import Booking


def is_self_arranged_booking(booking: Booking) -> bool:
    if booking.sub_option and "self" in (booking.sub_option.name or "").lower():
        return True
    return bool(booking.booking_details.get("is_self_arranged", False))


def resolve_primary_travel_desk_for_application(application):
    """
    Resolve the primary Travel Desk SPOC for an employee's branch location.
    """
    from apps.authentication.models.spoc import LocationSPOCAssignment

    employee = application.employee
    profile = getattr(employee, "get_profile", lambda: None)()
    if not profile or not getattr(profile, "base_location_id", None):
        return None

    loc_id = profile.base_location_id
    assignment = (
        LocationSPOCAssignment.objects.filter(
            is_active=True,
            role__name__in=["Travel Desk", "Global Travel Desk"],
        )
        .filter(Q(is_global=True) | Q(locations__id=loc_id))
        .select_related("user")
        .order_by("-is_global", "id")
        .first()
    )
    return assignment.user if assignment else None


def resolve_handling_travel_desk_user(booking: Booking):
    """Booking handler first, then application-level travel desk owner."""
    if booking.handling_travel_desk_user_id:
        return booking.handling_travel_desk_user
    app = booking.trip_details.travel_application
    if app.travel_desk_user_id:
        return app.travel_desk_user
    return None


def initialize_travel_desk_ownership(application, desk_user=None):
    """
    Set application.travel_desk_user and per-booking handling_travel_desk_user
    when a request enters the travel desk queue.
    """
    if desk_user is None:
        desk_user = resolve_primary_travel_desk_for_application(application)
    if not desk_user:
        return

    if not application.travel_desk_user_id:
        application.travel_desk_user = desk_user
        application.save(update_fields=["travel_desk_user"])

    for booking in Booking.objects.filter(
        trip_details__travel_application=application
    ).select_related("sub_option"):
        if is_self_arranged_booking(booking):
            continue
        if not booking.handling_travel_desk_user_id:
            booking.handling_travel_desk_user = desk_user
            booking.save(update_fields=["handling_travel_desk_user"])


def ensure_handling_travel_desk_on_action(booking: Booking, desk_user):
    """Keep travel desk contact on the booking when a desk user acts on it."""
    if is_self_arranged_booking(booking) or not desk_user:
        return
    app = booking.trip_details.travel_application
    app_updates = []
    if not app.travel_desk_user_id:
        app.travel_desk_user = desk_user
        app_updates.append("travel_desk_user")
    if app_updates:
        app.save(update_fields=app_updates)
    if not booking.handling_travel_desk_user_id:
        booking.handling_travel_desk_user = desk_user
        booking.save(update_fields=["handling_travel_desk_user"])


def build_travel_desk_payload(booking: Booking, format_datetime):
    if is_self_arranged_booking(booking):
        return None

    user = resolve_handling_travel_desk_user(booking)
    if not user:
        try:
            assignment = booking.assignment
            if assignment and assignment.assigned_by_id:
                user = assignment.assigned_by
        except Exception:
            pass

    if not user:
        return {
            "user": "",
            "user_email": "",
            "user_contact": "",
            "desk_status": "With Travel Desk",
            "forwarded_to_desk_at": "",
        }

    payload = {
        "user": user.get_full_name() or user.username,
        "user_email": user.email or "",
        "user_contact": user.mobile_no or "",
        "desk_status": "",
        "forwarded_to_desk_at": format_datetime(booking.travel_desk_forwarded_at)
        if booking.travel_desk_forwarded_at
        else "",
    }

    # Backward-compatible keys used by older frontend (mapped to clearer semantics)
    payload["forwarded_at"] = payload["forwarded_to_desk_at"]
    return payload


def build_agent_action_completed_at(assignment, format_datetime):
    """
    Agent 'completed' for applicant view = confirmed or cancelled.
    """
    booking = assignment.booking
    if booking.status == "confirmed" and booking.booked_at:
        return format_datetime(booking.booked_at)
    if booking.status == "cancelled":
        ts = assignment.completed_at or booking.updated_at
        return format_datetime(ts) if ts else ""
    if assignment.completed_at:
        return format_datetime(assignment.completed_at)
    return ""
