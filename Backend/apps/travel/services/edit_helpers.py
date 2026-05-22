"""
Helper functions for travel application edit feature
"""
from django.utils import timezone
from decimal import Decimal
from typing import Tuple, List, Dict, Any


def can_edit_application(application, user) -> Tuple[bool, str]:
    """
    Check if a travel application can be edited by the given user.
    
    Args:
        application: TravelApplication instance
        user: User instance
        
    Returns:
        Tuple of (can_edit: bool, message: str)
    """
    # Status check - cannot edit if in these statuses
    non_editable_statuses = [
        'cancelled',
        'cancellation_requested',
        'completed',
        # 'booked',
        # 'rejected_ceo',
        # 'rejected_chro',
        # 'rejected_manager'
    ]

    TRAVEL_EDIT_BEFORE_START_ONLY = False # Disabled by default
    
    if application.status in non_editable_statuses:
        # --- Back-dated TR Exemption (Financial Lock) ---
        # Allow editing of 'completed' TRs ONLY if they were back-dated at creation
        # AND no expense claim has been initiated yet (financial lock).
        if application.status == 'completed':
            start_date = application.get_travel_start_date()
            # If trip started on or before the application was created, it's considered back-dated
            if start_date and start_date < application.created_at.date():
                try:
                    from apps.expenses.models import ExpenseClaim
                    if ExpenseClaim.objects.filter(travel_application=application).exists():
                        return False, "Cannot edit travel application because an expense claim has already been initiated"
                    return True, "Can edit (Back-dated TR correction allowed)"
                except (ImportError, Exception):
                    pass
        
        return False, f"Cannot edit application in '{application.get_status_display()}' status"
    
    # Permission check
    is_owner = application.employee == user
    # Check for admin roles (handle case variations)
    is_admin = (
        user.has_role('admin') or 
        user.has_role('Admin') or 
        user.has_role('ceo') or
        user.has_role('CEO') or 
        user.has_role('chro') or 
        user.has_role('CHRO')
    )
    is_travel_desk = user.has_role('travel_desk') or user.has_role('Travel Desk')
    
    if not (is_owner or is_admin or is_travel_desk):
        return False, "You don't have permission to edit this application"
    
    # Travel started check
    # If False, it will skip this entire block (meaning edits ARE allowed)
    if TRAVEL_EDIT_BEFORE_START_ONLY:
        start_date = application.get_travel_start_date()
        # Exception: Only block if it wasn't a back-dated request
        if start_date and start_date <= timezone.now().date():
            if not (start_date <= application.created_at.date()):
                return False, "Cannot edit - travel has already started"
    
    # Booking agent assignment check
    from apps.travel.models import BookingAssignment
    has_assignments = BookingAssignment.objects.filter(
        booking__trip_details__travel_application=application
    ).exists()
    
    # As per discussion with client, we are not checking for booking agent assignment
    # if has_assignments:
    #     return False, "Cannot edit - bookings have been assigned to booking agents"

    return True, "Can edit"


