from django.db import models
from django.core.validators import MinValueValidator
from django.utils import timezone
from django.core.exceptions import ValidationError
from decimal import Decimal
from apps.master_data.models.geography import CityMaster

class TravelApplication(models.Model):
    """
    Enhanced travel application with TSF-specific requirements
    """
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('submitted', 'Submitted'), 
        ('pending_manager', 'Pending Manager Approval'),
        ('approved_manager', 'Approved by Manager'),
        ('rejected_manager', 'Rejected by Manager'),
        ('pending_chro', 'Pending CHRO Approval'),
        ('approved_chro', 'Approved by CHRO'),
        ('rejected_chro', 'Rejected by CHRO'),
        ('pending_ceo', 'Pending CEO Approval'),
        ('approved_ceo', 'Approved by CEO'),
        ('rejected_ceo', 'Rejected by CEO'),
        ('pending_travel_desk', 'Pending Travel Desk'),
        ('booking_in_progress', 'Booking in Progress'),
        ('booked', 'Bookings Confirmed'),
        ('completed', 'Travel Completed'),
        ('cancelled', 'Cancelled'),
    ]

    VALID_STATUS_TRANSITIONS = {
        'draft': ['submitted', 'pending_manager', 'pending_ceo', 'pending_chro', 'pending_travel_desk', 'cancelled'],
        'submitted': ['pending_manager', 'pending_ceo', 'pending_chro', 'cancelled'],
        'pending_manager': ['approved_manager', 'rejected_manager', 'cancelled'],
        'approved_manager': ['pending_chro', 'pending_ceo', 'pending_travel_desk', 'cancelled'],
        'rejected_manager': ['draft', 'cancelled'],
        'pending_chro': ['approved_chro', 'rejected_chro', 'cancelled'],
        'approved_chro': ['pending_ceo', 'pending_travel_desk', 'cancelled'],
        'rejected_chro': ['draft', 'cancelled'],
        'pending_ceo': ['approved_ceo', 'rejected_ceo', 'cancelled'],
        'approved_ceo': ['pending_travel_desk', 'cancelled'],
        'rejected_ceo': ['draft', 'cancelled'],
        'pending_travel_desk': ['booking_in_progress', 'cancelled'],
        'booking_in_progress': ['booked', 'pending_travel_desk', 'cancelled'],
        'booked': ['completed', 'cancelled'],
        'completed': ['completed'],
        'cancelled': ['cancelled'],
    }


    # Basic Information
    employee = models.ForeignKey(
        'authentication.User', 
        on_delete=models.CASCADE, 
        related_name='travel_applications'
    )
    purpose = models.TextField(help_text="Purpose of travel")
    
    # TSF Required Fields
    internal_order = models.CharField(
        max_length=50, 
        help_text="IO reference number"
    )
    general_ledger = models.ForeignKey(
        'master_data.GLCodeMaster',
        on_delete=models.PROTECT,
        help_text="GL code for expenses"
    )
    sanction_number = models.CharField(
        max_length=50,
        help_text="Sanction number for approval",
        null=True, blank=True
    )
    
    # Financial
    advance_amount = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        default=0,
        validators=[MinValueValidator(0)],
        help_text="Advance amount requested",
        blank=True,
        null=True
    )
    estimated_total_cost = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        default=0,
        validators=[MinValueValidator(0)]
    )
    
    # Status and Tracking
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='draft')
    is_settled = models.BooleanField(default=False)
    settlement_due_date = models.DateField(null=True, blank=True)

    # Cancellation
    cancellation_requested_at = models.DateTimeField(null=True, blank=True)
    cancellation_approved_at = models.DateTimeField(null=True, blank=True)
    cancellation_reason = models.TextField(blank=True)
    cancelled_by = models.ForeignKey(
        'authentication.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cancelled_travel_apps'
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    submitted_at = models.DateTimeField(null=True, blank=True)

    # Travel desk / booking workflow
    travel_desk_user = models.ForeignKey(
        'authentication.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='travel_desk_applications',
        help_text="Primary travel desk owner handling this application.",
    )

    booking_forwarded_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the application was first forwarded to booking agent(s).",
    )

    booking_completed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When all bookings were confirmed.",
    )
    
    # Approval Tracking
    current_approver = models.ForeignKey(
        'authentication.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='pending_approvals'
    )

    self_approved = models.BooleanField(default=False)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['employee', 'status']),
            models.Index(fields=['status', 'current_approver']),
            models.Index(fields=['created_at']),
        ]
    
    def __str__(self):
        return f"TR-{self.id} - {self.employee.username} ({self.status})"
    
    def get_travel_request_id(self):
        """Generate formatted travel request ID"""
        return f"TSF-TR-{self.created_at.year}-{self.id:06d}"
    
    def calculate_estimated_cost(self):
        """Calculate estimated cost from trip details"""
        total = Decimal('0')
        for trip in self.trip_details.all():
            for booking in trip.bookings.all():
                total += booking.estimated_cost or Decimal('0')
        self.estimated_total_cost = total
        return total
    
    def get_travel_duration_days(self):
        """Get total travel duration in days"""
        if not self.trip_details.exists():
            return 0
        
        earliest_departure = self.trip_details.aggregate(
            min_date=models.Min('departure_date')
        )['min_date']
        
        latest_return = self.trip_details.aggregate(
            max_date=models.Max('return_date')
        )['max_date']
        
        if earliest_departure and latest_return:
            return (latest_return - earliest_departure).days + 1
        return 0
    
    def requires_advance_booking_validation(self):
        """Check if any bookings require advance booking validation"""
        for trip in self.trip_details.all():
            for booking in trip.bookings.all():
                if booking.requires_advance_booking_check():
                    return True
        return False
    
    def set_settlement_due_date(self):
        """Set settlement due date (30 days after latest return date)"""
        latest_return = self.trip_details.aggregate(
            max_date=models.Max('return_date')
        )['max_date']
        
        if latest_return:
            from datetime import timedelta
            self.settlement_due_date = latest_return + timedelta(days=30)
            self.save(update_fields=['settlement_due_date'])

    def update_status_after_approval(self, approved_flow):
        """
        Update application status after an approval step is completed
        """
        # Get next pending approval
        next_approval = self.approval_flows.filter(
            sequence__gt=approved_flow.sequence,
            status='pending'
        ).order_by('sequence').first()
        
        if next_approval:
            # Move to next approval step
            self.current_approver = next_approval.approver
            self.status = f'pending_{next_approval.approval_level}'
        else:
            # All approvals completed - send to travel desk
            self.current_approver = None
            self.status = 'pending_travel_desk'
        
        self.save()

    def can_transition_to(self, new_status):
        """
        Check if status transition is valid
        Returns: (is_valid: bool, error_message: str)
        """
        current_status = self.status
        
        # Check if transition is allowed
        allowed_transitions = self.VALID_STATUS_TRANSITIONS.get(current_status, [])
        
        if new_status not in allowed_transitions:
            return False, f"Cannot transition from '{current_status}' to '{new_status}'. Allowed transitions: {', '.join(allowed_transitions)}"
        
        # Additional business rule validations
        
        # Cannot submit without trip details
        submit_statuses = ['submitted', 'pending_manager', 'pending_ceo', 'pending_chro', 'pending_travel_desk']
        if new_status in submit_statuses and not self.trip_details.exists():
            return False, "Cannot submit travel request without trip details"

        # Cannot submit without bookings
        if new_status in submit_statuses:
            has_bookings = any(trip.bookings.exists() for trip in self.trip_details.all())
            if not has_bookings:
                return False, "Cannot submit travel request without booking details"
        
        # Cannot move to booking stages without approvals
        if new_status == 'pending_travel_desk':
            required_approvals = self.approval_flows.filter(is_required=True)
            if required_approvals.exists():
                pending_approvals = required_approvals.filter(status='pending')
                if pending_approvals.exists():
                    return False, "Cannot proceed to travel desk with pending approvals"
        
        # Cannot complete without bookings confirmed
        if new_status == 'completed' and self.status != 'booked':
            return False, "Cannot mark as completed without confirmed bookings"
        
        return True, "Transition allowed"
    
    # def _create_status_audit_log(self, old_status, new_status, user, notes):
    #     """Create audit log for status changes (placeholder for future enhancement)"""
    #     # TODO: Implement StatusChangeLog model if detailed audit trail needed
    #     pass

    def can_cancel(self, user):
        """Check if user can cancel this application"""
        # Can cancel if:
        # 1. Owner and status is not completed
        # 2. Admin/Travel Desk can cancel any
        # 3. Cannot cancel if travel already started
        
        if self.status == 'completed':
            return False, "Cannot cancel completed travel"
        
        if self.status == 'cancelled':
            return False, "Already cancelled"
        
        # Check if travel has started
        earliest_departure = self.trip_details.aggregate(
            min_date=models.Min('departure_date')
        )['min_date']
        
        if earliest_departure and earliest_departure <= timezone.now().date():
            return False, "Cannot cancel - travel has already started"
        
        # Check user permission
        if self.employee == user:
            return True, "Can cancel"
        
        if user.has_role('Admin') or user.has_role('Travel Desk'):
            return True, "Can cancel"
        
        return False, "You don't have permission to cancel this application"

    def cancel_application(self, cancelled_by, reason):
        """Cancel the travel application"""
        can_cancel, message = self.can_cancel(cancelled_by)
        
        if not can_cancel:
            raise ValidationError(message)
        
        self.status = 'cancelled'
        self.cancelled_by = cancelled_by
        self.cancellation_reason = reason
        self.cancellation_requested_at = timezone.now()
        self.cancellation_approved_at = timezone.now()
        self.save()
        
        # Cancel all bookings
        self._cancel_all_bookings()
        
        # Send cancellation emails
        self._send_cancellation_notifications()

    def _cancel_all_bookings(self):
        """Cancel all associated bookings"""
        from apps.travel.models import AccommodationBooking, VehicleBooking
        
        # Cancel accommodation bookings
        AccommodationBooking.objects.filter(
            trip_details__travel_application=self
        ).update(status='cancelled')
        
        # Cancel vehicle bookings
        VehicleBooking.objects.filter(
            trip_details__travel_application=self
        ).update(status='cancelled')
        
        # Cancel generic bookings
        for trip in self.trip_details.all():
            trip.bookings.update(status='cancelled')

    def _send_cancellation_notifications(self):
        """Send cancellation notifications"""
        # Notify employee
        # Notify approvers
        # Notify travel desk
        pass  # Implement email logic when notifications ready

    def mark_booking_in_progress(self, travel_desk_user=None):
        """
        Move application from pending_travel_desk -> booking_in_progress.
        Called when Travel Desk forwards bookings to booking agent(s).
        """
        if self.status != 'pending_travel_desk':
            raise ValidationError("Can only mark as booking in progress from 'pending_travel_desk' status.")

        self.status = 'booking_in_progress'
        if travel_desk_user:
            self.travel_desk_user = travel_desk_user
        if not self.booking_forwarded_at:
            self.booking_forwarded_at = timezone.now()

        self.save(update_fields=['status', 'travel_desk_user', 'booking_forwarded_at'])

    def refresh_booking_status_from_children(self):
        """
        Recompute application-level booking status based on child bookings.
        If all bookings are confirmed -> set status to 'booked'.
        """
        trips = self.trip_details.all()
        if not trips.exists():
            return

        all_bookings = []
        for trip in trips:
            all_bookings.extend(list(trip.bookings.all()))

        if not all_bookings:
            return

        # All confirmed -> mark booked
        if all(b.status == 'confirmed' for b in all_bookings):
            self.status = 'booked'
            self.booking_completed_at = timezone.now()
            self.save(update_fields=['status', 'booking_completed_at'])

    def get_travel_start_date(self):
        """Earliest departure date across all trips"""
        return self.trip_details.aggregate(
            min_date=models.Min('departure_date')
        )['min_date']

    def get_travel_end_date(self):
        """Latest return date across all trips"""
        return self.trip_details.aggregate(
            max_date=models.Max('return_date')
        )['max_date']


