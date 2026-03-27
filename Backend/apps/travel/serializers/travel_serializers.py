from rest_framework import serializers
from django.db import transaction
from ..models import TravelApplication, TripDetails, Booking, TravelAdvanceRequest
from ..business_logic.validators import *


class BookingSerializer(serializers.ModelSerializer):
    booking_type_name = serializers.CharField(source='booking_type.name', read_only=True)
    sub_option_name = serializers.CharField(source='sub_option.name', read_only=True)
    booking_details = serializers.JSONField()

    class Meta:
        model = Booking
        fields = [
            'id', 
            'booking_type', 'booking_type_name', 
            'sub_option', 'sub_option_name',
            'booking_details', 
            'status', 
            'estimated_cost', 
            'actual_cost',
            'booking_reference', 
            'vendor_reference', 
            'booking_file', 
            'special_instruction',
            'meal_preference',
        ]
    
    id = serializers.IntegerField(required=False)
    
    meal_preference = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret['meal_preference'] = instance.booking_details.get('meal_preference', "")
        
        # Add place_name for self-arranged accommodation
        place_id = instance.booking_details.get('place')
        if place_id:
            try:
                from apps.master_data.models import CityMaster
                city = CityMaster.objects.filter(id=place_id).first()
                if city:
                    ret['booking_details'] = {**ret['booking_details'], 'place_name': city.city_name}
            except Exception:
                pass
        
        return ret

class BookingListSerializer(serializers.ModelSerializer):
    booking_type_name = serializers.CharField(source='booking_type.name', read_only=True)
    sub_option_name = serializers.CharField(source='sub_option.name', read_only=True)
    meal_preference = serializers.SerializerMethodField()
    
    from_location = serializers.CharField(
        source='trip_details.from_location.name',
        read_only=True
    )
    to_location = serializers.CharField(
        source='trip_details.to_location.name',
        read_only=True
    )
    departure_date = serializers.DateField(
        source='trip_details.departure_date',
        read_only=True
    )

    class Meta:
        model = Booking
        fields = [
            'id', 
            'booking_type', 'booking_type_name', 
            'sub_option', 'sub_option_name',
            'from_location', 'to_location', #
            'booking_details', 
            'departure_date', #
            'status', 
            'estimated_cost', 
            'actual_cost',
            'booking_reference', 
            'vendor_reference', 
            'booking_file', 
            'special_instruction',
            'created_at', #
            'meal_preference',
        ]
    
    def get_meal_preference(self, obj):
        return obj.booking_details.get('meal_preference', "")
    
    def to_representation(self, instance):
        ret = super().to_representation(instance)
        # meal_preference is now handled by SerializerMethodField
        return ret

class BookingDetailSerializer(serializers.ModelSerializer):
    booking_type_name = serializers.CharField(source='booking_type.name', read_only=True)
    sub_option_name = serializers.CharField(source='sub_option.name', read_only=True)
    meal_preference = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = '__all__'
    
    def get_meal_preference(self, obj):
        return obj.booking_details.get('meal_preference', "")


class ItineraryEventSerializer(serializers.Serializer):
    type = serializers.CharField()
    title = serializers.CharField()
    date = serializers.DateField()
    start_time = serializers.CharField(allow_null=True)
    end_time = serializers.CharField(allow_null=True)
    details = serializers.JSONField()


class ItinerarySerializer(serializers.Serializer):
    application_id = serializers.IntegerField()
    employee_name = serializers.CharField()
    purpose = serializers.CharField()
    locations = serializers.DictField()
    trip_summary = serializers.DictField()
    timeline = ItineraryEventSerializer(many=True)


class TravelAdvanceRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = TravelAdvanceRequest
        fields = ['id', 'air_fare', 'train_fare', 'lodging_fare', 
                 'conveyance_fare', 'other_expenses', 'special_instruction', 'total']
        read_only_fields = ['total']

class TripDetailsSerializer(serializers.ModelSerializer):
    bookings = BookingSerializer(many=True, required=False)
    from_location_name = serializers.CharField(source='from_location.city_name', read_only=True)
    to_location_name = serializers.CharField(source='to_location.city_name', read_only=True)
    duration_days = serializers.SerializerMethodField()
    city_category = serializers.SerializerMethodField()
    travel_advance = TravelAdvanceRequestSerializer(required=False, allow_null=True)

    class Meta:
        model = TripDetails
        fields = [
            'id', 'from_location', 'from_location_name', 'to_location', 'to_location_name',
            'departure_date', 'start_time', 'return_date', 'end_time', 'trip_purpose', 'guest_count', 'estimated_distance_km',
            'duration_days', 'city_category', 'bookings', 'travel_advance', 'no_bookings_required'
        ]

    id = serializers.IntegerField(required=False)
    
    def get_duration_days(self, obj):
        return obj.get_duration_days()
    
    def get_city_category(self, obj):
        return obj.get_city_category()