def determine_reapproval_needed(original_app, updated_data) -> Tuple[bool, str, str]:
    """
    Determine if re-approval is needed based on changes made to the application.
    
    Args:
        original_app: Original TravelApplication instance
        updated_data: Dictionary of updated data
        
    Returns:
        Tuple of (needs_reapproval: bool, reason: str, reset_to_status: str)
    """
    # Draft applications don't need re-approval
    if original_app.status == 'draft':
        return False, "Draft application", "draft"
    
    critical_changes = []
    
    # 1. Financial changes
    new_advance = Decimal(str(updated_data.get('advance_amount', 0) or 0))
    old_advance = original_app.advance_amount or Decimal('0')
    
    if new_advance != old_advance:
        if new_advance > old_advance:
            critical_changes.append(f"Advance amount increased from ₹{old_advance} to ₹{new_advance}")
        else:
            critical_changes.append(f"Advance amount decreased from ₹{old_advance} to ₹{new_advance}")
    
    # 2. Estimated cost changes (significant = >10%)
    new_cost = Decimal(str(updated_data.get('estimated_total_cost', 0) or 0))
    old_cost = original_app.estimated_total_cost or Decimal('0')
    
    if old_cost > 0:
        cost_change_percent = abs((new_cost - old_cost) / old_cost * 100)
        if cost_change_percent > 10:
            critical_changes.append(f"Estimated cost changed by {cost_change_percent:.1f}%")
    
    # 3. Trip changes
    original_trips = list(original_app.trip_details.all().order_by('id'))
    new_trips = updated_data.get('trip_details', [])
    
    if len(original_trips) != len(new_trips):
        critical_changes.append(f"Number of trips changed from {len(original_trips)} to {len(new_trips)}")
    else:
        # Check each trip for changes
        for i, (orig_trip, new_trip) in enumerate(zip(original_trips, new_trips)):
            trip_num = i + 1
            
            # Location changes
            if orig_trip.from_location_id != new_trip.get('from_location'):
                critical_changes.append(f"Trip {trip_num}: Origin location changed")
            
            if orig_trip.to_location_id != new_trip.get('to_location'):
                critical_changes.append(f"Trip {trip_num}: Destination location changed")
            
            # Date changes
            orig_dep = str(orig_trip.departure_date) if orig_trip.departure_date else None
            new_dep = new_trip.get('departure_date')
            if orig_dep != new_dep:
                critical_changes.append(f"Trip {trip_num}: Departure date changed")
            
            orig_ret = str(orig_trip.return_date) if orig_trip.return_date else None
            new_ret = new_trip.get('return_date')
            if orig_ret != new_ret:
                critical_changes.append(f"Trip {trip_num}: Return date changed")
            
            # Booking changes
            orig_bookings = list(orig_trip.bookings.all().order_by('id'))
            new_bookings = new_trip.get('bookings', [])
            
            if len(orig_bookings) != len(new_bookings):
                critical_changes.append(f"Trip {trip_num}: Number of bookings changed")
            else:
                for j, (orig_booking, new_booking) in enumerate(zip(orig_bookings, new_bookings)):
                    booking_num = j + 1
                    
                    # Booking type changes
                    if orig_booking.booking_type_id != new_booking.get('booking_type'):
                        critical_changes.append(f"Trip {trip_num}, Booking {booking_num}: Type changed")
                    
                    # Sub-option changes
                    if orig_booking.sub_option_id != new_booking.get('sub_option'):
                        critical_changes.append(f"Trip {trip_num}, Booking {booking_num}: Class/option changed")
                    
                    # Significant cost changes
                    orig_cost = orig_booking.estimated_cost or Decimal('0')
                    new_cost = Decimal(str(new_booking.get('estimated_cost', 0) or 0))
                    if orig_cost > 0:
                        cost_diff_percent = abs((new_cost - orig_cost) / orig_cost * 100)
                        if cost_diff_percent > 20:
                            critical_changes.append(f"Trip {trip_num}, Booking {booking_num}: Cost changed by {cost_diff_percent:.1f}%")
    
    # Determine if re-approval is needed
    if critical_changes:
        reason = "; ".join(critical_changes[:5])  # Limit to first 5 changes
        if len(critical_changes) > 5:
            reason += f" (and {len(critical_changes) - 5} more changes)"
        # Return 'draft' so submit endpoint can trigger approval workflow
        return True, reason, "draft"
    
    # Minor changes only - no re-approval needed
    return False, "Minor changes only (purpose, sanction number, etc.)", original_app.status


def reset_approval_flows(application, triggered_by):
    """
    Critical edit: reset TR to draft for resubmit. Approval rows are kept;
    edit_count and flow statuses are updated on the next submit.
    """
    from apps.travel.models.audit import AuditLog
    from django.contrib.contenttypes.models import ContentType

    AuditLog.objects.create(
        user=triggered_by,
        action='reset_approvals',
        content_type=ContentType.objects.get_for_model(application),
        object_id=application.id,
        changes={
            'reason': 'Application edited with critical changes — requires resubmit',
            'edit_count': application.edit_count,
            'reset_to_status': 'draft',
        },
    )

    application.status = 'draft'
    application.current_approver = None
    application.save(update_fields=['status', 'current_approver', 'updated_at'])
