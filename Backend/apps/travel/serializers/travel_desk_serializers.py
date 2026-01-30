from rest_framework import serializers
from apps.travel.models import TravelApplication, TripDetails, Booking, BookingAssignment, BookingNote
from apps.travel.models.audit import AuditLog
from apps.travel.serializers.travel_serializers import TripDetailsSerializer, BookingSerializer


class ApplicationDetailSerializer(serializers.ModelSerializer):
    trips = TripDetailsSerializer(source='trip_details', many=True)
    bookings = serializers.SerializerMethodField()
    approval_flow = serializers.SerializerMethodField()
    audit_logs = serializers.SerializerMethodField()

    class Meta:
        model = TravelApplication
        fields = [
            'id', 'travel_request_id', 'employee_name', 'employee_grade',
            'purpose', 'internal_order', 'general_ledger',
            'sanction_number', 'advance_amount', 'status', 'created_at',
            'submitted_at', 'trips', 'bookings', 'approval_flow', 'audit_logs'
        ]

    def get_bookings(self, app):
        bookings = Booking.objects.filter(
            trip_details__travel_application=app
        ).select_related('trip_details')

        grouped = {}
        for b in bookings:
            group = b.get_booking_type_display()
            grouped.setdefault(group, []).append(BookingSerializer(b).data)

        return grouped

    def get_approval_flow(self, app):
        return [
            {
                "approver": f"{step.approver.first_name} {step.approver.last_name}",
                "level": step.level,
                "status": step.status,
                "updated_at": step.updated_at
            }
            for step in app.approval_flow.all().order_by("level")
        ]

    def get_audit_logs(self, app):
        return [
            {
                "action": log.action,
                "message": log.message,
                "timestamp": log.created_at,
                "performed_by": str(log.performed_by)
            }
            for log in AuditLog.objects.filter(application=app).order_by('-created_at')[:20]
        ]
    
class TravelDeskBookingSerializer(serializers.ModelSerializer):
    trip_id = serializers.IntegerField(source="trip_details.id", read_only=True)
    trip_segment = serializers.SerializerMethodField()
    booking_type_name = serializers.CharField(source="booking_type.name", read_only=True)
    sub_option_name = serializers.CharField(source="sub_option.name", read_only=True)
    status_display = serializers.SerializerMethodField()
    assigned_agent = serializers.SerializerMethodField()
    booking_details = serializers.JSONField()

    class Meta:
        model = Booking
        fields = [
            "id", "trip_id", "trip_segment", "booking_type", "booking_type_name", "sub_option", "sub_option_name", 
            "status", "status_display", "estimated_cost", "actual_cost", "booking_reference", "vendor_reference", 
            "booking_file", "special_instruction", "created_at", "updated_at", "booked_at", "assigned_agent", 
            "booking_details",
            "meal_preference",
            "can_reassign",
            "notes",
            "requested_vehicle_type",
        ]
    
    meal_preference = serializers.SerializerMethodField()
    can_reassign = serializers.SerializerMethodField()
    notes = serializers.SerializerMethodField()
    requested_vehicle_type = serializers.SerializerMethodField()

    def get_meal_preference(self, obj):
        return obj.booking_details.get('meal_preference', "")
    
    def get_notes(self, obj):
        notes = BookingNote.objects.filter(booking=obj).select_related("author").order_by("-created_at")
        from apps.booking_agent.serializers.agent_serializers import BookingNoteSerializer
        return BookingNoteSerializer(notes, many=True).data

    def get_requested_vehicle_type(self, obj):
        assignment = (
            BookingAssignment.objects
            .filter(booking=obj)
            .select_related("requested_vehicle_type")
            .order_by("-assigned_at")
            .first()
        )
        if assignment and assignment.requested_vehicle_type:
            return {
                "id": assignment.requested_vehicle_type.id,
                "name": assignment.requested_vehicle_type.name
            }
        return None

    def get_trip_segment(self, obj):
        td = obj.trip_details
        if not td or not td.from_location or not td.to_location:
            return None
        return f"{td.from_location.city_name} → {td.to_location.city_name}"

    def get_status_display(self, obj):
        return obj.get_status_display()

    def get_assigned_agent(self, obj):
        assignment = (
            BookingAssignment.objects
            .filter(booking=obj).order_by('-assigned_at')
            .select_related("assigned_to")
            .first()
        )
        if not assignment or not assignment.assigned_to:
            return None
        user = assignment.assigned_to
        data = {
            "id": user.id,
            "name": user.get_full_name() or user.username,
            "scope": assignment.assignment_scope,
            "assigned_at": assignment.assigned_at,
        }

        # Fetch external profile details if available
        if hasattr(user, 'booking_agent_profile'):
            profile = user.booking_agent_profile
            data.update({
                "organization_name": profile.organization_name,
                "contact_person": None, # Removed
                "phone": None, # Removed
                "email": user.email, # Use user email
                "address": profile.address,
            })
        
        return data

    def get_can_reassign(self, obj):
        # Logic: Can only reassign if pending or requested.
        # Not allowed if in_progress, confirmed, completed, cancelled.
        return obj.status in ['pending', 'requested']

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        
        # Add place_name for self-arranged accommodation
        booking_details = ret.get('booking_details') or {}
        place_id = booking_details.get('place')
        
        if place_id:
            try:
                # Check if it's already a name or an ID
                # If it's numeric, try to resolve it
                if str(place_id).isdigit():
                    from apps.master_data.models import CityMaster
                    city = CityMaster.objects.filter(id=int(place_id)).first()
                    if city:
                        booking_details['place_name'] = city.city_name
                        # Also optionally update place to be the name if desired, 
                        # but adding place_name is safer for backward compatibility.
                        # Frontend should check place_name or place.
                        ret['booking_details'] = booking_details
            except Exception:
                pass
        
        return ret