class ApplicationTravelerSerializer(serializers.ModelSerializer):
    guest_name = serializers.SerializerMethodField(read_only=True)
    user_name = serializers.SerializerMethodField(read_only=True)
    employee_id = serializers.CharField(source='guest.company_worker_id', read_only=True, required=False)
    
    # Expose Guest Details for Edit Mode
    first_name = serializers.CharField(source='guest.first_name', read_only=True, allow_null=True)
    last_name = serializers.CharField(source='guest.last_name', read_only=True, allow_null=True)
    email = serializers.CharField(source='guest.email', read_only=True, allow_null=True)
    contact_number = serializers.CharField(source='guest.contact_number', read_only=True, allow_null=True)
    gender = serializers.CharField(source='guest.gender', read_only=True, allow_null=True)
    age = serializers.IntegerField(source='guest.age', read_only=True, allow_null=True)
    nationality_type = serializers.CharField(source='guest.nationality_type', read_only=True, allow_null=True)

    class Meta:
        from apps.travel.models.traveler import ApplicationTraveler
        model = ApplicationTraveler
        fields = [
            'id', 'user', 'user_name', 
            'guest', 'guest_name', 'is_primary', 'employee_id',
            'first_name', 'last_name', 'email', 'contact_number',
            'gender', 'age', 'nationality_type',
            'flight_meal_preference', 'accommodation_meal_preference'
        ]
    
    def get_guest_name(self, obj):
        if obj.guest:
            return f"{obj.guest.first_name} {obj.guest.last_name}"
        return None

    def get_user_name(self, obj):
        if obj.user:
            return obj.user.get_full_name()
        return None


