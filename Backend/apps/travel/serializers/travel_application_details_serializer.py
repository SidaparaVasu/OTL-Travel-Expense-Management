from rest_framework import serializers
from apps.travel.models import (
    TravelApplication,
    TripDetails,
    Booking,
    BookingAssignment,
    BookingNote,
    TravelApprovalFlow,
)
from apps.travel.models.booking_extended import AccommodationBooking, VehicleBooking
from django.utils.dateformat import DateFormat

import logging
logger = logging.getLogger(__name__)

def format_datetime(dt):
    """Format datetime as DD/MM/YYYY HH:MM AM/PM"""
    if dt:
        df = DateFormat(dt)
        return df.format('d/m/Y h:i A')
    return ""


def format_date(d):
    """Format date as DD/MM/YYYY"""
    if d:
        df = DateFormat(d)
        return df.format('d/m/Y')
    return ""

def format_datetime_from_parts(date, time):
    """Combine date and time into formatted datetime string"""
    if not date:
        return ""
    if time:
        from datetime import datetime
        dt = datetime.combine(date, time)
        return format_datetime(dt)
    return format_date(date)


class BookingNoteSerializer(serializers.ModelSerializer):
    """Serializer for booking notes"""
    author = serializers.SerializerMethodField()
    created_at = serializers.SerializerMethodField()

    class Meta:
        model = BookingNote
        fields = ['author', 'note', 'created_at']

    def get_author(self, obj):
        if obj.author:
            # Get user role
            role = "Employee"
            if obj.author.has_role('Travel Desk'):
                role = "Travel Desk"
            elif obj.author.has_role('Booking Agent'):
                role = "Agent"
            elif obj.author.has_role('Admin'):
                role = "Admin"
            
            return f"{obj.author.get_full_name()} ({role})"
        return "System"

    def get_created_at(self, obj):
        return format_datetime(obj.created_at)


class BookingAssignmentSerializer(serializers.ModelSerializer):
    """Serializer for booking assignments"""
    assigned_by = serializers.SerializerMethodField()
    assigned_to = serializers.SerializerMethodField()
    assigned_at = serializers.SerializerMethodField()
    accepted_at = serializers.SerializerMethodField()
    completed_at = serializers.SerializerMethodField()

    class Meta:
        model = BookingAssignment
        fields = ['assigned_by', 'assigned_to', 'assigned_at', 'accepted_at', 'completed_at']

    def get_assigned_by(self, obj):
        return obj.assigned_by.get_full_name() if obj.assigned_by else ""

    def get_assigned_to(self, obj):
        return obj.assigned_to.get_full_name() if obj.assigned_to else ""

    def get_assigned_at(self, obj):
        return format_datetime(obj.assigned_at)

    def get_accepted_at(self, obj):
        return format_datetime(obj.accepted_at)

    def get_completed_at(self, obj):
        return format_datetime(obj.completed_at)


