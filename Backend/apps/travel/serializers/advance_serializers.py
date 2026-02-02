from rest_framework import serializers
from apps.travel.models import TravelApplication, AdvanceProcessing, TripDetails, Booking
from apps.authentication.serializers import UserSerializer

class AdvanceProcessingSerializer(serializers.ModelSerializer):
    processed_by = UserSerializer(read_only=True)
    
    class Meta:
        model = AdvanceProcessing
        fields = [
            'id', 'status', 'processed_amount', 'payment_mode', 
            'reference_number', 'remarks', 'processed_by', 'processed_at', 'updated_at'
        ]
        read_only_fields = ['id', 'processed_by', 'processed_at', 'updated_at']

class AdvanceWorkspaceListSerializer(serializers.ModelSerializer):
    """Serializer for the List View of Advance Workspace"""
    employee_name = serializers.CharField(source='employee.get_full_name', read_only=True)
    employee_id = serializers.CharField(source='employee.employee_id', read_only=True)
    department = serializers.CharField(source='employee.department.name', read_only=True, default="")
    grade = serializers.CharField(source='employee.grade.name', read_only=True, default="")
    
    travel_request_id = serializers.CharField(source='get_travel_request_id', read_only=True)
    travel_dates = serializers.SerializerMethodField()
    advance_amount = serializers.SerializerMethodField() # Override model field
    
    # Advance Info
    advance_status = serializers.SerializerMethodField()
    advance_processing = AdvanceProcessingSerializer(read_only=True)

    class Meta:
        model = TravelApplication
        fields = [
            'id', 'travel_request_id', 'employee_name', 'employee_id', 
            'department', 'grade', 'created_at', 'status', 
            'advance_amount', 'travel_dates', 'advance_status', 'advance_processing'
        ]

    def get_travel_dates(self, obj):
        start = obj.get_travel_start_date()
        end = obj.get_travel_end_date()
        return {
            "start": start,
            "end": end
        }
        
    def get_advance_amount(self, obj):
        total = 0
        for trip in obj.trip_details.all():
            for booking in trip.bookings.all():
                 total += booking.estimated_cost or 0
        return total

    def get_advance_status(self, obj):
        if hasattr(obj, 'advance_processing'):
            return obj.advance_processing.status
        return 'pending'

class AdvanceBookingBreakdownSerializer(serializers.ModelSerializer):
    """Helper to serialize booking advance info"""
    type = serializers.CharField(source='booking_type.name')
    sub_option = serializers.CharField(source='sub_option.name', default="")
    advance_amount = serializers.DecimalField(max_digits=10, decimal_places=2, required=False)

    class Meta:
        model = Booking
        fields = ['id', 'type', 'sub_option', 'estimated_cost', 'advance_amount', 'booking_reference']


class AdvanceRequisitionDetailSerializer(serializers.ModelSerializer):
    """Serializer for the Detail View (One Pager)"""
    employee = UserSerializer(read_only=True)
    travel_request_id = serializers.CharField(source='get_travel_request_id', read_only=True)
    advance_processing = AdvanceProcessingSerializer(read_only=True)
    advance_amount = serializers.SerializerMethodField()
    general_ledger = serializers.StringRelatedField()
    
    # Breakdown
    bookings_breakdown = serializers.SerializerMethodField()
    
    class Meta:
        model = TravelApplication
        fields = [
            'id', 'travel_request_id', 'employee', 'purpose', 
            'created_at', 'status', 'advance_amount', 'advance_processing',
            'bookings_breakdown', 'internal_order', 'general_ledger'
        ]

    def get_advance_amount(self, obj):
        total = 0
        for trip in obj.trip_details.all():
            for booking in trip.bookings.all():
                 total += booking.estimated_cost or 0
        return total

    def get_bookings_breakdown(self, obj):
        bookings_data = []
        for trip in obj.trip_details.all():
            for booking in trip.bookings.all():
                if booking.estimated_cost and booking.estimated_cost > 0:
                    bookings_data.append({
                        'type': booking.booking_type.name,
                        'sub_option': booking.sub_option.name if booking.sub_option else '',
                        'estimated_cost': booking.estimated_cost,
                        'advance_amount': booking.estimated_cost, # Map estimated to advance
                        'booking_reference': booking.booking_reference
                    })
        return bookings_data