class TravelApplicationSerializer(serializers.ModelSerializer):
    trip_details = TripDetailsSerializer(many=True)
    travelers = ApplicationTravelerSerializer(source='display_travelers', many=True, read_only=True)
    
    # Write-only field to accept traveler list [ {guest: id}, {user: id} ]
    travelers_data = serializers.ListField(
        child=serializers.DictField(),
        write_only=True,
        required=False
    )
    
    employee_name = serializers.CharField(source='employee.get_full_name', read_only=True)
    employee_grade = serializers.CharField(source='employee.grade.name', read_only=True)
    gl_code_name = serializers.CharField(source='general_ledger.vertical_name', read_only=True)
    gl_code = serializers.CharField(source='general_ledger.gl_code', read_only=True)
    gl_code_description = serializers.CharField(source='general_ledger.short_description', read_only=True)
    travel_request_id = serializers.SerializerMethodField()
    total_duration_days = serializers.SerializerMethodField()
    can_edit = serializers.SerializerMethodField()
    
    class Meta:
        model = TravelApplication
        fields = [
            'id', 'employee', 'employee_name', 'employee_grade', 'purpose',
            'travel_for', 'travelers', 'travelers_data',
            'internal_order', 'general_ledger', 'gl_code_name', 'gl_code', 'gl_code_description', 'sanction_number',
            'advance_amount', 'estimated_total_cost', 'status', 'is_settled',
            'settlement_due_date', 'travel_request_id', 'total_duration_days',
            'created_at', 'updated_at', 'submitted_at', 'trip_details',
            'cancellation_reason', 'cancellation_requested_at', 'can_edit',
            'bulk_upload_file'
        ]
        read_only_fields = [
            'employee', 'status', 'is_settled', 'estimated_total_cost',
            'created_at', 'updated_at', 'submitted_at', 'can_edit'
        ]
    
    def get_travel_request_id(self, obj):
        return obj.get_travel_request_id()
    
    def get_total_duration_days(self, obj):
        return obj.get_travel_duration_days()
    
    def get_can_edit(self, obj):
        """Dynamically check if application can be edited"""
        from apps.travel.services.edit_helpers import can_edit_application
        
        request = self.context.get('request')
        
        if not request or not request.user:
            return False
        
        can_edit, _ = can_edit_application(obj, request.user)
        return can_edit
    
    def validate(self, data):
        """Enhanced validation with better error messages"""
        request = self.context.get('request')
        user = request.user if request else None

        # 1. Security check: Ensure the application can be edited
        if self.instance and user:
            can_edit, message = can_edit_application(self.instance, user)
            if not can_edit:
                raise serializers.ValidationError({"detail": message})
        
        # 2. Back-dated Allowance check: Ensure user has permission for past dates
        # We only check this for NEW applications or when CHANGING dates to past values.
        trip_details_data = data.get('trip_details', [])
        is_any_trip_backdated = False
        
        # Determine if any trip in the incoming data is back-dated
        now_date = timezone.now().date()
        for trip in trip_details_data:
            dep_date = trip.get('departure_date')
            # Handle both string and date objects
            dep_date_val = str(dep_date) if dep_date else None
            if dep_date_val and dep_date_val <= str(now_date):
                is_any_trip_backdated = True
                break
        
        if is_any_trip_backdated and user:
            from apps.travel.services.permission_helpers import check_backdated_tr_permission
            if not check_backdated_tr_permission(user):
                # We skip this for existing back-dated TRs being edited for corrections
                # (unless the edit itself converts an on-time TR into a back-dated one)
                is_already_backdated = False
                if self.instance:
                    orig_start = self.instance.get_travel_start_date()
                    if orig_start and orig_start <= self.instance.created_at.date():
                        is_already_backdated = True
                
                if not is_already_backdated:
                   raise serializers.ValidationError({
                       "non_field_errors": [
                           "Back-dated travel requests are against policy and require administrative allowance. "
                           "Please contact your administrator to grant you a temporary permission window."
                       ]
                   })
        
        travel_for = data.get('travel_for', 'self')
        travelers_data = data.get('travelers_data', [])
        
        # Validate Guest Data
        if travel_for in ['guest', 'self_guest']:
            # If bulk file is present, we might accept no guests initially.
            # However, we can't easily check for file here if it's uploaded later.
            # RELAXATION: We will allow empty travelers_data during creation/update,
            # but strict validation should happen at SUBMISSION.
            pass
            
            # if not travelers_data:
            #     raise serializers.ValidationError({'travelers_data': 'Travelers list is required for Guest travel.'})
            
            # # Check if guests are provided
            # has_guest = any('guest' in t for t in travelers_data)
            # if not has_guest:
            #     raise serializers.ValidationError({'travelers_data': 'At least one guest must be selected.'})

        user = self.context['request'].user
        errors = {}
        
        # Validate each trip
        for idx, trip_data in enumerate(trip_details_data):
            trip_errors = {}
            
            departure = trip_data.get('departure_date')
            return_date = trip_data.get('return_date')
            
            # Date validation (only if both present)
            if return_date and departure and return_date < departure:
                trip_errors['dates'] = 'Return date cannot be earlier than departure date'
            
            # Max duration validation (only if both present)
            if departure and return_date:
                try:
                    validate_max_trip_duration(departure, return_date, max_days=90)
                except Exception as e:
                    trip_errors['duration'] = str(e)
            
            # Check for duplicate travel (only if not draft and dates present)
            # RELAXATION: Only check for user himself (Self). Don't check for Guest-only applications.
            if not self.instance and self.context.get('status') != 'draft' and travel_for != 'guest':
                if departure and return_date:
                    try:
                        validate_duplicate_travel_request(user, departure, return_date)
                    except Exception as e:
                        trip_errors['duplicate'] = str(e)
            
            if trip_errors:
                errors[f'trip_{idx}'] = trip_errors
        
        
        if errors:
            raise serializers.ValidationError(errors)
        
        return data
    
    def _handle_travelers(self, application, travelers_data, travel_for, user):
        from apps.travel.models.traveler import ApplicationTraveler
        
        # Clear existing
        application.display_travelers.all().delete()
        
        # Add Guests/Self
        # travelers_data example: [{'user': 1, 'flight_meal_preference': 1, ...}, {'guest': 5, ...}]
        
        # 1. Handle Self (if applicable)
        if travel_for in ['self', 'self_guest']:
             # Find self data in travelers_data
             # Logic: Look for exact ID match, OR entry with 'user' key (even if None), OR fallback to any entry without 'guest' key
            self_data = next((t for t in travelers_data if str(t.get('user')) == str(user.id)), None)
            
            if not self_data:
                # Fallback: check for entry with 'user' key (even if null) or no 'guest' key
                self_data = next((t for t in travelers_data if 'user' in t or 'guest' not in t), {})
            
            ApplicationTraveler.objects.create(
                travel_application=application,
                user=user,
                is_primary=True,
                flight_meal_preference_id=self_data.get('flight_meal_preference'),
                accommodation_meal_preference_id=self_data.get('accommodation_meal_preference')
            )
        
        # 2. Handle Guests
        if travel_for in ['guest', 'self_guest'] and travelers_data:
            for idx, t_data in enumerate(travelers_data):
                guest_id = t_data.get('guest')
                if guest_id:
                     # If 'guest' only mode, the first guest is primary
                    is_primary_guest = (travel_for == 'guest' and idx == 0)
                    
                    ApplicationTraveler.objects.create(
                        travel_application=application,
                        guest_id=guest_id,
                        is_primary=is_primary_guest,
                        flight_meal_preference_id=t_data.get('flight_meal_preference'),
                        accommodation_meal_preference_id=t_data.get('accommodation_meal_preference')
                    )

    @transaction.atomic
    def create(self, validated_data):
        trip_details_data = validated_data.pop('trip_details')
        travelers_data = validated_data.pop('travelers_data', [])
        
        user = self.context['request'].user
        validated_data['employee'] = user
        
        travel_application = TravelApplication.objects.create(**validated_data)
        
        # Handle Travelers
        self._handle_travelers(travel_application, travelers_data, travel_application.travel_for, user)

        for trip_data in trip_details_data:
            bookings_data = trip_data.pop('bookings', [])
            trip_detail = TripDetails.objects.create(
                travel_application=travel_application,
                **trip_data
            )

            advance_data = validated_data.pop('travel_advance', None)
            if advance_data:
                TravelAdvanceRequest.objects.create(trip_detail=trip_detail, **advance_data)
            
            for booking_data in bookings_data:
                # Validate own car if applicable
                if booking_data.get('booking_details', {}).get('transport_type') == 'own_car':
                    from apps.travel.business_logic.validators import validate_own_car_booking
                    
                    distance = booking_data.get('booking_details', {}).get('distance_km')
                    if distance is None and trip_data.get('estimated_distance_km'):
                        distance = trip_data.get('estimated_distance_km')

                    errors = validate_own_car_booking(
                        booking_data['booking_details'],
                        booking_data.get('booking_details', {}).get('distance_km')
                    )
                    
                    if any(e['severity'] == 'error' for e in errors):
                        error_messages = [e['message'] for e in errors if e['severity'] == 'error']
                        raise serializers.ValidationError({'own_car': error_messages})
                
                # Handle meal_preference
                meal_preference = booking_data.pop('meal_preference', None)
                if meal_preference:
                    if 'booking_details' not in booking_data:
                        booking_data['booking_details'] = {}
                    booking_data['booking_details']['meal_preference'] = meal_preference

                booking = Booking.objects.create(trip_details=trip_detail, **booking_data)
                
                # Auto-confirm self-arranged accommodation (no vendor required)
                sub_option = booking.sub_option
                if sub_option and 'self' in sub_option.name.lower():
                    booking.status = 'confirmed'
                    booking.save(update_fields=['status'])
        
        travel_application.calculate_estimated_cost()
        travel_application.save(update_fields=['estimated_total_cost'])
        
        return travel_application
    
    @transaction.atomic
    def update(self, instance, validated_data):
        trip_details_data = validated_data.pop('trip_details', None)
        travelers_data = validated_data.pop('travelers_data', [])
        
        # Update travel application fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Update travelers
        if travelers_data or instance.travel_for != 'self': 
             self._handle_travelers(instance, travelers_data, instance.travel_for, instance.employee)
        
        # Update trip details if provided
        if trip_details_data is not None:
            # Load existing trips to allow fuzzy matching
            existing_trips = {t.id: t for t in instance.trip_details.all()}
            matched_trip_ids = []

            for trip_data in trip_details_data:
                trip_id = trip_data.pop('id', None)
                bookings_data = trip_data.pop('bookings', [])
                advance_data = trip_data.pop('travel_advance', None)
                
                trip_detail = None
                if trip_id and trip_id in existing_trips:
                    trip_detail = existing_trips[trip_id]
                
                if trip_detail:
                    matched_trip_ids.append(trip_detail.id)
                    for attr, value in trip_data.items():
                        setattr(trip_detail, attr, value)
                    trip_detail.save()
                else:
                    trip_detail = TripDetails.objects.create(
                        travel_application=instance,
                        **trip_data
                    )
                    # FIX: Add newly created ID to matched list to prevent immediate deletion
                    matched_trip_ids.append(trip_detail.id)
                
                # Handle Bookings for this trip
                existing_bookings = {b.id: b for b in trip_detail.bookings.all()}
                matched_booking_ids = []

                for booking_data in bookings_data:
                    booking_id = booking_data.pop('id', None)
                    booking_type_id = booking_data.get('booking_type')
                    
                    # Handle meal_preference (nested extraction)
                    meal_preference = booking_data.pop('meal_preference', None)
                    if meal_preference:
                        if 'booking_details' not in booking_data:
                            booking_data['booking_details'] = {}
                        booking_data['booking_details']['meal_preference'] = meal_preference

                    booking = None
                    if booking_id and booking_id in existing_bookings:
                        booking = existing_bookings[booking_id]
                    elif booking_type_id:
                        # Fuzzy match by type
                        booking = next(
                            (b for b in existing_bookings.values() 
                             if b.booking_type_id == booking_type_id and b.id not in matched_booking_ids), 
                            None
                        )

                    if booking:
                        matched_booking_ids.append(booking.id)
                        
                        incoming_status = booking_data.pop('status', 'pending')
                        if incoming_status == 'pending' and booking.status != 'pending':
                             # Keep existing status
                             pass
                        else:
                             booking.status = incoming_status

                        for attr, value in booking_data.items():
                            setattr(booking, attr, value)
                        
                        if booking.sub_option and 'self' in booking.sub_option.name.lower():
                            booking.status = 'confirmed'
                        
                        booking.save()
                    else:
                        booking = Booking.objects.create(trip_details=trip_detail, **booking_data)
                        # FIX: Add newly created ID to matched list to prevent immediate deletion
                        matched_booking_ids.append(booking.id)

                        if (booking.sub_option and 'self' in booking.sub_option.name.lower()):
                            booking.status = 'confirmed'
                            booking.save(update_fields=['status'])

                # Delete removed bookings
                trip_detail.bookings.exclude(id__in=matched_booking_ids).delete()

                # Handle Advance Request
                if advance_data:
                    TravelAdvanceRequest.objects.update_or_create(
                        trip_detail=trip_detail, defaults=advance_data
                    )
            
            # Delete removed trips
            instance.trip_details.exclude(id__in=matched_trip_ids).delete()
            
            # Recalculate estimated cost
            instance.calculate_estimated_cost()
            instance.save(update_fields=['estimated_total_cost'])
        
        return instance