class TicketingBookingSerializer(serializers.Serializer):
    """Serializer for ticketing bookings (Flight/Train)"""
    id = serializers.IntegerField()
    status = serializers.CharField()
    booking_type = serializers.SerializerMethodField()
    class_field = serializers.SerializerMethodField()
    is_self_arranged = serializers.SerializerMethodField()
    ticket_number = serializers.SerializerMethodField()
    from_location = serializers.SerializerMethodField()
    to_location = serializers.SerializerMethodField()
    departure_datetime = serializers.SerializerMethodField()
    arrival_datetime = serializers.SerializerMethodField()
    advance_taken = serializers.SerializerMethodField()
    meal_preference = serializers.SerializerMethodField()
    special_instructions = serializers.CharField(source='special_instruction')
    travel_desk = serializers.SerializerMethodField()
    assignments = serializers.SerializerMethodField()
    booking_notes = serializers.SerializerMethodField()

    def get_booking_type(self, obj):
        return obj.booking_type.name if obj.booking_type else ""

    def get_class_field(self, obj):
        # sub_option is a ForeignKey field on the model, not in booking_details
        return obj.sub_option.name if obj.sub_option else ""

    def get_is_self_arranged(self, obj):
        return obj.booking_details.get('is_self_arranged', False)

    def get_ticket_number(self, obj):
        return obj.booking_reference or obj.booking_details.get('ticket_number', '')

    def get_from_location(self, obj):
        return obj.trip_details.from_location.city_name if obj.trip_details.from_location else ""

    def get_to_location(self, obj):
        return obj.trip_details.to_location.city_name if obj.trip_details.to_location else ""

    def get_departure_datetime(self, obj):
        # Combine departure date and start time
        if obj.trip_details.departure_date:
            if obj.trip_details.start_time:
                from datetime import datetime, time
                dt = datetime.combine(obj.trip_details.departure_date, obj.trip_details.start_time)
                return format_datetime(dt)
            return format_date(obj.trip_details.departure_date)
        return ""

    def get_arrival_datetime(self, obj):
        # Use booking details or trip return date
        arrival = obj.booking_details.get('arrival_datetime', '')
        if arrival:
            return arrival
        if obj.trip_details.return_date:
            if obj.trip_details.end_time:
                from datetime import datetime
                dt = datetime.combine(obj.trip_details.return_date, obj.trip_details.end_time)
                return format_datetime(dt)
            return format_date(obj.trip_details.return_date)
        return ""

    def get_advance_taken(self, obj):
        advance = obj.booking_details.get('advance_amount', 0)
        if advance and advance > 0:
            return f"₹{advance:,.0f}"
        return "Not taken"

    def get_meal_preference(self, obj):
        return obj.booking_details.get('meal_preference', '')

    def get_travel_desk(self, obj):
        # Don't show travel desk for self-arranged bookings
        if obj.sub_option and 'self' in obj.sub_option.name.lower():
            return None
        
        try:
            assignment = obj.assignment
            return {
                'user': assignment.assigned_by.get_full_name() if assignment.assigned_by else "",
                'forwarded_at': format_datetime(assignment.assigned_at),
                'completed_at': format_datetime(assignment.completed_at),
                'remarks': assignment.notes
            }
        except BookingAssignment.DoesNotExist:
            return None

    def get_assignments(self, obj):
        try:
            assignment = obj.assignment
            return [BookingAssignmentSerializer(assignment).data]
        except BookingAssignment.DoesNotExist:
            return []

    def get_booking_notes(self, obj):
        notes = obj.notes.all()
        return BookingNoteSerializer(notes, many=True).data


class AccommodationBookingSerializer(serializers.Serializer):
    """Serializer for accommodation bookings"""
    id = serializers.IntegerField()
    status = serializers.CharField()
    accommodation_type = serializers.SerializerMethodField()
    arc_hotel_preferences = serializers.SerializerMethodField()
    location = serializers.SerializerMethodField()
    allocated_hotel = serializers.SerializerMethodField()
    allocated_guesthouse = serializers.SerializerMethodField()
    check_in_datetime = serializers.SerializerMethodField()
    check_out_datetime = serializers.SerializerMethodField()
    advance_taken = serializers.SerializerMethodField()
    meal_preference = serializers.SerializerMethodField()
    special_instructions = serializers.CharField(source='special_instruction')
    travel_desk = serializers.SerializerMethodField()
    assignments = serializers.SerializerMethodField()
    booking_notes = serializers.SerializerMethodField()

    def get_accommodation_type(self, obj):
        # Get from sub_option name
        return obj.sub_option.name if obj.sub_option else obj.booking_details.get('accommodation_type', '')

    def get_arc_hotel_preferences(self, obj):
        # obj IS the booking, get preferences directly from booking_details
        if obj.sub_option and 'arc' in obj.sub_option.name.lower():
            prefs = obj.booking_details.get('arc_hotel_preferences', [])
            return prefs if prefs else []
        return []

    def get_location(self, obj):
        if obj.sub_option and obj.sub_option.name == 'guest_house':
            return obj.trip_details.to_location.city_name if obj.trip_details.to_location else ""
        return ""

    def get_allocated_hotel(self, obj):
        if obj.sub_option and obj.sub_option.name == 'arc_hotel' and obj.arc_hotel:
            room_info = f" - {obj.room_type}" if obj.room_type else ""
            return f"{obj.arc_hotel.hotel_name}{room_info}"
        elif obj.sub_option and obj.sub_option.name == 'non_arc_hotel' and obj.hotel_name:
            room_info = f" - {obj.room_type}" if obj.room_type else ""
            return f"{obj.hotel_name}{room_info}"
        return ""

    def get_allocated_guesthouse(self, obj):
        if obj.sub_option and obj.sub_option.name == 'guest_house' and obj.guest_house:
            return obj.guest_house.name
        return ""

    def get_check_in_datetime(self, obj):
        # booking_details stores dates as strings, not date objects
        check_in = obj.booking_details.get('check_in_date', '')
        return check_in if check_in else ""

    def get_check_out_datetime(self, obj):
        # booking_details stores dates as strings, not date objects
        check_out = obj.booking_details.get('check_out_date', '')
        return check_out if check_out else ""

    def get_advance_taken(self, obj):
        # obj IS the booking, get advance directly from booking_details
        advance = obj.booking_details.get('advance_amount', 0)
        if advance and advance > 0:
            return f"₹{advance:,.0f}"
        return "Not taken"

    def get_meal_preference(self, obj):
        # obj IS the booking, get meal preference directly
        return obj.booking_details.get('meal_preference', '')

    def get_travel_desk(self, obj):
        # Don't show travel desk for self-arranged bookings
        if obj.sub_option and 'self' in obj.sub_option.name.lower():
            return None
        
        try:
            assignment = obj.assignment
            return {
                'user': assignment.assigned_by.get_full_name() if assignment.assigned_by else "",
                'forwarded_at': format_datetime(assignment.assigned_at),
                'completed_at': format_datetime(assignment.completed_at),
                'remarks': assignment.notes
            }
        except BookingAssignment.DoesNotExist:
            return None

    def get_assignments(self, obj):
        # Get assignment from related booking
        try:
            related_booking = obj.trip_details.bookings.filter(
                booking_type__name='Accommodation'
            ).first()
            if related_booking:
                try:
                    assignment = related_booking.assignment
                    return [BookingAssignmentSerializer(assignment).data]
                except BookingAssignment.DoesNotExist:
                    pass
        except:
            pass
        return []

    def get_booking_notes(self, obj):
        # Get notes from related booking
        try:
            related_booking = obj.trip_details.bookings.filter(
                booking_type__name='Accommodation'
            ).first()
            if related_booking:
                notes = related_booking.notes.all()
                return BookingNoteSerializer(notes, many=True).data
        except:
            pass
        return []


