from rest_framework import serializers
from ..models import AccommodationBooking, VehicleBooking, TravelDocument
from ..business_logic.booking_engine import AccommodationBookingEngine, VehicleBookingEngine

# DEPRECATED: This model/component is not in use anymore and is marked for deletion.
# Status: Deprecated since June 2, 2026 — no active usage recorded.
class AccommodationBookingSerializer(serializers.ModelSerializer):
    guest_house_name = serializers.CharField(source='guest_house.name', read_only=True)
    arc_hotel_name = serializers.CharField(source='arc_hotel.name', read_only=True)
    location_name = serializers.CharField(source='trip_details.to_location.city_name', read_only=True)
    
    class Meta:
        model = AccommodationBooking
        fields = [
            'id', 'accommodation_type', 'check_in_date', 'check_out_date',
            'nights', 'guest_count', 'guest_house', 'guest_house_name',
            'arc_hotel', 'arc_hotel_name', 'hotel_name', 'hotel_contact',
            'hotel_address', 'status', 'room_type', 'special_requests',
            'rate_per_night', 'total_cost', 'confirmation_number',
            'booking_reference', 'location_name', 'confirmed_at'
        ]
        read_only_fields = ['total_cost', 'confirmed_at']

# DEPRECATED: This model/component is not in use anymore and is marked for deletion.
# Status: Deprecated since June 2, 2026 — no active usage recorded.
class VehicleBookingSerializer(serializers.ModelSerializer):
    spoc_name = serializers.CharField(source='assigned_spoc.spoc_user.get_full_name', read_only=True)
    spoc_contact = serializers.CharField(source='assigned_spoc.phone_number', read_only=True)
    
    class Meta:
        model = VehicleBooking
        fields = [
            'id', 'vehicle_type', 'pickup_location', 'drop_location',
            'pickup_date', 'pickup_time', 'return_date', 'return_time',
            'estimated_distance', 'passenger_count', 'special_requirements',
            'assigned_spoc', 'spoc_name', 'spoc_contact', 'vendor_name',
            'driver_name', 'driver_phone', 'vehicle_number', 'own_car_details',
            'status', 'duty_slip_number', 'estimated_cost'
        ]

class TravelDocumentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source='uploaded_by.get_full_name', read_only=True)
    file_url = serializers.SerializerMethodField()
    
    class Meta:
        model = TravelDocument
        fields = [
            'id', 'document_type', 'title', 'description', 'file',
            'file_url', 'file_size', 'file_type', 'uploaded_by',
            'uploaded_by_name', 'uploaded_at', 'related_booking', 'is_active'
        ]
        read_only_fields = ['file_size', 'file_type', 'uploaded_by', 'uploaded_at']
    
    def get_file_url(self, obj):
        if obj.file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.file.url)
        return None

    def get_location(self, obj):
        if obj.sub_option and obj.trip_details and obj.trip_details.to_location:
            return obj.trip_details.to_location.city_name
        return None 

# DEPRECATED: This model/component is not in use anymore and is marked for deletion.
# Status: Deprecated since June 2, 2026 — no active usage recorded.
class AccommodationRequestSerializer(serializers.Serializer):
    trip_id = serializers.IntegerField()
    guest_count = serializers.IntegerField(default=1, min_value=1)
    special_requests = serializers.CharField(required=False, allow_blank=True)
    room_type = serializers.CharField(required=False, allow_blank=True)

# DEPRECATED: This model/component is not in use anymore and is marked for deletion.
# Status: Deprecated since June 2, 2026 — no active usage recorded.
class VehicleRequestSerializer(serializers.Serializer):
    trip_id = serializers.IntegerField()
    vehicle_type = serializers.ChoiceField(choices=VehicleBooking.VEHICLE_TYPES)
    pickup_location = serializers.CharField(max_length=200)
    drop_location = serializers.CharField(max_length=200)
    pickup_date = serializers.DateField()
    pickup_time = serializers.TimeField()
    return_date = serializers.DateField(required=False)
    return_time = serializers.TimeField(required=False)
    passenger_count = serializers.IntegerField(default=1, min_value=1)
    estimated_distance = serializers.DecimalField(
        max_digits=8, decimal_places=2, 
        required=False, allow_null=True
    )
    special_requirements = serializers.CharField(required=False, allow_blank=True)
    own_car_details = serializers.JSONField(required=False)