"""
Helpers for travel desk / booking agent display on application details and PDF reports.
"""
from django.db.models import Q

from apps.travel.models import Booking

TRAVEL_DESK_ROLE_NAMES = ("Travel Desk", "Global Travel Desk")


def user_is_travel_desk(user) -> bool:
    if not user:
        return False
    return any(user.has_role(role_name) for role_name in TRAVEL_DESK_ROLE_NAMES)


def user_received_booking_from_other_desk(application, user) -> bool:
    """
    True when another travel desk user explicitly forwarded a booking to `user`
    (excludes reclaim/assign-to-self, which must not demote primary queue access).
    """
    if not user:
        return False
    from apps.travel.models.audit import AuditLog

    bookings = Booking.objects.filter(
        trip_details__travel_application=application,
        handling_travel_desk_user=user,
        travel_desk_forwarded_at__isnull=False,
    ).only("id")

    for booking in bookings:
        log = (
            AuditLog.objects.filter(
                action="forward_to_travel_desk",
                changes__booking_id=booking.id,
            )
            .order_by("-timestamp")
            .first()
        )
        if not log or not log.changes:
            continue
        previous = log.changes.get("previous_handler")
        if previous and previous != user.id:
            return True
    return False


def is_primary_spoc_for_application(application, user) -> bool:
    """Primary desk queue owner unless they only hold bookings forwarded by others."""
    if not user_is_travel_desk(user):
        return False
    return not user_received_booking_from_other_desk(application, user)


def is_self_arranged_booking(booking: Booking) -> bool:
    return (
        booking.booking_details.get("is_self_arranged") is True or
        (booking.booking_type and booking.booking_type.is_self_arranged) or
        (booking.sub_option and booking.sub_option.is_self_arranged)
    )


def is_flight_or_train_booking(booking: Booking) -> bool:
    """Ticketing modes auto-forwarded to the central booking agent by the system."""
    if not booking.booking_type_id:
        return False
    mode = (booking.booking_type.name or "").lower()
    return "flight" in mode or "train" in mode


def resolve_primary_travel_desk_for_application(application):
    """
    Resolve the primary Travel Desk SPOC for an employee's branch location.
    """
    from apps.authentication.models.spoc import LocationSPOCAssignment

    employee = application.employee
    profile = getattr(employee, "get_profile", lambda: None)()
    if not profile or not profile.base_location_id:
        return None

    loc_id = profile.base_location_id
    assignment = (
        LocationSPOCAssignment.objects.filter(
            is_active=True,
            role__name__in=list(TRAVEL_DESK_ROLE_NAMES),
        )
        .filter(Q(is_global=True) | Q(locations__location_id=loc_id))
        .select_related("user")
        .order_by("-is_global", "id")
        .first()
    )
    if not assignment:
        return None
    spoc_user = assignment.user
    return spoc_user if user_is_travel_desk(spoc_user) else None


def resolve_handling_travel_desk_user(booking: Booking):
    """
    Booking handler first, then application-level travel desk owner.
    Ignores stored users who do not have a Travel Desk role (e.g. approvers
    incorrectly written by auto-forward).
    """
    if booking.handling_travel_desk_user_id:
        user = booking.handling_travel_desk_user
        if user_is_travel_desk(user):
            return user
    app = booking.trip_details.travel_application
    if app.travel_desk_user_id:
        user = app.travel_desk_user
        if user_is_travel_desk(user):
            return user
    return None


def initialize_travel_desk_ownership(application, desk_user=None):
    """
    Deprecated: do not auto-assign travel desk ownership on submit/approval.

    handling_travel_desk_user and travel_desk_user are set only when a travel desk
    user acts (ensure_handling_travel_desk_on_action, forward to desk, etc.).
    Applicant-facing desk contact uses resolve_primary_travel_desk_for_application
    at read time in build_travel_desk_payload.
    """
    return


def ensure_handling_travel_desk_on_action(booking: Booking, desk_user):
    """
    Keep travel desk contact on the booking when a travel desk user acts on it.
    Non–travel-desk users (approvers, applicants, etc.) are ignored.
    """
    if is_self_arranged_booking(booking) or not desk_user:
        return
    if not user_is_travel_desk(desk_user):
        return
    app = booking.trip_details.travel_application
    app_updates = []
    if not app.travel_desk_user_id or not user_is_travel_desk(app.travel_desk_user):
        app.travel_desk_user = desk_user
        app_updates.append("travel_desk_user")
    if app_updates:
        app.save(update_fields=app_updates)
    if not booking.handling_travel_desk_user_id or not user_is_travel_desk(
        booking.handling_travel_desk_user
    ):
        booking.handling_travel_desk_user = desk_user
        booking.save(update_fields=["handling_travel_desk_user"])


def build_travel_desk_payload(booking: Booking, format_datetime):
    if is_self_arranged_booking(booking):
        return None
    # Flight/train are system auto-forwarded to booking agent — no travel desk contact.
    if is_flight_or_train_booking(booking):
        return None

    app = booking.trip_details.travel_application
    user = resolve_handling_travel_desk_user(booking)
    if not user:
        user = resolve_primary_travel_desk_for_application(app)

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
