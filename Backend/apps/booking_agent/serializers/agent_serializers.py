from rest_framework import serializers
from apps.travel.models import TravelApplication, TripDetails, Booking, BookingAssignment, BookingNote
from apps.authentication.models import User
from utils.date_utils import calculate_age
from apps.travel.serializers.travel_serializers import ApplicationTravelerSerializer

# IMPORTANT: 
# "BookingAgentSerializer" defines the Booking Agent ENTITY (User).
# "AgentBookingSerializer" defines the Booking (Job) for the Agent.
# Naming is tricky but historical.

class BookingAgentSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    organization_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "full_name", "organization_name"]

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username

    def get_organization_name(self, obj):
        profile = getattr(obj, "booking_agent_profile", None)
        return profile.organization_name if profile else None


class AgentBookingSerializer(serializers.ModelSerializer):
    assigned_agent_name = serializers.SerializerMethodField()
    booking_type_name = serializers.CharField(source="booking_type.name", read_only=True)
    sub_option_name = serializers.CharField(source="sub_option.name", read_only=True)   
    employee_name = serializers.SerializerMethodField()
    travelers = ApplicationTravelerSerializer(source="trip_details.travel_application.display_travelers", many=True, read_only=True)

    class Meta:
        model = Booking
        fields = [
            'id', 'booking_type', 'sub_option', 'booking_type_name', 'sub_option_name', 
            'estimated_cost', 'actual_cost', 'vendor_reference', 'booking_reference',
            'status', 'booking_details', 'booking_file',
            'assigned_agent_name',
            'meal_preference', 'employee_name', 'notes',
            'travelers'
        ]
    
    meal_preference = serializers.SerializerMethodField()
    notes = serializers.SerializerMethodField()

    def get_notes(self, obj):
        notes = BookingNote.objects.filter(booking=obj).select_related("author").order_by("-created_at")
        return BookingNoteSerializer(notes, many=True).data

    def get_meal_preference(self, obj):
        return obj.booking_details.get('meal_preference', "")

    def get_assigned_agent_name(self, obj):
        assignment = getattr(obj, 'active_assignment', None)
        if assignment and assignment.agent:
            return assignment.agent.user.first_name + " " + assignment.agent.user.last_name
        return None

    def get_employee_name(self, obj):
        app = obj.trip_details.travel_application
        user = app.employee
        return user.get_full_name() or user.username

    def to_representation(self, instance):
        data = super().to_representation(instance)
        booking_details = data.get('booking_details')
        
        if booking_details and isinstance(booking_details, dict):
            place_id = booking_details.get('place')
            if place_id and str(place_id).isdigit():
                try:
                    from apps.master_data.models import CityMaster
                    city = CityMaster.objects.get(id=place_id)
                    booking_details['place'] = city.city_name
                except Exception:
                    pass
            
            # ARC Hotel Preferences Name Resolution
            arc_prefs = booking_details.get('arc_hotel_preferences')
            if arc_prefs and isinstance(arc_prefs, list):
                try:
                    from apps.master_data.models import ARCHotelMaster
                    hotels = ARCHotelMaster.objects.filter(id__in=arc_prefs).select_related('city', 'state')
                    booking_details['arc_hotel_preferences'] = [
                        f"{h.name} - {h.city.city_name}, {h.state.state_name}"
                        for h in hotels
                    ]
                except Exception:
                    pass
        return data

