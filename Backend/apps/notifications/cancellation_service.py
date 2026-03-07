"""
Cancellation Notification Service

Handles all email notifications related to travel application cancellations.
Integrates with NotificationCenter to send emails to appropriate stakeholders.
"""

from apps.notifications.center import NotificationCenter
from apps.travel.models import TravelApplication
from apps.travel.models.booking import BookingAssignment
from django.utils import timezone
import logging

logger = logging.getLogger(__name__)


class CancellationNotificationService:
    """Service for handling cancellation-related notifications"""

    @staticmethod
    def send_cancellation_request_notification(travel_app: TravelApplication):
        """
        Send notification when employee requests cancellation.
        
        Notifies:
        - Current approver (manager/CHRO/CEO)
        - Travel desk (if status was pending_travel_desk)
        - Booking agents (if status was booking_in_progress)
        """
        try:
            # Get approver
            approver_id = travel_app.current_approver.id if travel_app.current_approver else None
            
            # Get travel desk user if assigned
            travel_desk_id = travel_app.travel_desk_user.id if travel_app.travel_desk_user else None
            
            # Get booking agents
            booking_agent_ids = CancellationNotificationService._get_booking_agent_ids(travel_app)
            
            # Get travel dates
            start_date = travel_app.get_travel_start_date()
            end_date = travel_app.get_travel_end_date()
            travel_dates = f"{start_date} to {end_date}" if start_date and end_date else "N/A"
            
            # Prepare payload
            payload = {
                'employee_id': travel_app.employee.id,
                'employee_name': travel_app.employee.get_full_name(),
                'approver_id': approver_id,
                'approver_name': travel_app.current_approver.get_full_name() if travel_app.current_approver else 'Manager',
                'travel_desk_id': travel_desk_id,
                'booking_agent_ids': booking_agent_ids,
                'request_id': travel_app.get_travel_request_id(),
                'purpose': travel_app.purpose,
                'travel_dates': travel_dates,
                'current_status': travel_app.get_status_display(),
                'cancellation_reason': travel_app.cancellation_reason,
                'request_date': timezone.now().strftime('%Y-%m-%d %H:%M'),
            }
            
            # Send notification to approver and stakeholders
            NotificationCenter.notify(
                event_name='travel.cancellation.requested',
                reference={'type': 'TravelApplication', 'id': travel_app.id},
                payload=payload
            )
            
            logger.info(f"✅ Cancellation request notification sent for {travel_app.get_travel_request_id()}")
            
        except Exception as e:
            logger.error(f"❌ Failed to send cancellation request notification: {str(e)}", exc_info=True)

    @staticmethod
    def send_cancellation_approval_notification(travel_app: TravelApplication, approved_by, notes=""):
        """
        Send notification when cancellation is approved.
        
        Notifies:
        - Employee (applicant) - acknowledgement
        - Booking agents (if any) - halt booking activities
        - Travel desk - remove from queue
        """
        try:
            # Get travel dates
            start_date = travel_app.get_travel_start_date()
            end_date = travel_app.get_travel_end_date()
            travel_dates = f"{start_date} to {end_date}" if start_date and end_date else "N/A"
            
            # Prepare payload for employee notification
            employee_payload = {
                'employee_id': travel_app.employee.id,
                'employee_name': travel_app.employee.get_full_name(),
                'approver_id': approved_by.id,
                'approver_name': approved_by.get_full_name(),
                'request_id': travel_app.get_travel_request_id(),
                'purpose': travel_app.purpose,
                'travel_dates': travel_dates,
                'notes': notes or 'No additional notes provided.',
                'approval_date': timezone.now().strftime('%Y-%m-%d %H:%M'),
            }
            
            # Send approval acknowledgement to employee
            NotificationCenter.notify(
                event_name='travel.cancellation.approved',
                reference={'type': 'TravelApplication', 'id': travel_app.id},
                payload=employee_payload
            )
            
            # Notify booking agents if application was in booking phase
            if travel_app.previous_status in ['booking_in_progress', 'pending_travel_desk']:
                CancellationNotificationService._notify_booking_agents(travel_app)
            
            # Notify travel desk if applicable
            if travel_app.previous_status == 'pending_travel_desk':
                CancellationNotificationService._notify_travel_desk(travel_app)
            
            logger.info(f"✅ Cancellation approval notification sent for {travel_app.get_travel_request_id()}")
            
        except Exception as e:
            logger.error(f"❌ Failed to send cancellation approval notification: {str(e)}", exc_info=True)

    @staticmethod
    def send_cancellation_rejection_notification(travel_app: TravelApplication, rejected_by, reason):
        """
        Send notification when cancellation is rejected.
        
        Notifies:
        - Employee (applicant) - acknowledgement with rejection reason
        """
        try:
            # Get travel dates
            start_date = travel_app.get_travel_start_date()
            end_date = travel_app.get_travel_end_date()
            travel_dates = f"{start_date} to {end_date}" if start_date and end_date else "N/A"
            
            # Prepare payload
            payload = {
                'employee_id': travel_app.employee.id,
                'employee_name': travel_app.employee.get_full_name(),
                'approver_id': rejected_by.id,
                'approver_name': rejected_by.get_full_name(),
                'request_id': travel_app.get_travel_request_id(),
                'purpose': travel_app.purpose,
                'travel_dates': travel_dates,
                'rejection_reason': reason,
                'previous_status': travel_app.get_status_display(),
                'rejection_date': timezone.now().strftime('%Y-%m-%d %H:%M'),
            }
            
            # Send rejection notification to employee
            NotificationCenter.notify(
                event_name='travel.cancellation.rejected',
                reference={'type': 'TravelApplication', 'id': travel_app.id},
                payload=payload
            )
            
            logger.info(f"✅ Cancellation rejection notification sent for {travel_app.get_travel_request_id()}")
            
        except Exception as e:
            logger.error(f"❌ Failed to send cancellation rejection notification: {str(e)}", exc_info=True)

    @staticmethod
    def _notify_booking_agents(travel_app: TravelApplication):
        """Notify all assigned booking agents about cancellation"""
        try:
            booking_agent_ids = CancellationNotificationService._get_booking_agent_ids(travel_app)
            
            if not booking_agent_ids:
                return
            
            # Get travel dates
            start_date = travel_app.get_travel_start_date()
            end_date = travel_app.get_travel_end_date()
            travel_dates = f"{start_date} to {end_date}" if start_date and end_date else "N/A"
            
            # Prepare payload
            payload = {
                'booking_agent_ids': booking_agent_ids,
                'booking_agent_name': 'Booking Agent',  # Will be personalized per recipient
                'request_id': travel_app.get_travel_request_id(),
                'employee_name': travel_app.employee.get_full_name(),
                'purpose': travel_app.purpose,
                'travel_dates': travel_dates,
                'booking_type': 'All Bookings',
                'previous_status': travel_app.previous_status or 'Booking in Progress',
                'cancellation_reason': travel_app.cancellation_reason,
                'cancellation_date': timezone.now().strftime('%Y-%m-%d %H:%M'),
            }
            
            # Send notification
            NotificationCenter.notify(
                event_name='travel.cancellation.booking_agent',
                reference={'type': 'TravelApplication', 'id': travel_app.id},
                payload=payload
            )
            
            logger.info(f"✅ Booking agent cancellation notification sent for {travel_app.get_travel_request_id()}")
            
        except Exception as e:
            logger.error(f"❌ Failed to notify booking agents: {str(e)}", exc_info=True)

    @staticmethod
    def _notify_travel_desk(travel_app: TravelApplication):
        """Notify travel desk about cancellation"""
        try:
            travel_desk_id = travel_app.travel_desk_user.id if travel_app.travel_desk_user else None
            
            # Get travel dates
            start_date = travel_app.get_travel_start_date()
            end_date = travel_app.get_travel_end_date()
            travel_dates = f"{start_date} to {end_date}" if start_date and end_date else "N/A"
            
            # Prepare payload
            payload = {
                'travel_desk_id': travel_desk_id,
                'travel_desk_name': travel_app.travel_desk_user.get_full_name() if travel_app.travel_desk_user else 'Travel Desk Team',
                'request_id': travel_app.get_travel_request_id(),
                'employee_name': travel_app.employee.get_full_name(),
                'purpose': travel_app.purpose,
                'travel_dates': travel_dates,
                'previous_status': travel_app.previous_status or 'Pending Travel Desk',
                'estimated_cost': str(travel_app.estimated_total_cost),
                'cancellation_reason': travel_app.cancellation_reason,
                'cancellation_date': timezone.now().strftime('%Y-%m-%d %H:%M'),
            }
            
            # Send notification
            NotificationCenter.notify(
                event_name='travel.cancellation.travel_desk',
                reference={'type': 'TravelApplication', 'id': travel_app.id},
                payload=payload
            )
            
            logger.info(f"✅ Travel desk cancellation notification sent for {travel_app.get_travel_request_id()}")
            
        except Exception as e:
            logger.error(f"❌ Failed to notify travel desk: {str(e)}", exc_info=True)

    @staticmethod
    def _get_booking_agent_ids(travel_app: TravelApplication):
        """
        Get all booking agent IDs assigned to this travel application.
        
        Returns:
            list: List of user IDs of assigned booking agents
        """
        try:
            # Get all bookings for this travel application
            booking_ids = []
            for trip in travel_app.trip_details.all():
                booking_ids.extend(trip.bookings.values_list('id', flat=True))
            
            if not booking_ids:
                return []
            
            # Get all booking assignments
            assignments = BookingAssignment.objects.filter(
                booking_id__in=booking_ids,
                assigned_to__isnull=False
            ).select_related('assigned_to')
            
            # Extract unique agent IDs
            agent_ids = list(set([a.assigned_to.id for a in assignments if a.assigned_to]))
            
            return agent_ids
            
        except Exception as e:
            logger.error(f"❌ Failed to get booking agent IDs: {str(e)}", exc_info=True)
            return []
    @staticmethod
    def send_immediate_cancellation_notification(travel_app: TravelApplication, cancelled_by):
        """
        Send notification when application is immediately cancelled (bypassing approval).
        
        Notifies:
        - Reporting Manager / Approver
        - Travel Desk
        - Booking Agents
        """
        try:
            # Get approver (Manager)
            # If current_approver is null (e.g. was in booked state), try to get reporting manager from profile
            approver_id = None
            approver_name = "Manager"
            
            if travel_app.current_approver:
                approver_id = travel_app.current_approver.id
                approver_name = travel_app.current_approver.get_full_name()
            else:
                profile = travel_app.employee.get_profile()
                if profile and profile.reporting_manager:
                    approver_id = profile.reporting_manager.id
                    approver_name = profile.reporting_manager.get_full_name()

            # Get travel desk user if assigned
            travel_desk_id = travel_app.travel_desk_user.id if travel_app.travel_desk_user else None
            
            # Get booking agents
            booking_agent_ids = CancellationNotificationService._get_booking_agent_ids(travel_app)
            
            # Get travel dates
            start_date = travel_app.get_travel_start_date()
            end_date = travel_app.get_travel_end_date()
            travel_dates = f"{start_date} to {end_date}" if start_date and end_date else "N/A"
            
            # Prepare payload
            payload = {
                'employee_id': travel_app.employee.id,
                'employee_name': travel_app.employee.get_full_name(),
                'approver_id': approver_id,
                'approver_name': approver_name,
                'travel_desk_id': travel_desk_id,
                'booking_agent_ids': booking_agent_ids,
                'request_id': travel_app.get_travel_request_id(),
                'purpose': travel_app.purpose,
                'travel_dates': travel_dates,
                'current_status': 'Cancelled', # Hardcoded as it's immediate cancellation
                'cancellation_reason': travel_app.cancellation_reason,
                'cancellation_date': timezone.now().strftime('%Y-%m-%d %H:%M'),
                'cancelled_by_name': cancelled_by.get_full_name()
            }
            
            # Reuse 'travel.cancellation.requested' event but with modified payload or new event?
            # User requirement: "intimation of TA cancellation"
            # If we reuse 'requested', the template might say "Cancellation Requested". 
            # Ideally we need 'travel.application.cancelled'
            
            NotificationCenter.notify(
                event_name='travel.application.cancelled', 
                reference={'type': 'TravelApplication', 'id': travel_app.id},
                payload=payload
            )
            
            logger.info(f"✅ Immediate cancellation notification sent for {travel_app.get_travel_request_id()}")
            
        except Exception as e:
            logger.error(f"❌ Failed to send immediate cancellation notification: {str(e)}", exc_info=True)
