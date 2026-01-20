from rest_framework import serializers
from apps.authentication.models import User, BookingAgentProfile
from apps.travel.models import Booking

class AgentAnalyticsListSerializer(serializers.ModelSerializer):
    """Serializer for agent list with summary stats"""
    organization_name = serializers.CharField(source='booking_agent_profile.organization_name', read_only=True)
    contact_person = serializers.SerializerMethodField()
    phone = serializers.SerializerMethodField()
    email = serializers.CharField(read_only=True) # Use user email
    
    # Computed fields
    active_bookings = serializers.IntegerField(read_only=True)
    completed_bookings = serializers.IntegerField(read_only=True)
    avg_response_time = serializers.FloatField(read_only=True)
    
    class Meta:
        model = User
        fields = [
            'id', 'username', 'first_name', 'last_name', 'email',
            'organization_name', 'contact_person', 'phone',
            'active_bookings', 'completed_bookings', 'avg_response_time'
        ]

    def get_contact_person(self, obj):
        return None

    def get_phone(self, obj):
        return None

class AgentAnalyticsDetailSerializer(AgentAnalyticsListSerializer):
    """Detailed analytics for a specific agent"""
    address = serializers.CharField(source='booking_agent_profile.address', read_only=True)
    profile_type = serializers.SerializerMethodField()
    
    # Additional stats
    today_assignments = serializers.IntegerField(read_only=True)
    pending_requests = serializers.IntegerField(read_only=True)
    
    class Meta(AgentAnalyticsListSerializer.Meta):
        fields = AgentAnalyticsListSerializer.Meta.fields + [
            'address', 'profile_type', 'today_assignments', 'pending_requests'
        ]

    def get_profile_type(self, obj):
        profile = getattr(obj, "booking_agent_profile", None)
        if profile:
             first_service = profile.services.first()
             return first_service.profile_type.name if first_service else "Booking Agent"
        return None

class AgentRecentBookingSerializer(serializers.ModelSerializer):
    """Simple booking serializer for recent activity"""
    trip_id = serializers.CharField(source='trip_details.travel_application.get_travel_request_id', read_only=True)
    employee_name = serializers.CharField(source='trip_details.travel_application.employee.get_full_name', read_only=True)
    from_loc = serializers.CharField(source='trip_details.from_location.city_name', read_only=True)
    to_loc = serializers.CharField(source='trip_details.to_location.city_name', read_only=True)
    travel_date = serializers.DateField(source='trip_details.departure_date', read_only=True)
    
    # Show names instead of IDs
    booking_type = serializers.CharField(source='booking_type.name', read_only=True)
    sub_option = serializers.CharField(source='sub_option.name', read_only=True)
    
    class Meta:
        model = Booking
        fields = [
            'id', 'trip_id', 'employee_name', 'booking_type', 'sub_option',
            'status', 'created_at', 'booked_at', 'travel_date',
            'from_loc', 'to_loc'
        ]