class AgentBookingListSerializer(serializers.ModelSerializer):
    application_id = serializers.IntegerField(source="trip_details.travel_application.id", read_only=True)
    travel_request_id = serializers.SerializerMethodField()
    employee_name = serializers.SerializerMethodField()
    employee_email = serializers.SerializerMethodField()
    employee_mobile = serializers.SerializerMethodField()
    employee_gender = serializers.SerializerMethodField()
    employee_age = serializers.SerializerMethodField()
    purpose = serializers.CharField(source="trip_details.travel_application.purpose", read_only=True)
    trip_start_date = serializers.CharField(source="trip_details.departure_date", read_only=True)
    trip_end_date = serializers.CharField(source="trip_details.return_date", read_only=True)
    trip_segment = serializers.SerializerMethodField()
    booking_details = serializers.JSONField()
    booking_type_name = serializers.CharField(source="booking_type.name", read_only=True)
    sub_option_name = serializers.CharField(source="sub_option.name", read_only=True)
    status_label = serializers.SerializerMethodField()
    assigned_agent = serializers.SerializerMethodField()
    max_allowed_cost = serializers.SerializerMethodField()
    grade_entitled_amount = serializers.SerializerMethodField()
    travel_application_status = serializers.CharField(source="trip_details.travel_application.status", read_only=True)
    travelers = ApplicationTravelerSerializer(source="trip_details.travel_application.display_travelers", many=True, read_only=True)

    class Meta:
        model = Booking
        fields = [
            "id", "application_id", "travel_request_id", "purpose", "trip_segment", 
            "employee_name", "employee_email", "employee_mobile", "employee_gender", "employee_age",
            "booking_details", "booking_type", "booking_type_name", "sub_option", "sub_option_name",
            "status", "status_label", "estimated_cost", "actual_cost", "max_allowed_cost",
            "grade_entitled_amount",
            "booking_reference", "vendor_reference", "booking_file",
            "created_at", "updated_at",
            "assigned_agent",
            "meal_preference",
            "travel_application_status",
            "trip_start_date",
            "trip_end_date",
            "notes",
            "travelers"
        ]

    meal_preference = serializers.SerializerMethodField()
    notes = serializers.SerializerMethodField()

    def get_notes(self, obj):
        notes = BookingNote.objects.filter(booking=obj).select_related("author").order_by("-created_at")
        return BookingNoteSerializer(notes, many=True).data

    def get_meal_preference(self, obj):
        return obj.booking_details.get('meal_preference', "")

    def get_travel_request_id(self, obj):
        return obj.trip_details.travel_application.get_travel_request_id()

    def get_employee_name(self, obj):
        emp = obj.trip_details.travel_application.employee
        return emp.get_full_name() or emp.username

    def get_employee_email(self, obj):
        emp = obj.trip_details.travel_application.employee
        return getattr(emp, "get_email", lambda: emp.email)()

    def get_employee_mobile(self, obj):
        emp = obj.trip_details.travel_application.employee
        return getattr(emp, "mobile_no", "")

    def get_employee_gender(self, obj):
        emp = obj.trip_details.travel_application.employee
        return emp.get_gender_display()

    def get_employee_age(self, obj):
        emp = obj.trip_details.travel_application.employee
        return calculate_age(emp.date_of_birth)

    def get_trip_segment(self, obj):
        td = obj.trip_details
        return f"{td.from_location.city_name} → {td.to_location.city_name}"

    def get_status_label(self, obj):
        return obj.get_status_display()

    def get_assigned_agent(self, obj):
        assignment = (
            BookingAssignment.objects
            .filter(booking=obj)
            .select_related("assigned_to__booking_agent_profile")
            .first()
        )
        if not assignment or not assignment.assigned_to:
            return None

        user = assignment.assigned_to
        ext = getattr(user, "booking_agent_profile", None)

        return {
            "id": user.id,
            "name": user.get_full_name() or user.username,
            "organization_name": ext.organization_name if ext else None,
            "assigned_at": assignment.assigned_at,
            "scope": assignment.assignment_scope,
        }

    def get_max_allowed_cost(self, obj):
        # Escalation applies only to Flight
        if obj.booking_type.name != "Flight":
            return None

        from apps.master_data.models import TravelPolicyMaster
        from django.utils import timezone
        from django.db.models import Q

        today = timezone.now().date()

        policy = (
            TravelPolicyMaster.objects
            .filter(
                policy_type="amount_limit",
                is_active=True,
                travel_mode=obj.booking_type,
                effective_from__lte=today
            )
            .filter(Q(effective_to__isnull=True) | Q(effective_to__gte=today))
            .order_by("-effective_from")
            .first()
        )
        
        if policy and policy.rule_parameters:
            return policy.rule_parameters.get("max_amount")
        return None

    def get_grade_entitled_amount(self, obj):
        """
        Returns the grade-based entitlement amount for this booking from
        GradeEntitlementMaster. Works for all booking types (Flight, Train,
        Accommodation, Conveyance). Returns None if no entitlement is configured.

        Lookup priority:
          1. grade + sub_option + destination city_category  (most specific)
          2. grade + sub_option + city_category=None         (grade/mode default)
        """
        try:
            from apps.master_data.models import GradeEntitlementMaster

            employee = obj.trip_details.travel_application.employee
            grade = getattr(employee, "grade", None)
            sub_option = obj.sub_option  # FK, may be None

            if not grade or not sub_option:
                return None

            # Try to resolve destination city category from trip destination
            city_category = None
            try:
                to_location = obj.trip_details.to_location
                if to_location and hasattr(to_location, "category"):
                    city_category = to_location.category
            except Exception:
                pass

            # 1) Specific match: grade + sub_option + city_category
            if city_category:
                entitlement = GradeEntitlementMaster.objects.filter(
                    grade=grade,
                    sub_option=sub_option,
                    city_category=city_category,
                    is_allowed=True,
                ).first()
                if entitlement and entitlement.max_amount is not None:
                    return float(entitlement.max_amount)

            # 2) Fallback: grade + sub_option, no city_category restriction
            entitlement = GradeEntitlementMaster.objects.filter(
                grade=grade,
                sub_option=sub_option,
                city_category__isnull=True,
                is_allowed=True,
            ).first()
            if entitlement and entitlement.max_amount is not None:
                return float(entitlement.max_amount)

        except Exception:
            pass

        return None

    def to_representation(self, instance):
        data = super().to_representation(instance)
        booking_details = data.get('booking_details')
        
        if booking_details and isinstance(booking_details, dict):
            place_id = booking_details.get('place')
            if place_id and str(place_id).isdigit():
                try:
                    from apps.master_data.models import CityMaster
                    city = CityMaster.objects.get(id=place_id)
                    booking_details['place'] = city.city_name
                except Exception:
                    pass

            # ARC Hotel Preferences Name Resolution
            arc_prefs = booking_details.get('arc_hotel_preferences')
            if arc_prefs and isinstance(arc_prefs, list):
                try:
                    from apps.master_data.models import ARCHotelMaster
                    hotels = ARCHotelMaster.objects.filter(id__in=arc_prefs).select_related('city', 'state')
                    booking_details['arc_hotel_preferences'] = [
                        f"{h.name} - {h.city.city_name}, {h.state.state_name}"
                        for h in hotels
                    ]
                except Exception:
                    pass
        return data