class ConveyanceBookingSerializer(serializers.Serializer):
    """Serializer for conveyance bookings"""
    id = serializers.IntegerField()
    status = serializers.CharField()
    vehicle_type = serializers.SerializerMethodField()
    vehicle_subtype = serializers.SerializerMethodField()
    from_location = serializers.SerializerMethodField()
    to_location = serializers.SerializerMethodField()
    report_at = serializers.SerializerMethodField()
    drop_location = serializers.SerializerMethodField()
    start_datetime = serializers.SerializerMethodField()
    end_datetime = serializers.SerializerMethodField()
    distance_km = serializers.SerializerMethodField()
    passengers = serializers.SerializerMethodField()
    advance_taken = serializers.SerializerMethodField()
    special_instructions = serializers.CharField(source='special_instruction')
    club_booking = serializers.SerializerMethodField()
    club_booking_reason = serializers.SerializerMethodField()
    guests = serializers.SerializerMethodField()
    travel_desk = serializers.SerializerMethodField()
    assignments = serializers.SerializerMethodField()
    booking_notes = serializers.SerializerMethodField()

    def get_vehicle_type(self, obj):
        # Get from sub_option name or booking_details
        return obj.booking_type.name if obj.booking_type else obj.booking_details.get('booking_type', '')

    def get_vehicle_subtype(self, obj):
        return obj.sub_option.name if obj.sub_option else ""
    
    def get_from_location(self, obj):
        return obj.trip_details.from_location.city_name if obj.trip_details and obj.trip_details.from_location else ""
    
    def get_to_location(self, obj):
        return obj.trip_details.to_location.city_name if obj.trip_details and obj.trip_details.to_location else ""
    
    def get_report_at(self, obj):
        return obj.booking_details.get('report_at', '')
    
    def get_drop_location(self, obj):
        return obj.booking_details.get('drop_location', '')
    
    def get_passengers(self, obj):
        return obj.booking_details.get('no_of_person', 1)

    def get_start_datetime(self, obj):
        # Get from trip_details
        if obj.trip_details:
            return format_datetime_from_parts(obj.trip_details.departure_date, obj.trip_details.start_time)
        return ""

    def get_end_datetime(self, obj):
        # Get from trip_details
        if obj.trip_details:
            return format_datetime_from_parts(obj.trip_details.return_date, obj.trip_details.end_time)
        return ""

    def get_distance_km(self, obj):
        distance = obj.booking_details.get('approx_km') or obj.booking_details.get('distance_km')
        return str(distance) if distance else ""

    def get_advance_taken(self, obj):
        # obj IS the booking, get advance directly from booking_details
        advance = obj.booking_details.get('advance_amount', 0)
        if advance and advance > 0:
            return f"₹{advance:,.0f}"
        return "Not taken"

    def get_club_booking(self, obj):
        # obj IS the booking, get club_booking directly
        return obj.booking_details.get('club_booking', False)

    def get_club_booking_reason(self, obj):
        # obj IS the booking, get reason directly
        return obj.booking_details.get('club_booking_reason', '')

    def get_guests(self, obj):
        # obj IS the booking, get guests directly
        return obj.booking_details.get('guests', [])

    def get_travel_desk(self, obj):
        # Don't show travel desk for self-arranged bookings
        if obj.sub_option and 'self' in obj.sub_option.name.lower():
            return None
        
        try:
            assignment = obj.assignment
            return {
                'user': assignment.assigned_by.get_full_name() if assignment.assigned_by else "",
                'forwarded_at': format_datetime(assignment.assigned_at),
                'completed_at': format_datetime(assignment.completed_at),
                'remarks': assignment.notes
            }
        except BookingAssignment.DoesNotExist:
            return None

    def get_assignments(self, obj):
        # Get assignment from related booking
        try:
            related_booking = obj.trip_details.bookings.filter(
                booking_type__name='Conveyance'
            ).first()
            if related_booking:
                try:
                    assignment = related_booking.assignment
                    return [BookingAssignmentSerializer(assignment).data]
                except BookingAssignment.DoesNotExist:
                    pass
        except:
            pass
        return []

    def get_booking_notes(self, obj):
        # Get notes from related booking
        try:
            related_booking = obj.trip_details.bookings.filter(
                booking_type__name='Conveyance'
            ).first()
            if related_booking:
                notes = related_booking.notes.all()
                return BookingNoteSerializer(notes, many=True).data
        except:
            pass
        return []


