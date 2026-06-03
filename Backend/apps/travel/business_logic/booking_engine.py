from django.db import transaction
from apps.master_data.models import GuestHouseMaster, ARCHotelMaster, LocationSPOC
from ..models import AccommodationBooking, VehicleBooking

# DEPRECATED: This model/component is not in use anymore and is marked for deletion.
# Status: Deprecated since June 2, 2026 — no active usage recorded.
class AccommodationBookingEngine:
    """
    TSF accommodation booking priority logic:
    1. Guest House (if available)
    2. ARC Hotels
    3. Alternative Hotels
    """
    
    def __init__(self, trip_details):
        self.trip_details = trip_details
        self.destination_location = trip_details.to_location
        self.check_in_date = trip_details.departure_date
        self.check_out_date = trip_details.return_date
        self.duration_nights = (self.check_out_date - self.check_in_date).days
    
    @transaction.atomic
    def process_accommodation_request(self, guest_count=1, special_requests=""):
        """
        Process accommodation booking following TSF priority
        """
        booking = AccommodationBooking.objects.create(
            trip_details=self.trip_details,
            accommodation_type='guest_house',  # Start with highest priority
            check_in_date=self.check_in_date,
            check_out_date=self.check_out_date,
            nights=self.duration_nights,
            guest_count=guest_count,
            special_requests=special_requests,
            status='pending'
        )
        
        # Try guest house first
        guest_house_result = self.try_guest_house_booking(booking)
        if guest_house_result['success']:
            return guest_house_result
        
        # Fallback to ARC hotels
        arc_hotel_result = self.try_arc_hotel_booking(booking)
        if arc_hotel_result['success']:
            return arc_hotel_result
        
        # Final fallback to alternative hotels
        return self.request_alternative_hotel(booking)
    
    def try_guest_house_booking(self, booking):
        """
        Try to book TSF Guest House
        """
        available_guest_houses = GuestHouseMaster.objects.filter(
            location=self.destination_location,
            is_active=True
        ).order_by('capacity')
        
        for guest_house in available_guest_houses:
            # Check availability (simplified - real implementation would check bookings)
            if self.check_guest_house_availability(guest_house):
                booking.guest_house = guest_house
                booking.accommodation_type = 'guest_house'
                booking.status = 'guest_house_requested'
                booking.rate_per_night = 0  # Guest houses are typically free
                booking.calculate_total_cost()
                booking.save()
                
                # Send booking request to guest house
                self.send_guest_house_request(booking)
                
                return {
                    'success': True,
                    'accommodation_type': 'guest_house',
                    'booking_id': booking.id,
                    'message': f'Guest house booking requested at {guest_house.name}'
                }
        
        return {'success': False, 'reason': 'No guest house availability'}
    
    def try_arc_hotel_booking(self, booking):
        """
        Try to book ARC Hotel
        """
        available_arc_hotels = ARCHotelMaster.objects.filter(
            city=self.destination_location.city,
            is_active=True
        ).filter(
            contract_start_date__lte=self.check_in_date,
            contract_end_date__gte=self.check_out_date
        ).order_by('rate_per_night')
        
        # Check user's grade entitlement for hotel category
        user_grade = self.trip_details.travel_application.employee.grade
        
        for arc_hotel in available_arc_hotels:
            if self.check_hotel_grade_entitlement(user_grade, arc_hotel):
                booking.arc_hotel = arc_hotel
                booking.accommodation_type = 'arc_hotel'
                booking.status = 'arc_hotel_requested'
                booking.rate_per_night = arc_hotel.rate_per_night
                booking.calculate_total_cost()
                booking.save()
                
                # Send booking request to ARC hotel
                self.send_arc_hotel_request(booking)
                
                return {
                    'success': True,
                    'accommodation_type': 'arc_hotel',
                    'booking_id': booking.id,
                    'hotel_name': arc_hotel.name,
                    'rate_per_night': arc_hotel.rate_per_night,
                    'message': f'ARC hotel booking requested at {arc_hotel.name}'
                }
        
        return {'success': False, 'reason': 'No suitable ARC hotel available'}
    
    def request_alternative_hotel(self, booking):
        """
        Request alternative hotel booking through travel partner
        """
        booking.accommodation_type = 'non_arc_hotel'
        booking.status = 'pending'
        booking.save()
        
        # Create travel desk task for alternative hotel booking
        self.create_alternative_hotel_task(booking)
        
        return {
            'success': True,
            'accommodation_type': 'non_arc_hotel',
            'booking_id': booking.id,
            'message': 'Alternative hotel booking forwarded to travel partner'
        }
    
    def check_guest_house_availability(self, guest_house):
        """Check guest house availability - REAL implementation"""
        from ..models import AccommodationBooking
        from django.db.models import Q
        
        # Get overlapping bookings
        overlapping = AccommodationBooking.objects.filter(
            guest_house=guest_house,
            status__in=['guest_house_confirmed', 'guest_house_requested'],
            check_in_date__lt=self.check_out_date,
            check_out_date__gt=self.check_in_date
        )
        
        # Count total rooms booked
        total_booked_rooms = overlapping.count()
        
        # Check if rooms available
        total_rooms = guest_house.total_rooms or 10  # Default if not set
        available_rooms = total_rooms - total_booked_rooms
        
        return available_rooms > 0
    
    def get_available_guest_houses(self):
        """Get list of available guest houses with room counts"""
        available_guest_houses = GuestHouseMaster.objects.filter(
            city=self.destination_location.city,
            is_active=True
        ).order_by('name')
        
        availability_list = []
        for gh in available_guest_houses:
            if self.check_guest_house_availability(gh):
                # Calculate available rooms
                overlapping = AccommodationBooking.objects.filter(
                    guest_house=gh,
                    status__in=['guest_house_confirmed', 'guest_house_requested'],
                    check_in_date__lt=self.check_out_date,
                    check_out_date__gt=self.check_in_date
                ).count()
                
                total_rooms = gh.total_rooms or 10
                available = total_rooms - overlapping
                
                availability_list.append({
                    'guest_house': gh,
                    'available_rooms': available,
                    'total_rooms': total_rooms
                })
        
        return availability_list
    
    def check_hotel_grade_entitlement(self, user_grade, arc_hotel):
        """
        Check if user's grade allows booking this hotel category
        """
        from apps.master_data.models import GradeEntitlement
        
        entitlement = GradeEntitlement.objects.filter(
            grade=user_grade,
            sub_option__name__icontains=arc_hotel.category,
            is_allowed=True
        ).first()
        
        return entitlement is not None
    
    def send_guest_house_request(self, booking):
        """
        Send booking request to guest house
        """
        # Email notification to guest house (implement in notifications)
        pass
    
    def send_arc_hotel_request(self, booking):
        """
        Send booking request to ARC hotel
        """
        # Email notification to ARC hotel (implement in notifications)
        pass
    
    def create_alternative_hotel_task(self, booking):
        """
        Create task for travel desk to book alternative hotel
        """
        # Create travel desk task (implement in workflow)
        pass