class TravelDeskTripSerializer(serializers.ModelSerializer):
    from_location_name = serializers.CharField(source="from_location.city_name", read_only=True)
    to_location_name = serializers.CharField(source="to_location.city_name", read_only=True)
    bookings = TravelDeskBookingSerializer(many=True, read_only=True)
    duration_days = serializers.SerializerMethodField()
    city_category = serializers.SerializerMethodField()

    class Meta:
        model = TripDetails
        fields = [
            "id", "from_location", "from_location_name", "to_location", "to_location_name", 
            "departure_date", "return_date", "start_time", "end_time", 
            "duration_days", "city_category", "bookings",
        ]

    def get_from_location_name(self, obj):
        if obj.from_location:
            return f"{obj.from_location.city_name}, {obj.from_location.state.state_name}"
        return None

    def get_to_location_name(self, obj):
        if obj.to_location:
            return f"{obj.to_location.city_name}, {obj.to_location.state.state_name}"
        return None

    def get_duration_days(self, obj):
        if obj.departure_date and obj.return_date:
            delta = obj.return_date - obj.departure_date
            return delta.days + 1
        return None

    def get_city_category(self, obj):
        return obj.from_location.category.name if obj.from_location else None


class TravelDeskApplicationListSerializer(serializers.ModelSerializer):
    travel_request_id = serializers.CharField(read_only=True)
    employee_name = serializers.SerializerMethodField()
    employee_grade = serializers.CharField(read_only=True)
    from_location = serializers.SerializerMethodField()
    to_location = serializers.SerializerMethodField()
    departure_date = serializers.SerializerMethodField()
    return_date = serializers.SerializerMethodField()
    status_label = serializers.SerializerMethodField()
    total_bookings = serializers.SerializerMethodField()
    pending_bookings = serializers.SerializerMethodField()
    booked_bookings = serializers.SerializerMethodField()

    class Meta:
        model = TravelApplication
        fields = [
            "id", "travel_request_id", "employee", "employee_name", "employee_grade", 
            "from_location", "to_location", "departure_date", "return_date", 
            "purpose", "estimated_total_cost", "status", "status_label", "submitted_at", 
            "total_bookings", "pending_bookings", "booked_bookings",
        ]

    def get_employee_name(self, obj):
        return getattr(obj.employee, "get_full_name", lambda: obj.employee.username)()
    
    def get_employee_grade(self, obj):
        return getattr(obj.employee, "get_grade", lambda: obj.employee.grade)()

    def get_status_label(self, obj):
        return obj.get_status_display()

    def get_total_bookings(self, obj):
        return Booking.objects.filter(trip_details__travel_application=obj).count()

    def get_pending_bookings(self, obj):
        return Booking.objects.filter(
            trip_details__travel_application=obj,
            status__in=["pending", "requested"]
        ).count()

    def get_booked_bookings(self, obj):
        return Booking.objects.filter(
            trip_details__travel_application=obj,
            status__in=["confirmed", "completed"]
        ).count()
    
    def get_first_trip(self, obj):
        trip = obj.trip_details.order_by("id").first()
        return trip
    
    def get_from_location(self, obj):
        trip = self.get_first_trip(obj)
        if not trip:
            return None
        return f"{trip.from_location.city_name}, {trip.from_location.state.state_name}"

    def get_to_location(self, obj):
        trip = self.get_first_trip(obj)
        if not trip:
            return None
        return f"{trip.to_location.city_name}, {trip.to_location.state.state_name}"

    def get_departure_date(self, obj):
        trip = self.get_first_trip(obj)
        return trip.departure_date if trip else None

    def get_return_date(self, obj):
        trip = self.get_first_trip(obj)
        return trip.return_date if trip else None


