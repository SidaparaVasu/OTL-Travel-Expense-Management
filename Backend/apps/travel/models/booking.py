from django.db import models
from django.core.validators import MinValueValidator
from decimal import Decimal
from django.utils import timezone

class Booking(models.Model):
    """
    Generic booking model for all travel modes
    """
    BOOKING_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('requested', 'Requested'),
        ('in_progress', 'In Progress'),
        ('confirmed', 'Confirmed'),
        ('cancelled', 'Cancelled'),
        ('completed', 'Completed'),
    ]
    
    trip_details = models.ForeignKey(
        'TripDetails', 
        on_delete=models.CASCADE, 
        related_name='bookings'
    )
    booking_type = models.ForeignKey(
        'master_data.TravelModeMaster', 
        on_delete=models.CASCADE
    )
    sub_option = models.ForeignKey(
        'master_data.TravelSubOptionMaster', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True
    )
    
    # Booking Details (stored as JSON for flexibility)
    booking_details = models.JSONField(default=dict)
    
    # Status and Cost
    status = models.CharField(max_length=20, choices=BOOKING_STATUS_CHOICES, default='pending')
    estimated_cost = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        default=0,
        validators=[MinValueValidator(0)],
        null=True,
        blank=True
    )
    actual_cost = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        null=True, 
        blank=True,
        validators=[MinValueValidator(0)]
    )

    special_instruction = models.TextField(blank=True, default='')
    
    # Booking Reference
    booking_reference = models.CharField(max_length=100, blank=True)
    vendor_reference = models.CharField(max_length=100, blank=True)
    
    # Files
    booking_file = models.FileField(upload_to=' booking_files/', blank=True, null=True)

    uploaded_by = models.ForeignKey(
        'authentication.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name="uploaded_booking_files"
    )
    uploaded_at = models.DateTimeField(null=True, blank=True)
    
    # Travel Desk Forwarding
    handling_travel_desk_user = models.ForeignKey(
        'authentication.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='handling_bookings',
        help_text="The specific travel desk user currently working on this booking."
    )
    travel_desk_forwarded_at = models.DateTimeField(
        null=True, 
        blank=True,
        help_text="When this booking was specifically forwarded to a desk user."
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    booked_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['trip_details', 'booking_type']),
            models.Index(fields=['status']),
        ]
    
    def __str__(self):
        return f"{self.booking_type.name} - {self.trip_details} ({self.status})"
    
    def requires_advance_booking_check(self):
        """Check if this booking requires advance booking validation"""
        from apps.travel.business_logic.validators import validate_advance_booking
        try:
            validate_advance_booking(
                self.trip_details.departure_date,
                self.booking_type.name,
                self.estimated_cost or 0
            )
            return False
        except:
            return True
        

class BookingAssignment(models.Model):
    """
    Assignment of a single booking to a booking agent.
    One booking -> one active assignment.
    """
    ASSIGNMENT_SCOPE_CHOICES = [
        ('single_booking', 'Single Booking'),
        ('full_application', 'Full Application'),
    ]

    booking = models.OneToOneField(
        'Booking',
        on_delete=models.CASCADE,
        related_name='assignment',
    )

    assigned_by = models.ForeignKey(
        'authentication.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='bookings_assigned',
    )

    assigned_to = models.ForeignKey(
        'authentication.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='bookings_received',
    )

    assignment_scope = models.CharField(
        max_length=20,
        choices=ASSIGNMENT_SCOPE_CHOICES,
        default='single_booking',
        help_text="Whether this assignment was created individually or via full application forwarding.",
    )

    requested_vehicle_type = models.ForeignKey(
        'master_data.VehicleTypeMaster',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Specific vehicle type requested for this assignment"
    )

    notes = models.TextField(blank=True)

    assigned_at = models.DateTimeField(auto_now_add=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=['assigned_to', 'assigned_at']),
        ]

    def __str__(self):
        return f"Booking {self.booking_id} -> {self.assigned_to} ({self.assignment_scope})"

    def mark_accepted(self):
        if not self.accepted_at:
            self.accepted_at = timezone.now()
            self.save(update_fields=['accepted_at'])

    def mark_completed(self):
        if not self.completed_at:
            self.completed_at = timezone.now()
            self.save(update_fields=['completed_at'])


class BookingNote(models.Model):
    booking = models.ForeignKey(
        'Booking',
        on_delete=models.CASCADE,
        related_name='notes',
    )
    author = models.ForeignKey(
        'authentication.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    note = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"Note for booking {self.booking_id} by {self.author}"
