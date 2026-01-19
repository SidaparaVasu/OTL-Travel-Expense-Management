from rest_framework.generics import ListAPIView
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from django.utils import timezone

from ..models import TravelApplication, TravelApprovalFlow, TripDetails
from ..serializers.approval_serializers import (
    TravelApprovalFlowSerializer, ApprovalActionSerializer,
    ManagerApprovalListSerializer
)
from .filters import TravelApplicationFilter
from apps.expenses.models import ExpenseClaim, ClaimApprovalFlow
from django.db.models import Sum
from datetime import timedelta
from django.db.models.functions import TruncMonth
from ...authentication.permissions import HasCustomPermission
from apps.authentication.decorators import require_permission, require_role
from utils.response_formatter import success_response, error_response, validation_error_response, paginated_response
from utils.audit import log_action

import logging
logger = logging.getLogger(__name__)

class ManagerApprovalsView(ListAPIView):
    """
    List travel applications filtered by approval status (pending, approved, rejected, all)
    """
    serializer_class = ManagerApprovalListSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        status_filter = self.request.query_params.get('status', 'pending')  # default: pending

        queryset = TravelApplication.objects.filter(
            approval_flows__approver=user,
            approval_flows__can_approve=True
        ).select_related(
            'employee__grade', 'employee__department', 'employee__organizational_profile__reporting_manager'
        ).prefetch_related(
            'trip_details__from_location', 'trip_details__to_location',
            'trip_details__bookings', 'trip_details__bookings__booking_type'
        ).distinct()

        if status_filter == 'pending':
            queryset = queryset.filter(approval_flows__status='pending')
        elif status_filter == 'approved':
            queryset = queryset.filter(approval_flows__status='approved')
        elif status_filter == 'rejected':
            queryset = queryset.filter(approval_flows__status='rejected')
        elif status_filter == 'cancellation_requested':
            queryset = queryset.filter(status='cancellation_requested')
        elif status_filter == 'all':
            pass  # no filter applied — show all approvals

        # Apply advanced filters
        filter_params = self.request.GET.copy()
        if 'status' in filter_params:
            del filter_params['status']

        filterset = TravelApplicationFilter(filter_params, queryset=queryset)
        if filterset.is_valid():
            queryset = filterset.qs

        return queryset.order_by('-submitted_at')
    
    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return paginated_response(
                serializer.data,
                self.paginator,
                message=f"{request.query_params.get('status', 'pending').capitalize()} approvals retrieved successfully"
            )
        
        serializer = self.get_serializer(queryset, many=True)
        return success_response(
            data=serializer.data,
            message=f"{request.query_params.get('status', 'pending').capitalize()} approvals retrieved successfully"
        )

class ManagerPendingApprovalsView(ListAPIView):
    """
    List of travel applications pending manager's approval
    """
    serializer_class = ManagerApprovalListSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        # return TravelApplication.objects.all()
        queryset = TravelApplication.objects.filter(
            approval_flows__approver=self.request.user,
            approval_flows__status='pending',
            approval_flows__can_approve=True
        ).select_related(
            'employee__grade', 'employee__department'
        ).prefetch_related(
            'trip_details__from_location', 'trip_details__to_location'
        ).distinct()

        # Apply advanced filters
        filter_params = self.request.GET.copy()
        if 'status' in filter_params:
            del filter_params['status']

        filterset = TravelApplicationFilter(filter_params, queryset=queryset)
        if filterset.is_valid():
            queryset = filterset.qs
            
        return queryset.order_by('-submitted_at')
    
    def list(self, request, *args, **kwargs):
        """Override to use standard response"""
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return paginated_response(
                serializer.data,
                self.paginator,
                message="Pending approvals retrieved successfully"
            )
        
        serializer = self.get_serializer(queryset, many=True)
        return success_response(
            data=serializer.data,
            message="Pending approvals retrieved successfully"
        )