class TravelDeskApplicationDetailSerializer(serializers.ModelSerializer):
    travel_request_id = serializers.CharField(source='get_travel_request_id', read_only=True)
    employee_name = serializers.SerializerMethodField()
    employee_grade = serializers.CharField(read_only=True)
    status_label = serializers.SerializerMethodField()
    trips = TravelDeskTripSerializer(source="trip_details", many=True, read_only=True)

    class Meta:
        model = TravelApplication
        fields = [
            "id", "travel_request_id", "employee", "employee_name", "employee_grade", 
            "purpose", "internal_order", "general_ledger", "sanction_number", 
            "advance_amount", "estimated_total_cost", "status", "status_label", 
            "submitted_at", "created_at", "updated_at", "trips",
        ]

    def get_employee_name(self, obj):
        return getattr(obj.employee, "get_full_name", lambda: obj.employee.username)()

    def get_status_label(self, obj):
        return obj.get_status_display()


class BookingAssignmentSerializer(serializers.ModelSerializer):
    """
    Used by Travel Desk to assign one or many bookings to a booking agent.
    """

    booking_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        write_only=True,
        help_text="List of Booking IDs to assign"
    )
    scope = serializers.ChoiceField(choices=BookingAssignment.ASSIGNMENT_SCOPE_CHOICES)
    booking_agent_id = serializers.IntegerField(write_only=True)
    requested_vehicle_type_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    note = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = BookingAssignment
        fields = [
            "id", "booking_ids", "scope", "booking_agent_id", "requested_vehicle_type_id", "note",
        ]

    def validate(self, attrs):
        booking_ids = attrs["booking_ids"]
        if not booking_ids:
            raise serializers.ValidationError({"booking_ids": "At least one booking id is required"})

        # Ensure all bookings belong to the same application
        bookings = Booking.objects.filter(id__in=booking_ids).select_related("trip_details__travel_application")
        if bookings.count() != len(set(booking_ids)):
            raise serializers.ValidationError({"booking_ids": "One or more booking IDs are invalid"})

        apps = {
            b.trip_details.travel_application_id
            for b in bookings
        }
        if len(apps) != 1:
            raise serializers.ValidationError({"booking_ids": "All bookings must belong to the same application"})

        attrs["_application_id"] = apps.pop()
        attrs["_bookings"] = list(bookings)
        return attrs


class BookingNoteSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = BookingNote
        fields = [
            "id", "booking", "note",
            "author", "author_name", "created_at",
        ]
        read_only_fields = ["author", "author_name", "created_at"]

    def get_author_name(self, obj):
        if not obj.author:
            return None
        return obj.author.get_full_name() or obj.author.username

    def create(self, validated_data):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            validated_data["author"] = request.user
        return super().create(validated_data)