class TravelApplicationSubmissionSerializer(serializers.Serializer):
    """
    Serializer for travel application submission with validation
    """
    def validate(self, data):
        travel_app = self.instance
        
        # Validate Guest/Bulk Requirement
        # At submission time, we MUST have either travelers (if guest) OR a bulk file.
        # Check travelers count
        is_guest_travel = travel_app.travel_for in ['guest', 'self_guest']
        has_travelers = travel_app.display_travelers.exists()
        has_bulk_file = bool(travel_app.bulk_upload_file)
        
        if is_guest_travel and not has_travelers and not has_bulk_file:
            raise serializers.ValidationError({
                'validation_error': 'For guest travel, you must either add guest details or upload a bulk file.'
            })
        
        # Run business validations before submission
        for trip in travel_app.trip_details.all():
            for booking in trip.bookings.all():
                try:
                    # Validate advance booking requirements
                    validate_advance_booking(
                        trip.departure_date,
                        booking.booking_type.name,
                        booking.estimated_cost or 0
                    )
                    
                    # Validate travel entitlements
                    if booking.sub_option:
                        validate_travel_entitlement(
                            travel_app.employee,
                            booking.booking_type,
                            booking.sub_option,
                            # trip.to_location.city.category
                            trip.to_location.category,
                            estimated_cost=booking.estimated_cost
                        )
                        
                except Exception as e:
                    raise serializers.ValidationError({
                        'validation_error': str(e),
                        'trip_id': trip.id,
                        'booking_id': booking.id
                    })
        
        return data

class BulkFileUploadSerializer(serializers.ModelSerializer):
    class Meta:
        model = TravelApplication
        fields = ['bulk_upload_file']
