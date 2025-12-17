from apps.authentication.models import User

def get_travel_desk_users():
    return list(
        User.objects.filter(
            roles__role__name__iexact="Travel Desk",
            roles__is_active=True,
            is_active=True
        ).distinct()
    )