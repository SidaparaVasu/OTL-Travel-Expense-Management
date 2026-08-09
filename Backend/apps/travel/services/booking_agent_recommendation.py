from collections import defaultdict
from django.db.models import Q

from apps.travel.models import Booking, TravelApplication
from apps.authentication.models import User


def get_recommended_booking_agents(application: TravelApplication):
    """
    Recommendation rules:

    - Flight / Train:
        Single central booking agent (auto-forwarded).

    - Accommodation:
        1) Prefer hotel agents serving the booking city.
        2) If none found, return all hotel agents (non-recommended).

    - Conveyance / others:
        Currently ignored.
    """

    bookings = (
        Booking.objects
        .filter(trip_details__travel_application=application)
        .select_related(
            "trip_details__to_location",
            "booking_type",
        )
    )

    response = {
        "flight_train": None,
        "accommodation": [],
    }

    # --------------------------------------------------
    # Central flight/train agent (used only for flight/train)
    # --------------------------------------------------
    central_agent = (
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

    # --------------------------------------------------
    # Flight / Train bookings
    # --------------------------------------------------
    flight_train_bookings = [
        b for b in bookings
        if getattr(b.booking_type, 'booking_category', None) == 'ticketing'
    ]

    if flight_train_bookings and central_agent:
        response["flight_train"] = {
            "agent": {
                "id": central_agent.id,
                "name": central_agent.get_full_name() or central_agent.username,
                "organization": central_agent.booking_agent_profile.organization_name,
            },
            "booking_ids": [b.id for b in flight_train_bookings],
        }

    # --------------------------------------------------
    # Accommodation bookings (city-wise)
    # --------------------------------------------------
    city_booking_map = defaultdict(list)

    for booking in bookings:
        if getattr(booking.booking_type, 'booking_category', None) == 'accommodation':
            city_booking_map[booking.trip_details.to_location].append(booking)

    for city, city_bookings in city_booking_map.items():

        # Preferred: hotel agents serving the city
        # Logic: Find agents with 'hotel_booking' service AND (serves_all_cities=True OR service_cities=city)
        city_hotel_agents = (
            User.objects
            .filter(
                user_type="external",
                booking_agent_profile__services__service_categories__service_category__code__in=["hotel_booking", "arc_hotel_booking", "guest_house_booking"],
                is_active=True,
                booking_agent_profile__is_active=True,
            )
            .filter(
                Q(booking_agent_profile__services__serves_all_cities=True) |
                Q(booking_agent_profile__services__service_cities=city)
            )
            .select_related("booking_agent_profile")
            .distinct()
        )

        agents = city_hotel_agents
        is_recommended = True

        # Fallback: all hotel agents (ignoring city if none found - though logic above covers wildcards)
        if not city_hotel_agents.exists():
             # Strict fallback - getting any hotel agent
            agents = (
                User.objects
                .filter(
                    user_type="external",
                    booking_agent_profile__services__service_categories__service_category__code__in=["hotel_booking", "arc_hotel_booking", "guest_house_booking"],
                    is_active=True,
                    booking_agent_profile__is_active=True,
                )
                .select_related("booking_agent_profile")
                .distinct()
            )
            is_recommended = False

        if agents.exists():
            response["accommodation"].append({
                "city": {
                    "id": city.id,
                    "name": city.city_name,
                },
                "agents": [
                    {
                        "id": agent.id,
                        "name": agent.get_full_name() or agent.username,
                        "organization": agent.booking_agent_profile.organization_name,
                        "is_recommended": is_recommended,
                    }
                    for agent in agents
                ],
                "booking_ids": [b.id for b in city_bookings],
            })

    return response
