from django.db import models
from django.core.validators import MinValueValidator
from django.utils import timezone
from django.core.exceptions import ValidationError
from decimal import Decimal
import datetime
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
        ('cancellation_requested', 'Cancellation Requested'),
        ('cancelled', 'Cancelled'),
    ]

    VALID_STATUS_TRANSITIONS = {
        'draft': ['submitted', 'pending_manager', 'pending_ceo', 'pending_chro', 'pending_travel_desk', 'cancelled'],
        'submitted': ['pending_manager', 'pending_ceo', 'pending_chro', 'cancelled'],
        'pending_manager': ['approved_manager', 'rejected_manager', 'cancellation_requested', 'cancelled'],
        'approved_manager': ['pending_chro', 'pending_ceo', 'pending_travel_desk', 'booked', 'cancellation_requested', 'cancelled'],
        'rejected_manager': ['draft', 'cancelled'],
        'pending_chro': ['approved_chro', 'rejected_chro', 'cancellation_requested', 'cancelled'],
        'approved_chro': ['pending_ceo', 'pending_travel_desk', 'booked', 'cancellation_requested', 'cancelled'],
        'rejected_chro': ['draft', 'cancelled'],
        'pending_ceo': ['approved_ceo', 'rejected_ceo', 'cancellation_requested', 'cancelled'],
        'approved_ceo': ['pending_travel_desk', 'booked', 'cancellation_requested', 'cancelled'],
        'rejected_ceo': ['draft', 'cancelled'],
        'pending_travel_desk': ['booking_in_progress', 'booked', 'cancellation_requested', 'cancelled'],
        'booking_in_progress': ['booked', 'pending_travel_desk', 'cancellation_requested', 'cancelled'],
        'booked': ['completed', 'cancellation_requested', 'cancelled'],
        'cancellation_requested': ['cancelled', 'draft', 'submitted', 'pending_manager', 'approved_manager', 'pending_chro', 'approved_chro', 'pending_ceo', 'approved_ceo', 'pending_travel_desk', 'booking_in_progress', 'booked'],
        'completed': ['completed'],
        'cancelled': ['cancelled'],
    }


    # Basic Information
    employee = models.ForeignKey(
        'authentication.User', 
        on_delete=models.CASCADE, 
        related_name='travel_applications'
    )
    
    TRAVEL_FOR_CHOICES = [
        ('self', 'Self'),
        ('guest', 'Guest'),
        ('self_guest', 'Self + Guest'),
    ]
    
    travel_for = models.CharField(
        max_length=20,
        choices=TRAVEL_FOR_CHOICES,
        default='self',
        help_text="Who is travelling?"
    )

    purpose = models.TextField(help_text="Purpose of travel")
    
    # TSF Required Fields
    internal_order = models.CharField(
        max_length=50, 
        help_text="IO reference number",
        null=True, blank=True
    )
    general_ledger = models.ForeignKey(
        'master_data.GLCodeMaster',
        on_delete=models.PROTECT,
        help_text="GL code for expenses",
        null=True, blank=True
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
    
    # Bulk Booking (LEGACY)
    # Used before per-booking bulk file support was introduced.
    # Preserved for existing records only — do NOT write to this field for new applications.
    # New applications use Booking.bulk_booking_file instead.
    bulk_upload_file = models.FileField(
        upload_to='travel/bulk_uploads/%Y/%m/',
        null=True,
        blank=True,
        help_text="[LEGACY] Application-level bulk booking file. Use Booking.bulk_booking_file for new records."
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
    cancellation_rejection_reason = models.TextField(blank=True, help_text="Reason for rejecting cancellation request")
    cancelled_by = models.ForeignKey(
        'authentication.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cancelled_travel_apps'
    )
    previous_status = models.CharField(
        max_length=30, 
        choices=STATUS_CHOICES, 
        null=True, 
        blank=True,
        help_text="Status before cancellation was requested"
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

    # User-selected approver (overrides reporting_manager when set).
    # Must be a user with grade B-2A/B-2B/B-3 or active TemporaryApproverAuthorization.
    # NULL = use reporting_manager (backward compatible with all existing TRs).
    selected_approver = models.ForeignKey(
        'authentication.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='travel_applications_as_selected_approver',
        help_text="Optional: User-selected approver. Overrides reporting_manager when set."
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
        return f"{self.get_travel_request_id()} - {self.employee.username} ({self.status})"
    
    def get_travel_request_id(self):
        """Generate formatted travel request ID"""
        # Format: TR/TSF/YYYY/0000000 (7 digit sequence)
        return f"TR/TSF/{self.created_at.year}/{self.id:07d}"
    
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
            # All approvals completed
            self.current_approver = None
            
            # Smart Routing: Check if we can skip Travel Desk
            bookings_exist = any(trip.bookings.exists() for trip in self.trip_details.all())
            all_bookings_skipped = all(trip.no_bookings_required for trip in self.trip_details.all())
            # Handle NoneType for advance_amount by treating None as 0
            advance = self.advance_amount if self.advance_amount is not None else Decimal('0')
            no_advance_needed = advance <= 0
            
            if not bookings_exist and all_bookings_skipped and no_advance_needed:
                # Scenario A: "Pure Self-Managed Trip" -> Skip Travel Desk
                self.status = 'booked'
                self.booking_completed_at = timezone.now()
            else:
                # Scenario B/C: Needs booking or advance -> Route to Travel Desk
                self.status = 'pending_travel_desk'
                
            self.save()  # Save first to ensure status is updated

            # Helper to trigger auto-forwarding (only if going to travel desk/bookings)
            if self.status == 'pending_travel_desk':
                # Trigger Notification for Travel Desk
                try:
                    from apps.notifications.center import NotificationCenter
                    NotificationCenter.notify(
                        event_name="travel.assigned.travel_desk",
                        reference={"type": "TravelRequest", "id": self.id},
                        payload=self.get_notification_payload()
                    )
                except Exception as ne:
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.error(f"Failed to send travel.assigned.travel_desk notification: {str(ne)}")

                try:
                    from apps.travel.services.auto_forward_bookings import auto_forward_flight_train_bookings, auto_confirm_self_arranged_bookings
                    # Use the last approver as the system user for audit
                    auto_forward_flight_train_bookings(self, system_user=approved_flow.approver)
                    auto_confirm_self_arranged_bookings(self, system_user=approved_flow.approver)
                except Exception as e:
                    # Log error but don't fail the approval
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.error(f"Failed to auto-forward bookings for app {self.id}: {str(e)}")
            
            # Schedule auto-completion task
            self.schedule_completion_task()
            
            return
        
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

        # Cannot submit without bookings (unless all trips are marked no_bookings_required)
        if new_status in submit_statuses:
            has_bookings = any(trip.bookings.exists() for trip in self.trip_details.all())
            no_bookings_required = all(trip.no_bookings_required for trip in self.trip_details.all())

            if not has_bookings and not no_bookings_required:
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

    def create_bulk_booking_if_needed(self):
        """
        Automatically create a 'Bulk Upload' booking if a legacy application-level
        bulk file is present and no such booking exists yet.

        LEGACY ONLY: This method only runs for old applications that used
        TravelApplication.bulk_upload_file. New applications attach bulk files
        directly to individual Booking records via Booking.bulk_booking_file.
        """
        if not self.bulk_upload_file:
            return

        from apps.travel.models.booking import Booking
        from apps.master_data.models.travel import TravelModeMaster

        # Skip if any booking already has a per-booking bulk file (new-style record).
        # This prevents double-processing if an application was partially migrated.
        if Booking.objects.filter(
            trip_details__travel_application=self,
            bulk_booking_file__isnull=False
        ).exclude(bulk_booking_file='').exists():
            return

        # Get or Create 'Bulk Booking' mode (safety check)
        bulk_mode, _ = TravelModeMaster.objects.get_or_create(
            name="Bulk Booking", 
            defaults={"description": "Bulk booking for guest(s) applications", "is_active": True}
        )

        # Check if already exists for this application
        exists = Booking.objects.filter(
            trip_details__travel_application=self,
            booking_type=bulk_mode
        ).exists()

        if exists:
            return

        # We need a TripDetails to attach the booking to.
        # Use the first one. If none exists (unlikely given validation), we can't create it.
        trip = self.trip_details.first()
        if not trip:
            return

        Booking.objects.create(
            trip_details=trip,
            booking_type=bulk_mode,
            status='pending',
            booking_file=self.bulk_upload_file,  # Copy the legacy file reference
            special_instruction="Bulk Bookings Upload",
            booking_details={
                "is_system_generated": True,
                "source": "bulk_booking"
            },
            estimated_cost=0
        )

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

    def request_cancellation(self, requested_by, reason):
        """Step 1: Applicant requests cancellation"""
        from django.utils import timezone
        
        # 1. Prevent duplicate cancellation requests
        if self.status == 'cancellation_requested':
            raise ValidationError(
                "A cancellation request is already pending for this application. "
                "Please wait for your manager's decision or withdraw the existing request."
            )
        
        # 2. Check if application is in CEO approval
        if self.status == 'pending_ceo':
            raise ValidationError(
                "This application is pending CEO approval. "
                "Please contact your manager or Travel Desk to request cancellation."
            )
        
        # 3. Check if travel has already started
        start_date = self.get_travel_start_date()
        if start_date and start_date < timezone.now().date():
            raise ValidationError(
                "Cannot request cancellation - Travel has already started. "
                "Please contact Travel Desk for assistance."
            )
        
        # 4. Check if already cancelled or completed
        if self.status in ['cancelled', 'completed']:
            raise ValidationError(
                f"Cannot request cancellation - Application is already {self.get_status_display()}."
            )
        
        # 5. Check if in draft or rejected state
        if self.status in ['draft', 'rejected']:
            raise ValidationError(
                f"Cannot request cancellation - Application is in {self.get_status_display()} state."
            )
        
        # Check basic ownership/role (more specific checks in views)
        if self.employee != requested_by and not (requested_by.has_role('Admin') or requested_by.has_role('Travel Desk')):
             # Manager check might be needed here too if they can request cancellation FOR the user?
             # The requirement says Applicant requests.
             pass

        # [MODIFIED]: Unlinked approval flow. Direct cancellation requested.
        # self.previous_status = self.status
        # self.status = 'cancellation_requested'
        # self.cancellation_requested_at = timezone.now()
        # self.cancellation_reason = reason
        # self.save()

        # Audit Log
        # from apps.travel.models.audit import AuditLog
        # from django.contrib.contenttypes.models import ContentType
        # AuditLog.objects.create(
        #     user=requested_by,
        #     action='cancel', # Using 'cancel' action to denote request/start of flow
        #     content_type=ContentType.objects.get_for_model(self),
        #     object_id=self.id,
        #     changes={
        #         "previous_status": self.previous_status,
        #         "current_status": "cancellation_requested",
        #         "reason": reason
        #     }
        # )
        
        # Send cancellation request notification
        # try:
        #     from apps.notifications.cancellation_service import CancellationNotificationService
        #     CancellationNotificationService.send_cancellation_request_notification(self)
        # except Exception as e:
        #     import logging
        #     logger = logging.getLogger(__name__)
        #     logger.error(f"Failed to send cancellation request notification: {str(e)}", exc_info=True)

        # Direct Cancellation Implementation
        self._perform_hard_cancel(requested_by, reason)

    def approve_cancellation(self, approved_by, notes=""):
        """Step 2: Manager/Admin approves cancellation"""
        if self.status != 'cancellation_requested':
            # Fallback for old apps or admin hard-cancel
            if not (approved_by.has_role('Admin') or approved_by.has_role('Travel Desk')):
                raise ValidationError("Can only approve cancellation requests.")

        self._perform_hard_cancel(approved_by, notes)
        
        # Send cancellation approval notification
        try:
            from apps.notifications.cancellation_service import CancellationNotificationService
            CancellationNotificationService.send_cancellation_approval_notification(self, approved_by, notes)
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to send cancellation approval notification: {str(e)}", exc_info=True)

    def reject_cancellation(self, rejected_by, reason):
        """Step 2: Manager rejects cancellation"""
        if self.status != 'cancellation_requested':
            raise ValidationError("No pending cancellation request to reject.")

        if not self.previous_status:
            raise ValidationError("Previous status lost. Cannot restore.")

        old_status = self.status
        self.status = self.previous_status
        self.cancellation_rejection_reason = reason  # Store rejection reason
        # self.previous_status = None # Keep it for audit? Or clear it? 
        self.save()

        # Audit Log
        from apps.travel.models.audit import AuditLog
        from django.contrib.contenttypes.models import ContentType
        AuditLog.objects.create(
            user=rejected_by,
            action='reject',
            content_type=ContentType.objects.get_for_model(self),
            object_id=self.id,
            changes={
                "previous_status": old_status,
                "new_status": self.status,
                "reason": reason
            }
        )
        
        # Send cancellation rejection notification
        try:
            from apps.notifications.cancellation_service import CancellationNotificationService
            CancellationNotificationService.send_cancellation_rejection_notification(self, rejected_by, reason)
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to send cancellation rejection notification: {str(e)}", exc_info=True)

    def cancel_application(self, cancelled_by, reason):
        """DEPRECATED: Use request_cancellation or approve_cancellation instead"""
        # Kept for backward compatibility if needed, but redirects to perform_hard_cancel
        self._perform_hard_cancel(cancelled_by, reason)

    def _perform_hard_cancel(self, cancelled_by, reason):
        """Actual logic to move to cancelled state and rollback bookings"""
        old_status = self.status
        self.status = 'cancelled'
        self.cancelled_by = cancelled_by
        self.cancellation_reason = reason if reason else self.cancellation_reason
        if not self.cancellation_requested_at:
            self.cancellation_requested_at = timezone.now()
        self.cancellation_approved_at = timezone.now()
        self.save()
        
        # Cancel all bookings
        self._cancel_all_bookings()
        
        # Audit Log
        from apps.travel.models.audit import AuditLog
        from django.contrib.contenttypes.models import ContentType
        AuditLog.objects.create(
            user=cancelled_by,
            action='cancelled',
            content_type=ContentType.objects.get_for_model(self),
            object_id=self.id,
            changes={
                "previous_status": old_status,
                "reason": reason if reason else self.cancellation_reason
            }
        )
        
        # Send cancellation emails
        # self._send_cancellation_notifications()
        try:
            from apps.notifications.cancellation_service import CancellationNotificationService
            CancellationNotificationService.send_immediate_cancellation_notification(self, cancelled_by)
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to send cancellation notification: {str(e)}", exc_info=True)

    def _cancel_all_bookings(self):
        """Cancel all associated bookings and add audit notes"""
        from apps.travel.models import AccommodationBooking, VehicleBooking, BookingNote
        
        # 1. Cancel general bookings
        for trip in self.trip_details.all():
            bookings = trip.bookings.all()
            for b in bookings:
                b.status = 'cancelled'
                b.save(update_fields=['status'])
                
                # Add note to booking
                BookingNote.objects.create(
                    booking=b,
                    author=self.cancelled_by or self.employee,
                    note=f"[SYSTEM] Travel Application TR-{self.id} cancelled. Reason: {self.cancellation_reason}"
                )

        # 2. Cancel accommodation bookings
        accommodation_bookings = AccommodationBooking.objects.filter(
            trip_details__travel_application=self
        )
        for ab in accommodation_bookings:
             ab.status = 'cancelled'
             ab.save(update_fields=['status'])

        # 3. Cancel vehicle bookings
        vehicle_bookings = VehicleBooking.objects.filter(
            trip_details__travel_application=self
        )
        for vb in vehicle_bookings:
             vb.status = 'cancelled'
             vb.save(update_fields=['status'])

    def _send_cancellation_notifications(self):
        """Send cancellation notifications"""
        # This method is called from _perform_hard_cancel
        # Notifications are now handled in approve_cancellation method
        # Keeping this for backward compatibility
        pass

    def mark_booking_in_progress(self, travel_desk_user=None):
        """
        Move application from pending_travel_desk -> booking_in_progress.
        Called when Travel Desk forwards bookings to booking agent(s).
        """
        if self.status != 'pending_travel_desk':
            raise ValidationError("Can only mark as booking in progress from 'pending_travel_desk' status.")

        if travel_desk_user:
            self.travel_desk_user = travel_desk_user
            from apps.travel.models.booking import Booking as BookingModel
            from apps.travel.services.travel_desk_display import (
                is_self_arranged_booking,
            )

            for booking in BookingModel.objects.filter(
                trip_details__travel_application=self
            ).select_related("sub_option"):
                if is_self_arranged_booking(booking):
                    continue
                if not booking.handling_travel_desk_user_id:
                    booking.handling_travel_desk_user = travel_desk_user
                    booking.save(update_fields=["handling_travel_desk_user"])
        if not self.booking_forwarded_at:
            self.booking_forwarded_at = timezone.now()

        # Refresh status using unified service (this will set it to 'booking_in_progress' correctly)
        from apps.travel.services.refresh_application_booking_status import refresh_application_booking_status
        refresh_application_booking_status(self)

    def refresh_booking_status_from_children(self):
        """
        Recompute application-level booking status based on child bookings.
        - Bugfixed to handle 'cancelled' status (via unified service).
        """
        from apps.travel.services.refresh_application_booking_status import refresh_application_booking_status
        refresh_application_booking_status(self)

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

    def schedule_completion_task(self):
        """Schedule the background task to mark travel as completed"""
        from apps.notifications.tasks import schedule_travel_completion
        try:
            schedule_travel_completion(self)
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Failed to schedule completion task for TA {self.id}: {e}")

    def get_travel_end_datetime(self):
        """Latest return date and time across all trips"""
        last_trip = self.trip_details.order_by('-return_date', '-end_time').first()
        if not last_trip or not last_trip.return_date:
            return None

        # Combine date and time
        end_time = last_trip.end_time or datetime.time(hour=23, minute=59)
        dt = datetime.datetime.combine(last_trip.return_date, end_time)
        return timezone.make_aware(dt)

    def get_notification_payload(self):
        """
        Standard payload for travel-related notifications
        """
        first_trip = self.trip_details.all().order_by('id').first()
        last_trip = self.trip_details.all().order_by('-id').first()
        
        def format_dt(d, t=None):
            if not d: return "N/A"
            date_str = d.strftime("%d-%b-%y")
            if t:
                return f"{date_str} {t.strftime('%H:%M')}"
            return date_str

        return {
            "request_id": self.get_travel_request_id(),
            "employee_name": self.employee.get_full_name(),
            "purpose": self.purpose,
            "employee_id": self.employee.id,
            "io_number": self.internal_order or "N/A",
            "gl_code": self.general_ledger.gl_code if self.general_ledger else "N/A",
            "gl_description": self.general_ledger.vertical_name if self.general_ledger else "N/A",
            "sanction_no": self.sanction_number or "N/A",
            "from_city": first_trip.from_location.city_name if first_trip and first_trip.from_location else "N/A",
            "to_city": last_trip.to_location.city_name if last_trip and last_trip.to_location else "N/A",
            "from_date": format_dt(first_trip.departure_date, first_trip.start_time) if first_trip else "N/A",
            "to_date": format_dt(last_trip.return_date, last_trip.end_time) if last_trip else "N/A",
        }


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
        related_name='trips_from',
        null=True, blank=True
    )
    to_location = models.ForeignKey(
        CityMaster,
        on_delete=models.PROTECT,
        related_name='trips_to',
        null=True, blank=True
    )
    
    # Dates
    departure_date = models.DateField(null=True, blank=True)
    return_date = models.DateField(null=True, blank=True)

    # (NEW Fields) Times
    start_time = models.TimeField(
        help_text="Exact start time of travel",
        null=True,
        blank=True
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

    # Flag to indicate if bookings are intentionally skipped
    no_bookings_required = models.BooleanField(
        default=False,
        help_text="If true, user explicitly stated that no bookings are required for this trip"
    )
    
    class Meta:
        ordering = ['departure_date']
        indexes = [
            models.Index(fields=['travel_application', 'departure_date']),
        ]
    
    def __str__(self):
        from_loc = self.from_location.city_name if self.from_location else "Unknown"
        to_loc = self.to_location.city_name if self.to_location else "Unknown"
        return f"{from_loc} → {to_loc} ({self.departure_date})"
    
    def clean(self):
        from django.core.exceptions import ValidationError
        if self.return_date and self.departure_date and self.return_date < self.departure_date:
            raise ValidationError("Return date cannot be earlier than departure date")
    
    def get_duration_days(self):
        """Get duration of this trip in days"""
        if self.return_date and self.departure_date:
            return (self.return_date - self.departure_date).days + 1
        return 0
    
    def get_city_category(self):
        """Get destination city category for DA calculation"""
        # return self.to_location.city.category.name
        # return self.to_location.category.name
        if self.to_location and self.to_location.category:
            return self.to_location.category.name
        return None     