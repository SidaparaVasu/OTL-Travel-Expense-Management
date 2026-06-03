from django.db import models
from django.core.validators import MinValueValidator
from django.utils import timezone
from django.core.validators import FileExtensionValidator

# DEPRECATED: This model/component is not in use anymore and is marked for deletion.
# Status: Deprecated since June 2, 2026 — no active usage recorded.
class AccommodationBooking(models.Model):
    """
    Accommodation booking with TSF priority logic
    """
    ACCOMMODATION_TYPES = [
        ('guest_house', 'TSF Guest House'),
        ('arc_hotel', 'ARC Hotel'),
        ('non_arc_hotel', 'Non-ARC Hotel'),
        ('staying_with_friends', 'Staying with Friends/Relatives'),
    ]
    
    BOOKING_STATUS = [
        ('pending', 'Pending'),
        ('guest_house_requested', 'Guest House Requested'),
        ('guest_house_confirmed', 'Guest House Confirmed'),
        ('guest_house_rejected', 'Guest House Rejected'),
        ('arc_hotel_requested', 'ARC Hotel Requested'),
        ('arc_hotel_confirmed', 'ARC Hotel Confirmed'),
        ('arc_hotel_rejected', 'ARC Hotel Rejected'),
        ('alternative_hotel_booked', 'Alternative Hotel Booked'),
        ('cancelled', 'Cancelled'),
    ]
    
    trip_details = models.ForeignKey(
        'TripDetails', 
        on_delete=models.CASCADE,
        related_name='accommodation_bookings'
    )
    accommodation_type = models.CharField(max_length=30, choices=ACCOMMODATION_TYPES)
    check_in_date = models.DateField()
    check_out_date = models.DateField()
    nights = models.PositiveIntegerField()
    guest_count = models.PositiveIntegerField(default=1)
    
    # Priority booking references
    guest_house = models.ForeignKey(
        'master_data.GuestHouseMaster',
        on_delete=models.SET_NULL,
        null=True, blank=True
    )
    arc_hotel = models.ForeignKey(
        'master_data.ARCHotelMaster',
        on_delete=models.SET_NULL,
        null=True, blank=True
    )
    
    # Alternative hotel details
    hotel_name = models.CharField(max_length=200, blank=True)
    hotel_contact = models.CharField(max_length=100, blank=True)
    hotel_address = models.TextField(blank=True)
    
    # Booking details
    status = models.CharField(max_length=30, choices=BOOKING_STATUS, default='pending')
    room_type = models.CharField(max_length=50, blank=True)
    special_requests = models.TextField(blank=True)
    
    # Cost information
    rate_per_night = models.DecimalField(
        max_digits=8, decimal_places=2, 
        null=True, blank=True
    )
    total_cost = models.DecimalField(
        max_digits=10, decimal_places=2,
        null=True, blank=True
    )
    
    # Booking confirmation
    confirmation_number = models.CharField(max_length=100, blank=True)
    booking_reference = models.CharField(max_length=100, blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['trip_details', 'status']),
            models.Index(fields=['check_in_date', 'check_out_date']),
        ]
    
    def __str__(self):
        return f"{self.accommodation_type} - {self.trip_details} ({self.status})"
    
    def calculate_total_cost(self):
        if self.rate_per_night:
            self.total_cost = self.rate_per_night * self.nights
            return self.total_cost
        return None
    
    def clean(self):
        """Validate no booking conflicts"""
        from django.core.exceptions import ValidationError
        
        if self.guest_house and self.status in ['guest_house_confirmed', 'guest_house_requested']:
            # Check for overlapping bookings
            overlapping = AccommodationBooking.objects.filter(
                guest_house=self.guest_house,
                status__in=['guest_house_confirmed', 'guest_house_requested'],
                check_in_date__lt=self.check_out_date,
                check_out_date__gt=self.check_in_date
            ).exclude(pk=self.pk if self.pk else None)
            
            if overlapping.exists():
                total_rooms = self.guest_house.total_rooms or 10
                booked_rooms = overlapping.count()
                
                if booked_rooms >= total_rooms:
                    raise ValidationError(
                        f"No rooms available at {self.guest_house.name} "
                        f"for the selected dates. All {total_rooms} rooms are booked."
                    )
 
    def save(self, *args, **kwargs):
        """Override save to call clean()"""
        self.clean()
        super().save(*args, **kwargs)
 