# DEPRECATED: This model/component is not in use anymore and is marked for deletion.
# Status: Deprecated since June 2, 2026 — no active usage recorded.
class VehicleBookingEngine:
    """
    Vehicle booking coordination with SPOC system
    """
    
    def __init__(self, trip_details):
        self.trip_details = trip_details
        self.travel_application = trip_details.travel_application
    
    @transaction.atomic
    def process_vehicle_request(self, vehicle_request_data):
        """
        Process vehicle booking request with SPOC coordination
        """
        vehicle_booking = VehicleBooking.objects.create(
            trip_details=self.trip_details,
            vehicle_type=vehicle_request_data['vehicle_type'],
            pickup_location=vehicle_request_data['pickup_location'],
            drop_location=vehicle_request_data['drop_location'],
            pickup_date=vehicle_request_data['pickup_date'],
            pickup_time=vehicle_request_data['pickup_time'],
            return_date=vehicle_request_data.get('return_date'),
            return_time=vehicle_request_data.get('return_time'),
            passenger_count=vehicle_request_data.get('passenger_count', 1),
            special_requirements=vehicle_request_data.get('special_requirements', ''),
            estimated_distance=vehicle_request_data.get('estimated_distance'),
            status='pending'
        )
        
        # Assign appropriate SPOC
        spoc = self.assign_vehicle_spoc(vehicle_booking)
        if spoc:
            vehicle_booking.assigned_spoc = spoc
            vehicle_booking.status = 'spoc_notified'
            vehicle_booking.save()
            
            # Notify SPOC
            self.notify_spoc(vehicle_booking, spoc)
            
            return {
                'success': True,
                'booking_id': vehicle_booking.id,
                'assigned_spoc': spoc.spoc_user.get_full_name(),
                'message': f'Vehicle request assigned to {spoc.spoc_user.get_full_name()}'
            }
        else:
            return {
                'success': False,
                'booking_id': vehicle_booking.id,
                'message': 'No SPOC available for this location'
            }
    
    def assign_vehicle_spoc(self, vehicle_booking):
        """
        Assign appropriate SPOC based on vehicle type and location
        """
        if vehicle_booking.vehicle_type in ['pickup_drop', 'local_transport']:
            spoc_type = 'local'
        else:
            spoc_type = 'inter_unit'
        
        # For pickup location SPOC
        pickup_location = self.get_location_from_address(vehicle_booking.pickup_location)
        
        spoc = LocationSPOC.objects.filter(
            location=pickup_location,
            spoc_type__in=[spoc_type, 'both'],
            is_active=True
        ).first()
        
        return spoc
    
    def get_location_from_address(self, address):
        """
        Extract location from address (simplified)
        """
        # In real implementation, use address parsing or location mapping
        return self.trip_details.from_location
    
    def notify_spoc(self, vehicle_booking, spoc):
        """
        Send notification to SPOC about vehicle request
        """
        # Email/SMS notification to SPOC (implement in notifications)
        pass