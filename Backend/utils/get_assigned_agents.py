from apps.travel.models import BookingAssignment

def get_assigned_booking_agent(application):
    assignment = (
        BookingAssignment.objects
        .filter(
            booking__trip_details__travel_application=application
        )
        .select_related("assigned_to")
        .order_by("-assigned_at")
        .first()
    )
    return assignment.assigned_to if assignment else None