# DEPRECATED: This model/component is not in use anymore and is marked for deletion.
# Status: Deprecated since June 2, 2026 — no active usage recorded.
class VehicleBooking(models.Model):
    """
    Vehicle booking with SPOC coordination
    """
    VEHICLE_TYPES = [
        ('pickup_drop', 'Airport/Station Pickup & Drop'),
        ('local_transport', 'Local Transportation'),
        ('inter_city', 'Inter-city Travel'),
        ('disposal', 'Car at Disposal'),
        ('own_car', 'Own Car'),
    ]
    
    BOOKING_STATUS = [
        ('pending', 'Pending'),
        ('spoc_notified', 'SPOC Notified'),
        ('vehicle_assigned', 'Vehicle Assigned'),
        ('duty_slip_generated', 'Duty Slip Generated'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]
    
    trip_details = models.ForeignKey(
        'TripDetails',
        on_delete=models.CASCADE,
        related_name='vehicle_bookings'
    )
    vehicle_type = models.CharField(max_length=20, choices=VEHICLE_TYPES)
    
    # Journey details
    pickup_location = models.CharField(max_length=200)
    drop_location = models.CharField(max_length=200)
    pickup_date = models.DateField()
    pickup_time = models.TimeField()
    return_date = models.DateField(null=True, blank=True)
    return_time = models.TimeField(null=True, blank=True)
    
    # Distance and duration
    estimated_distance = models.DecimalField(
        max_digits=8, decimal_places=2,
        null=True, blank=True,
        help_text="Distance in kilometers"
    )
    estimated_duration = models.DurationField(null=True, blank=True)
    
    # Vehicle requirements
    passenger_count = models.PositiveIntegerField(default=1)
    vehicle_category = models.ForeignKey(
        'master_data.VehicleTypeMaster',
        on_delete=models.SET_NULL,
        null=True, blank=True
    )
    special_requirements = models.TextField(blank=True)
    
    # SPOC and coordination
    assigned_spoc = models.ForeignKey(
        'master_data.LocationSPOC',
        on_delete=models.SET_NULL,
        null=True, blank=True
    )
    vendor_name = models.CharField(max_length=100, blank=True)
    driver_name = models.CharField(max_length=100, blank=True)
    driver_phone = models.CharField(max_length=15, blank=True)
    vehicle_number = models.CharField(max_length=20, blank=True)
    
    # Own car details
    own_car_details = models.JSONField(default=dict, blank=True)
    
    # Status and tracking
    status = models.CharField(max_length=20, choices=BOOKING_STATUS, default='pending')
    duty_slip_number = models.CharField(max_length=50, blank=True)
    
    # Cost
    estimated_cost = models.DecimalField(
        max_digits=10, decimal_places=2,
        null=True, blank=True
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['trip_details', 'status']),
            models.Index(fields=['assigned_spoc', 'status']),
        ]
    
    def __str__(self):
        return f"{self.vehicle_type} - {self.pickup_location} to {self.drop_location}"

class TravelDocument(models.Model):
    """
    Document management for travel applications
    """
    DOCUMENT_TYPES = [
        ('booking_confirmation', 'Booking Confirmation'),
        ('ticket', 'Travel Ticket'),
        ('hotel_voucher', 'Hotel Voucher'),
        ('duty_slip', 'Vehicle Duty Slip'),
        ('bill', 'Bill/Invoice'),
        ('receipt', 'Payment Receipt'),
        ('approval_document', 'Approval Document'),
        ('other', 'Other'),
    ]
    
    travel_application = models.ForeignKey(
        'TravelApplication',
        on_delete=models.CASCADE,
        related_name='documents'
    )
    document_type = models.CharField(max_length=30, choices=DOCUMENT_TYPES)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    
    # File information
    file = models.FileField(
        upload_to='travel_documents/%Y/%m/',
        validators=[
            FileExtensionValidator(
                allowed_extensions=['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx']
            )
        ]
    )
    file_size = models.PositiveIntegerField(null=True, blank=True)
    file_type = models.CharField(max_length=50, blank=True)

    thumbnail = models.ImageField(upload_to='travel_documents/thumbnails/', blank=True, null=True)
    version = models.PositiveIntegerField(default=1)
    parent_document = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='versions'
    )
    
    # Metadata
    uploaded_by = models.ForeignKey(
        'authentication.User',
        on_delete=models.CASCADE,
        related_name='uploaded_documents'
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)
    
    # Booking reference (if applicable)
    related_booking = models.ForeignKey(
        'Booking',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='documents'
    )
    
    is_active = models.BooleanField(default=True)
    
    class Meta:
        ordering = ['-uploaded_at']
        indexes = [
            models.Index(fields=['travel_application', 'document_type']),
            models.Index(fields=['uploaded_by', 'uploaded_at']),
        ]
    
    def __str__(self):
        return f"{self.document_type} - {self.title}"
    
    def save(self, *args, **kwargs):
        if self.file:
            self.file_size = self.file.size
            self.file_type = self.file.name.split('.')[-1] if '.' in self.file.name else ''
        super().save(*args, **kwargs)

    def clean(self):
        from django.core.exceptions import ValidationError
        
        # Max file size: 10MB
        if self.file and self.file.size > 10 * 1024 * 1024:
            raise ValidationError('File size cannot exceed 10MB')
        
        # Validate file type
        if self.file:
            ext = self.file.name.split('.')[-1].lower()
            if ext not in ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx']:
                raise ValidationError(f'File type .{ext} not allowed')


"""
UPDATE: TravelDocument model:

# Add these validators
from django.core.validators import FileExtensionValidator

# Update file field:
file = models.FileField(
    upload_to='travel_documents/%Y/%m/',
    validators=[
        FileExtensionValidator(
            allowed_extensions=['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx']
        )
    ]
)

# Add new fields:
thumbnail = models.ImageField(upload_to='travel_documents/thumbnails/', blank=True, null=True)
version = models.PositiveIntegerField(default=1)
parent_document = models.ForeignKey(
    'self',
    on_delete=models.SET_NULL,
    null=True,
    blank=True,
    related_name='versions'
)

# Add validation method:
def clean(self):
    from django.core.exceptions import ValidationError
    
    # Max file size: 10MB
    if self.file and self.file.size > 10 * 1024 * 1024:
        raise ValidationError('File size cannot exceed 10MB')
    
    # Validate file type
    if self.file:
        ext = self.file.name.split('.')[-1].lower()
        if ext not in ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx']:
            raise ValidationError(f'File type .{ext} not allowed')
"""