class TripDetails(models.Model):
    """
    Individual trip segments within a travel application
    """
    travel_application = models.ForeignKey(
        TravelApplication, 
        on_delete=models.CASCADE, 
        related_name='trip_details'
    )
    
    # Location Information
    from_location = models.ForeignKey(
        CityMaster,
        on_delete=models.PROTECT,
        related_name='trips_from'
    )
    to_location = models.ForeignKey(
        CityMaster,
        on_delete=models.PROTECT,
        related_name='trips_to'
    )
    
    # Dates
    departure_date = models.DateField()
    return_date = models.DateField()

    # (NEW Fields) Times
    start_time = models.TimeField(
        help_text="Exact start time of travel",
        null=False,
        blank=False
    )

    end_time = models.TimeField(
        help_text="Exact end time of travel",
        null=True,
        blank=True
    )
    
    # Trip specific details
    trip_purpose = models.TextField(blank=True, help_text="Specific purpose for this trip segment")
    guest_count = models.PositiveIntegerField(default=0, help_text="Number of guests accompanying")

    # Distance tracking for DA calculation
    estimated_distance_km = models.DecimalField(
        max_digits=8, 
        decimal_places=2, 
        null=True, 
        blank=True,
        help_text="Estimated one-way distance in kilometers"
    )
    
    class Meta:
        ordering = ['departure_date']
        indexes = [
            models.Index(fields=['travel_application', 'departure_date']),
        ]
    
    def __str__(self):
        return f"{self.from_location.city_name} → {self.to_location.city_name} ({self.departure_date})"
    
    def clean(self):
        from django.core.exceptions import ValidationError
        if self.return_date < self.departure_date:
            raise ValidationError("Return date cannot be earlier than departure date")
    
    def get_duration_days(self):
        """Get duration of this trip in days"""
        return (self.return_date - self.departure_date).days + 1
    
    def get_city_category(self):
        """Get destination city category for DA calculation"""
        # return self.to_location.city.category.name
        # return self.to_location.category.name
        return self.to_location.category.name if self.to_location.category else None     