class ApprovalWorkflowSerializer(serializers.ModelSerializer):
    """Serializer for approval workflow"""
    level = serializers.CharField(source='approval_level')
    approver = serializers.SerializerMethodField()
    approved_at = serializers.SerializerMethodField()
    created_at = serializers.SerializerMethodField()

    class Meta:
        model = TravelApprovalFlow
        fields = ['level', 'sequence', 'approver', 'status', 'approved_at', 'notes', 'created_at']

    def get_approver(self, obj):
        return obj.approver.get_full_name() if obj.approver else ""

    def get_approved_at(self, obj):
        return format_datetime(obj.approved_at)

    def get_created_at(self, obj):
        return format_datetime(obj.created_at)


class TravelApplicationDetailsSerializer(serializers.ModelSerializer):
    """Comprehensive serializer for travel application details"""
    application = serializers.SerializerMethodField()
    travel_details = serializers.SerializerMethodField()
    ticketing_bookings = serializers.SerializerMethodField()
    accommodation_bookings = serializers.SerializerMethodField()
    conveyance_bookings = serializers.SerializerMethodField()
    approval_workflow = serializers.SerializerMethodField()
    cancellation = serializers.SerializerMethodField()
    settlement = serializers.SerializerMethodField()
    timestamps = serializers.SerializerMethodField()
    can_edit = serializers.SerializerMethodField()

    class Meta:
        model = TravelApplication
        fields = [
            'application',
            'travel_details',
            'ticketing_bookings',
            'accommodation_bookings',
            'conveyance_bookings',
            'approval_workflow',
            'cancellation',
            'settlement',
            'timestamps',
            'can_edit'
        ]

    def get_application(self, obj):
        return {
            'travel_request_id': obj.get_travel_request_id(),
            'purpose': obj.purpose,
            'employee_name': obj.employee.get_full_name(),
            'employee_id': obj.employee.employee_id if hasattr(obj.employee, 'employee_id') else obj.employee.username,
            'grade': obj.employee.grade.name if hasattr(obj.employee, 'grade') and obj.employee.grade else "",
            'department': obj.employee.department.name if hasattr(obj.employee, 'department') and obj.employee.department else "",
            'designation': obj.employee.designation.name if hasattr(obj.employee, 'designation') and obj.employee.designation else "",
            'status': obj.status,
            'status_label': obj.get_status_display(),
            'bulk_upload_file': obj.bulk_upload_file.url if obj.bulk_upload_file else None
        }

    def get_travel_details(self, obj):
        # Get first trip for origin/destination
        first_trip = obj.trip_details.first()
        last_trip = obj.trip_details.last()
        
        return {
            'internal_order': obj.internal_order or "",
            'gl_code': f"{obj.general_ledger.gl_code} - {obj.general_ledger.short_description}" if obj.general_ledger else "",
            'sanction_number': obj.sanction_number or "",
            'trip_origin': first_trip.from_location.city_name if first_trip and first_trip.from_location else "",
            'trip_destination': last_trip.to_location.city_name if last_trip and last_trip.to_location else "",
            'start_datetime': self._get_trip_start_datetime(first_trip),
            'end_datetime': self._get_trip_end_datetime(last_trip)
        }

    def _get_trip_start_datetime(self, trip):
        if trip and trip.departure_date:
            if trip.start_time:
                from datetime import datetime
                dt = datetime.combine(trip.departure_date, trip.start_time)
                return format_datetime(dt)
            return format_date(trip.departure_date)
        return ""

    def _get_trip_end_datetime(self, trip):
        if trip and trip.return_date:
            if trip.end_time:
                from datetime import datetime
                dt = datetime.combine(trip.return_date, trip.end_time)
                return format_datetime(dt)
            return format_date(trip.return_date)
        return ""

    def get_ticketing_bookings(self, obj):
        # Get all flight/train bookings
        ticketing_bookings = []
        for trip in obj.trip_details.all():
            bookings = trip.bookings.filter(
                booking_type__name__in=['Flight', 'Train']
            ).select_related('booking_type', 'trip_details__from_location', 'trip_details__to_location')
            
            for booking in bookings:
                ticketing_bookings.append(booking)
        
        return TicketingBookingSerializer(ticketing_bookings, many=True).data

    def get_accommodation_bookings(self, obj):
        # Accommodation bookings are stored in the generic Booking table
        # Filter by booking_type name containing 'Accommodation'
        accommodation_bookings = Booking.objects.filter(
            trip_details__travel_application=obj,
            booking_type__name='Accommodation'
        ).select_related(
            'booking_type',
            'sub_option',
            'trip_details__from_location',
            'trip_details__to_location'
        )
        
        logger.info(f"DEBUG: Found {accommodation_bookings.count()} accommodation bookings for application {obj.id}")
        return AccommodationBookingSerializer(accommodation_bookings, many=True).data

    def get_conveyance_bookings(self, obj):
        # Conveyance bookings = all bookings that are NOT Flight, Train, or Accommodation
        # This makes it future-proof for new conveyance modes
        vehicle_bookings = Booking.objects.filter(
            trip_details__travel_application=obj
        ).exclude(
            booking_type__name__in=['Flight', 'Train', 'Accommodation']
        ).select_related(
            'booking_type',
            'sub_option',
            'trip_details__from_location',
            'trip_details__to_location'
        )
        
        logger.info(f"DEBUG: Found {vehicle_bookings.count()} vehicle bookings for application {obj.id}")
        return ConveyanceBookingSerializer(vehicle_bookings, many=True).data

    def get_approval_workflow(self, obj):
        approvals = obj.approval_flows.all().select_related('approver').order_by('sequence')
        return ApprovalWorkflowSerializer(approvals, many=True).data

    def get_cancellation(self, obj):
        if obj.status == 'cancelled' or obj.cancellation_requested_at:
            return {
                'requested_at': format_datetime(obj.cancellation_requested_at),
                'approved_at': format_datetime(obj.cancellation_approved_at),
                'reason': obj.cancellation_reason,
                'rejection_reason': obj.cancellation_rejection_reason,
                'cancelled_by': obj.cancelled_by.get_full_name() if obj.cancelled_by else ""
            }
        return None

    def get_settlement(self, obj):
        return {
            'is_settled': obj.is_settled,
            'settlement_due_date': format_date(obj.settlement_due_date)
        }

    def get_timestamps(self, obj):
        return {
            'created_at': format_datetime(obj.created_at),
            'submitted_at': format_datetime(obj.submitted_at),
            'updated_at': format_datetime(obj.updated_at)
        }
    
    def get_can_edit(self, obj):
        """Dynamically check if application can be edited"""
        from apps.travel.services.edit_helpers import can_edit_application
        
        request = self.context.get('request')
        
        if not request or not request.user:
            return False
        
        can_edit, _ = can_edit_application(obj, request.user)
        return can_edit