class ApprovalActionView(APIView):
    """
    Approve or reject a travel application
    """
    permission_classes = [IsAuthenticated]
    
    @transaction.atomic
    def post(self, request, pk):
        # Get the travel application
        try:
            travel_app = TravelApplication.objects.get(pk=pk)
        except TravelApplication.DoesNotExist:
            return error_response(
                message='Travel application not found',
                status_code=status.HTTP_404_NOT_FOUND
            )
        
        # Get the current approval flow for this user
        try:
            approval_flow = TravelApprovalFlow.objects.get(
                travel_application=travel_app,
                approver=request.user,
                status='pending',
                can_approve=True
            )
        except TravelApprovalFlow.DoesNotExist:
            return error_response(
                message='No pending approval found for this user',
                errors={
                    'detail': 'You do not have permission to approve this application or it has already been processed'
                },
                status_code=status.HTTP_403_FORBIDDEN
            )
        
        # Validate action
        serializer = ApprovalActionSerializer(data=request.data)
        if not serializer.is_valid():
            return validation_error_response(serializer.errors)
        
        action = serializer.validated_data['action']
        notes = serializer.validated_data.get('notes', '')
        
        try:
            # When status is 'cancellation_requested', standard approval actions should
            # trigger cancellation workflows, not standard approval workflows.
            if travel_app.status == 'cancellation_requested':
                if action == 'approve':
                    # Approve the cancellation -> App becomes 'cancelled'
                    travel_app.approve_cancellation(approved_by=request.user, notes=notes)
                    
                    # Mark the approval flow as approved/closed so it leaves pending state
                    approval_flow.status = 'approved'
                    approval_flow.notes = f"Approved cancellation request: {notes}"
                    approval_flow.approved_at = timezone.now()
                    approval_flow.save()
                    
                    message = f"Cancellation for {travel_app.get_travel_request_id()} approved"

                elif action == 'reject':
                    # Reject the cancellation -> App reverts to PREVIOUS status
                    try:
                        travel_app.reject_cancellation(rejected_by=request.user, reason=notes)
                        message = f"Cancellation request rejected. Application restored."
                    except Exception as e:
                        raise e
                
                return success_response(
                    data={
                        'travel_request_id': travel_app.get_travel_request_id(),
                        'new_status': travel_app.status,
                        'action': action,
                        'approver': request.user.get_full_name(),
                        'approved_at': timezone.now()
                    },
                    message=message
                )

            # Standard Flow
            if action == 'approve':
                approval_flow.approve(notes)
                log_action( 
                    user=request.user, action='approve', obj=travel_app, 
                    changes={ 'approval_level': approval_flow.approval_level, 'notes': notes }, 
                    request=request 
                )
                message = f"Travel request {travel_app.get_travel_request_id()} approved successfully"
                
                # Send notification email
                self.send_approval_notification(travel_app, approval_flow, 'approved')
            
            elif action == 'reject':
                approval_flow.reject(notes)
                log_action( 
                    user=request.user, action='reject', obj=travel_app, 
                    changes={ 'approval_level': approval_flow.approval_level, 'reason': notes }, 
                    request=request 
                )
                message = f"Travel application {travel_app.get_travel_request_id()} rejected"
                
                # Send rejection notification
                self.send_approval_notification(travel_app, approval_flow, 'rejected')
        
            return success_response(
                data={
                    'travel_request_id': travel_app.get_travel_request_id(),
                    'new_status': travel_app.status,
                    'action': action,
                    'approval_level': approval_flow.approval_level,
                    'approver': approval_flow.approver.get_full_name(),
                    'approved_at': approval_flow.approved_at
                },
                message=message
            )
        except Exception as e:
            return error_response(
                message=f'Failed to {action} application',
                errors={'detail': str(e)},
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def send_approval_notification(self, travel_app, approval_flow, action):
        """Send email notification for approval/rejection"""
        try:
            from apps.notifications.center import NotificationCenter

            employee = travel_app.employee
            approver = approval_flow.approver

            # Choose event name based on action
            event_name = "travel.approved" if action == "approved" else "travel.rejected"

            payload = {
                "employee_id": employee.id,
                "approver_id": approver.id,
                "employee_name": employee.get_full_name(),
                "approver_name": approver.get_full_name(),
                "request_id": travel_app.get_travel_request_id(),
                "purpose": travel_app.purpose,
            }

            # Add notes only for rejection
            if action == "rejected":
                payload["notes"] = approval_flow.notes

            NotificationCenter.notify(
                event_name=event_name,
                reference={"type": "TravelRequest", "id": travel_app.id},
                payload=payload
            )

        except Exception as e:
            logger.warning(f"Failed to send email notification: {str(e)}")


class ApprovalHistoryView(APIView):
    """
    Get approval history for a travel application
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request, pk):
        try:
            travel_app = TravelApplication.objects.get(pk=pk)
        except TravelApplication.DoesNotExist:
            return error_response(
                message='Travel application not found',
                status_code=status.HTTP_404_NOT_FOUND
            )
        
        # Check permissions
        if not (travel_app.employee == request.user or 
                travel_app.approval_flows.filter(approver=request.user).exists() or
                request.user.can_access_dashboard('admin')):
            return error_response(
                message='Access denied',
                errors={'detail': 'You do not have permission to view this approval history'},
                status_code=status.HTTP_403_FORBIDDEN
            )
        
        approval_flows = travel_app.approval_flows.all().order_by('sequence')
        serializer = TravelApprovalFlowSerializer(approval_flows, many=True)
        
        # Calculate summary
        summary = {
            'total_approvals': approval_flows.count(),
            'completed_approvals': approval_flows.filter(status__in=['approved', 'rejected']).count(),
            'pending_approvals': approval_flows.filter(status='pending').count(),
            'current_step': None
        }
        
        current_pending = approval_flows.filter(status='pending').first()
        if current_pending:
            summary['current_step'] = {
                'level': current_pending.approval_level,
                'approver': current_pending.approver.get_full_name(),
                'sequence': current_pending.sequence
            }
        
        return success_response(
            data={
                'approval_history': serializer.data,
                'summary': summary
            },
            message='Approval history retrieved successfully'
        )

class CHROPendingApprovalsView(ListAPIView):
    """CHRO pending approvals"""
    serializer_class = ManagerApprovalListSerializer
    permission_classes = [IsAuthenticated, HasCustomPermission]
    permission_required = 'travel_request_approve_all'
    
    def get_queryset(self):
        queryset = TravelApplication.objects.filter(
            status='pending_chro'
        ).select_related(
            'employee__grade', 'employee__department'
        )

        filter_params = self.request.GET.copy()
        if 'status' in filter_params:
            del filter_params['status']

        filterset = TravelApplicationFilter(filter_params, queryset=queryset)
        if filterset.is_valid():
            queryset = filterset.qs

        return queryset.order_by('-submitted_at')
    
    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return success_response(
            data=serializer.data,
            message='CHRO pending approvals retrieved successfully'
        )

class CEOPendingApprovalsView(ListAPIView):
    """CEO pending approvals"""
    serializer_class = ManagerApprovalListSerializer
    permission_classes = [IsAuthenticated, HasCustomPermission]
    permission_required = 'travel_request_approve_all'
    
    def get_queryset(self):
        queryset = TravelApplication.objects.filter(
            status='pending_ceo'
        ).select_related(
            'employee__grade', 'employee__department'  
        )

        filter_params = self.request.GET.copy()
        if 'status' in filter_params:
            del filter_params['status']

        filterset = TravelApplicationFilter(filter_params, queryset=queryset)
        if filterset.is_valid():
            queryset = filterset.qs

        return queryset.order_by('-submitted_at')
    
    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return success_response(
            data=serializer.data,
            message='CEO pending approvals retrieved successfully'
        )

class ApprovalDashboardView(APIView):
    """
    Approval dashboard with statistics
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        user = request.user
        
        # Pending approvals
        pending_approvals = TravelApprovalFlow.objects.filter(
            approver=user,
            status='pending',
            can_approve=True
        ).count()
        
        # Total approvals done
        total_approvals_done = TravelApprovalFlow.objects.filter(
            approver=user,
            status__in=['approved', 'rejected']
        ).count()
        
        # This month's approvals
        approvals_this_month = TravelApprovalFlow.objects.filter(
            approver=user,
            status__in=['approved', 'rejected'],
            approved_at__month=timezone.now().month,
            approved_at__year=timezone.now().year
        ).count()
        
        # Recent activity
        recent_approvals = TravelApprovalFlow.objects.filter(
            approver=user,
            status__in=['pending','approved', 'rejected']
        ).select_related(
            'travel_application__employee'
        ).order_by('-approved_at')[:5]


        
        recent_data = [
            {
                'travel_request_id': approval.travel_application.get_travel_request_id(),
                'employee_name': approval.travel_application.employee.get_full_name(),
                'action': approval.status,
                'date': approval.approved_at,
                'approval_level': approval.approval_level,
                'location' : TripDetails.objects.filter(travel_application=approval.travel_application).values('from_location__city_name', 'to_location__city_name').first()
            }
            for approval in recent_approvals
        ]


        # --- Expense Reports (Recent Activity) ---
        recent_claims = ClaimApprovalFlow.objects.filter(
            approver=user
        ).select_related(
            'claim__employee'
        ).order_by('-acted_on', '-id')[:5]

        expense_reports = []
        for flow in recent_claims:
            expense_reports.append({
                'title': f"Expense Claim #{flow.claim.id}",
                'submitted_by': f"Submitted by {flow.claim.employee.get_full_name()}",
                'amount': float(flow.claim.total_expenses),
                'status': flow.status
            })
            
        # --- Monthly Expense Trends (Last 12 Months) ---
        # Get team members (if manager)
        from apps.authentication.models import User
        team_members = User.objects.filter(reporting_manager=user)
        
        # Calculate last 12 months range
        end_date = timezone.now().date()
        start_date = end_date.replace(day=1) - timedelta(days=365) # Approx 1 year
        
        # Aggregate expenses by month for team (or self if no team)
        # Using submitted_on date for trends
        expense_qs = ExpenseClaim.objects.filter(
            submitted_on__gte=start_date,
            status__label__in=['Approved', 'Paid', 'Closed'] # Only approved expenses
        )
        
        if team_members.exists():
             expense_qs = expense_qs.filter(employee__in=team_members)
        else:
             expense_qs = expense_qs.filter(employee=user)
             
        trends_data = expense_qs.annotate(
            month=TruncMonth('submitted_on')
        ).values('month').annotate(
            total=Sum('total_expenses')
        ).order_by('month')
        
        # Format for frontend [Jan, Feb...] and values
        months_labels = []
        values_data = []
        
        # Fill in missing months? For simplicity, we just return what we have or basic 12 slots if needed.
        # Let's map to the last 12 months explicitly to ensure correct chart x-axis
        
        # Helper to generate last 12 months list
        current = end_date.replace(day=1)
        for i in range(11, -1, -1):
            # Calculate past month
            d = current - timedelta(days=30*i) # rough Approx
            # Better specific logic:
            year = current.year
            month = current.month - i
            while month <= 0:
                month += 12
                year -= 1
            
            label = timezone.datetime(year, month, 1).strftime('%b')
            months_labels.append(label)
            
            # Find matching data
            val = 0
            for item in trends_data:
                if item['month'].year == year and item['month'].month == month:
                    val = float(item['total'])
                    break
            values_data.append(val)


        # --- Active Trips (Team) ---
        active_trips = 0
        if team_members.exists():
             # Statuses indicating active travel
             active_statuses = ['booked', 'trip_started', 'booking_in_progress'] 
             active_trips = TravelApplication.objects.filter(
                 employee__in=team_members,
                 status__in=active_statuses
             ).count()

        # --- Pending Expenses Amount (Approver) ---
        pending_expenses_amount = ClaimApprovalFlow.objects.filter(
            approver=user,
            status='pending'
        ).aggregate(total=Sum('claim__total_expenses'))['total'] or 0

        return success_response(
            data={
                'statistics': {
                    'pending_approvals': pending_approvals,
                    'total_approvals_done': total_approvals_done,
                    'approvals_this_month': approvals_this_month,
                    'active_trips': active_trips,
                    'pending_expenses_amount': float(pending_expenses_amount)
                },
                'recent_activity': recent_data,
                'expense_reports': expense_reports,
                'expense_trends': {
                    'months': months_labels,
                    'values': values_data
                }
            },
            message='Dashboard data retrieved successfully'
        )
    

class ApprovalStatsView(APIView):
    """Quick approval statistics"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        from django.db.models import Sum
        
        today = timezone.now().date()
        
        pending = TravelApprovalFlow.objects.filter(
            approver=request.user,
            status='pending'
        ).count()
        
        approved_today = TravelApprovalFlow.objects.filter(
            approver=request.user,
            status='approved',
            approved_at__date=today
        ).count()
        
        total_budget = TravelApplication.objects.filter(
            approval_flows__approver=request.user,
            approval_flows__status='pending'
        ).aggregate(total=Sum('estimated_total_cost'))['total'] or 0
        
        rejected = TravelApprovalFlow.objects.filter(
            approver=request.user,
            status='rejected'
        ).count()
        
        return success_response(
            data={
                'pending_approval': pending,
                'approved_today': approved_today,
                'total_budget': float(total_budget),
                'rejected': rejected
            },
            message='Approval statistics retrieved successfully'
        )