class AgentBookingDetailSerializer(serializers.ModelSerializer):
    application_id = serializers.IntegerField(source="trip_details.travel_application.id", read_only=True)
    travel_request_id = serializers.CharField(source="trip_details.travel_application.travel_request_id", read_only=True)
    employee_name = serializers.SerializerMethodField()
    employee_email = serializers.SerializerMethodField()
    employee_mobile = serializers.SerializerMethodField()
    employee_gender = serializers.SerializerMethodField()
    employee_age = serializers.SerializerMethodField()
    employee_grade = serializers.CharField(source="trip_details.travel_application.employee_grade", read_only=True)
    purpose = serializers.CharField(source="trip_details.travel_application.purpose", read_only=True)
    trip_segment = serializers.SerializerMethodField()
    booking_type_name = serializers.CharField(source="booking_type.name", read_only=True)
    sub_option_name = serializers.CharField(source="sub_option.name", read_only=True)
    status_label = serializers.SerializerMethodField()
    assigned_agent = serializers.SerializerMethodField()
    max_allowed_cost = serializers.SerializerMethodField()
    grade_entitled_amount = serializers.SerializerMethodField()
    ceo_approval_status = serializers.SerializerMethodField()
    travel_application_status = serializers.CharField(source="trip_details.travel_application.status", read_only=True)
    travelers = ApplicationTravelerSerializer(source="trip_details.travel_application.display_travelers", many=True, read_only=True)

    class Meta:
        model = Booking
        fields = [
            "id", "application_id", "travel_request_id", "employee_name", "employee_email", "employee_mobile", "employee_gender", "employee_grade", "employee_age",
            "purpose", "trip_segment", "booking_type", "booking_type_name", "sub_option", "sub_option_name", 
            "status", "status_label", "estimated_cost", "actual_cost", 
            "booking_reference", "vendor_reference", 
            "booking_file", "special_instruction", 
            "created_at", "updated_at", "booked_at", "assigned_agent",
            "booking_details",
            "meal_preference",
            "max_allowed_cost",
            "grade_entitled_amount",
            "ceo_approval_status",
            "ceo_approval_status",
            "travel_application_status",
            "requested_vehicle_type",
            "notes",
            "travelers",
        ]

    meal_preference = serializers.SerializerMethodField()
    requested_vehicle_type = serializers.SerializerMethodField()
    notes = serializers.SerializerMethodField()

    def get_meal_preference(self, obj):
        return obj.booking_details.get('meal_preference', "")
    
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

    def get_notes(self, obj):
        notes = BookingNote.objects.filter(booking=obj).select_related("author").order_by("-created_at")
        return BookingNoteSerializer(notes, many=True).data
    
    def get_travel_request_id(self, obj):
        return obj.trip_details.travel_application.get_travel_request_id()

    def get_employee_name(self, obj):
        app = obj.trip_details.travel_application
        user = app.employee
        return user.get_full_name() or user.username

    def get_employee_email(self, obj):
        app = obj.trip_details.travel_application
        user = app.employee
        return getattr(user, "get_email", lambda: user.email)()

    def get_employee_mobile(self, obj):
        app = obj.trip_details.travel_application
        user = app.employee
        return getattr(user, "mobile_no", "")

    def get_employee_gender(self, obj):
        app = obj.trip_details.travel_application
        user = app.employee
        return user.get_gender_display()

    def get_employee_age(self, obj):
        app = obj.trip_details.travel_application
        user = app.employee
        return calculate_age(user.date_of_birth)

    def get_trip_segment(self, obj):
        td: TripDetails = obj.trip_details
        return f"{td.from_location.city_name} → {td.to_location.city_name}"

    def get_status_label(self, obj):
        return obj.get_status_display()
    
    def get_ceo_approval_status(self, obj):
        app = obj.trip_details.travel_application
        ceo_flow = app.approval_flows.filter(approval_level='ceo').first()
        if not ceo_flow:
            return 'not_required'
        return ceo_flow.status
    
    def get_max_allowed_cost(self, obj):
        from apps.master_data.models import ApprovalMatrix
        app = obj.trip_details.travel_application
        employee = app.employee
        
        # Determine grade (use employee's grade)
        grade = employee.grade
        if not grade:
            return None
        
        # Find matrix rule
        # Rule: Flight + Grade -> max_amount
        matrix = ApprovalMatrix.objects.filter(
            travel_mode=obj.booking_type,
            employee_grade=grade,
            is_active=True
        ).order_by('min_amount').last() # simplistic lookup
        
        if matrix and matrix.max_amount:
            return matrix.max_amount
        return None

    def get_grade_entitled_amount(self, obj):
        """
        Returns the grade-based entitlement amount for this booking from
        GradeEntitlementMaster. Works for all booking types (Flight, Train,
        Accommodation, Conveyance). Returns None if no entitlement is configured.

        Lookup priority:
          1. grade + sub_option + destination city_category  (most specific)
          2. grade + sub_option + city_category=None         (grade/mode default)
        """
        try:
            from apps.master_data.models import GradeEntitlementMaster

            employee = obj.trip_details.travel_application.employee
            grade = getattr(employee, "grade", None)
            sub_option = obj.sub_option  # FK, may be None

            if not grade or not sub_option:
                return None

            # Try to resolve destination city category from trip destination
            city_category = None
            try:
                to_location = obj.trip_details.to_location
                if to_location and hasattr(to_location, "category"):
                    city_category = to_location.category
            except Exception:
                pass

            # 1) Specific match: grade + sub_option + city_category
            if city_category:
                entitlement = GradeEntitlementMaster.objects.filter(
                    grade=grade,
                    sub_option=sub_option,
                    city_category=city_category,
                    is_allowed=True,
                ).first()
                if entitlement and entitlement.max_amount is not None:
                    return float(entitlement.max_amount)

            # 2) Fallback: grade + sub_option, no city_category restriction
            entitlement = GradeEntitlementMaster.objects.filter(
                grade=grade,
                sub_option=sub_option,
                city_category__isnull=True,
                is_allowed=True,
            ).first()
            if entitlement and entitlement.max_amount is not None:
                return float(entitlement.max_amount)

        except Exception:
            pass

        return None

    def get_assigned_agent(self, obj):
        assignment = (
            BookingAssignment.objects
            .filter(booking=obj)
            .select_related("assigned_by")
            .first()
        )
        if not assignment or not assignment.assigned_by:
            return None
        ag: User = assignment.assigned_by
        return {
            "id": ag.id,
            "name": ag.get_full_name() or ag.username,
            "assigned_at": assignment.assigned_at,
            "scope": assignment.assignment_scope,
        }

    def to_representation(self, instance):
        data = super().to_representation(instance)
        booking_details = data.get('booking_details')
        
        if booking_details and isinstance(booking_details, dict):
            place_id = booking_details.get('place')
            if place_id and str(place_id).isdigit():
                try:
                    from apps.master_data.models import CityMaster
                    city = CityMaster.objects.get(id=place_id)
                    booking_details['place'] = city.city_name
                except Exception:
                    pass

            # ARC Hotel Preferences Name Resolution
            arc_prefs = booking_details.get('arc_hotel_preferences')
            if arc_prefs and isinstance(arc_prefs, list):
                try:
                    from apps.master_data.models import ARCHotelMaster
                    hotels = ARCHotelMaster.objects.filter(id__in=arc_prefs).select_related('city', 'state')
                    booking_details['arc_hotel_preferences'] = [
                        f"{h.name} - {h.city.city_name}, {h.state.state_name}"
                        for h in hotels
                    ]
                except Exception:
                    pass
        return data


class BookingStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Booking.BOOKING_STATUS_CHOICES)
    remarks = serializers.CharField(required=False, allow_blank=True)
    actual_cost = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)
    booking_reference = serializers.CharField(required=False, allow_blank=True)
    vendor_reference = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        status = attrs.get("status")
        remarks = attrs.get("remarks", "")
        if status == "cancelled" and not remarks:
            raise serializers.ValidationError({"remarks": "Cancellation reason is required"})
        return attrs


class BookingNoteSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = BookingNote
        fields = [
            "id", "booking", "note", "author", "author_name", "created_at",
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
