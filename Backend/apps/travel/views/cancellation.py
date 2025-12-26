from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db import transaction
from django.core.exceptions import ValidationError
from utils.response_formatter import success_response, error_response
from apps.travel.models import TravelApplication

class TravelCancellationRequestView(APIView):
    """View for applicant to request travel application cancellation"""
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, pk):
        try:
            travel_app = TravelApplication.objects.get(pk=pk)
        except TravelApplication.DoesNotExist:
            return error_response("Travel application not found", status_code=404)

        # Basic permission check: Owner or Admin/Travel Desk
        if travel_app.employee != request.user and not (request.user.has_role('Admin') or request.user.has_role('Travel Desk')):
            return error_response("You don't have permission to request cancellation for this application", status_code=403)

        reason = request.data.get('reason', '')
        if not reason:
            return error_response("Cancellation reason is required", status_code=400)

        try:
            travel_app.request_cancellation(requested_by=request.user, reason=reason)
            return success_response(
                data={
                    "status": travel_app.status,
                    "requested_at": travel_app.cancellation_requested_at
                },
                message="Cancellation requested successfully"
            )
        except ValidationError as e:
            return error_response(str(e), status_code=400)
        except Exception as e:
            return error_response(f"An unexpected error occurred: {str(e)}", status_code=500)


class TravelCancellationApprovalView(APIView):
    """View for manager/admin to approve or reject cancellation request"""
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, pk):
        try:
            travel_app = TravelApplication.objects.get(pk=pk)
        except TravelApplication.DoesNotExist:
            return error_response("Travel application not found", status_code=404)

        # Permission check: Manager (via profile) or Admin/Travel Desk
        profile = travel_app.employee.get_profile()
        is_manager = profile and profile.reporting_manager == request.user
        is_admin_or_desk = request.user.has_role('Admin') or request.user.has_role('Travel Desk')

        if not (is_manager or is_admin_or_desk):
            return error_response("You don't have permission to approve/reject this cancellation", status_code=403)

        action = request.data.get('action') # 'approve' or 'reject'
        reason = request.data.get('reason', '') # Required for rejection

        if action not in ['approve', 'reject']:
            return error_response("Invalid action. Must be 'approve' or 'reject'", status_code=400)

        if action == 'reject' and not reason:
            return error_response("Rejection reason is required", status_code=400)

        try:
            if action == 'approve':
                travel_app.approve_cancellation(approved_by=request.user, notes=reason)
                return success_response(message="Cancellation approved successfully")
            else:
                travel_app.reject_cancellation(rejected_by=request.user, reason=reason)
                return success_response(message="Cancellation request rejected. Application restored.")
        except ValidationError as e:
            return error_response(str(e), status_code=400)
        except Exception as e:
            return error_response(f"An unexpected error occurred: {str(e)}", status_code=500)


class PartialCancellationView(APIView):
    """View for partial cancellation of trips within an application"""
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, pk):
        from apps.travel.models import TripDetails
        try:
            travel_app = TravelApplication.objects.get(pk=pk, employee=request.user)
        except TravelApplication.DoesNotExist:
            return error_response("Travel application not found", status_code=404)

        trip_ids = request.data.get('trip_ids', [])
        reason = request.data.get('reason', '')

        if not trip_ids:
            return error_response("No trips specified for cancellation", status_code=400)

        trips = TripDetails.objects.filter(id__in=trip_ids, travel_application=travel_app)
        if not trips.exists():
            return error_response("Specified trips not found for this application", status_code=404)

        # Simple partial cancellation logic
        for trip in trips:
            trip.bookings.all().update(status='cancelled')
        
        # Recalculate cost
        travel_app.calculate_estimated_cost()
        travel_app.save()

        return success_response(message=f"Successfully cancelled {trips.count()} trip segments")
