from rest_framework import viewsets, permissions, filters
from apps.travel.models.traveler import GuestProfile
from apps.travel.serializers.guest_serializers import GuestProfileSerializer

class GuestProfileViewSet(viewsets.ModelViewSet):
    """
    CRUD for Guest Profiles.
    Users can see all guests created under their company.
    """
    serializer_class = GuestProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ['first_name', 'last_name', 'email', 'contact_number']

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return GuestProfile.objects.none()
        
        # Filter by user's company if available
        queryset = GuestProfile.objects.filter(is_active=True)
        
        # Use get_profile() helper method from User model
        profile = user.get_profile()
        
        if profile and hasattr(profile, 'company') and profile.company:
            return queryset.filter(company=profile.company)
        
        # Fallback: if no company (e.g. admin or external), return created_by
        return queryset.filter(created_by=user)

    def perform_create(self, serializer):
        user = self.request.user
        profile = user.get_profile()
        company = profile.company if profile and hasattr(profile, 'company') else None
        serializer.save(created_by=user, company=company)
