from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.db.models import Sum, Count, Q, Avg, F
from django.utils import timezone
from datetime import timedelta
from apps.authentication.models.user import User
from utils.response_formatter import success_response, error_response
from apps.authentication.decorators import require_role

class EmployeeDashboardView(APIView):
    """Comprehensive employee dashboard"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        from apps.travel.models import TravelApplication
        
        user = request.user
        
        # Status counts
        status_counts = {
            'draft': TravelApplication.objects.filter(employee=user, status='draft').count(),
            'pending': TravelApplication.objects.filter(
                employee=user,
                status__in=['pending_manager', 'pending_chro', 'pending_ceo']
            ).count(),
            'approved': TravelApplication.objects.filter(
                employee=user,
                status__in=['approved_manager', 'approved_chro', 'approved_ceo', 'pending_travel_desk']
            ).count(),
            'booked': TravelApplication.objects.filter(employee=user, status__in=['booking_in_progress', 'booked']).count(),
            'completed': TravelApplication.objects.filter(employee=user, status='completed').count(),
            'rejected': TravelApplication.objects.filter(
                employee=user,
                status__in=['rejected_manager', 'rejected_chro', 'rejected_ceo']
            ).count(),
        }
        
        # Recent applications
        recent = TravelApplication.objects.filter(employee=user).order_by('-created_at')[:5]
        recent_data = [{
            'id': app.id,
            'travel_request_id': app.get_travel_request_id(),
            'purpose': app.purpose[:50],
            'status': app.status,
            'created_at': app.created_at,
            'estimated_cost': float(app.estimated_total_cost or 0)
        } for app in recent]
        
        # Upcoming travels
        today = timezone.now().date()
        upcoming = TravelApplication.objects.filter(
            employee=user,
            status__in=['booked', 'approved_manager', 'approved_chro', 'approved_ceo'],
            trip_details__departure_date__gte=today
        ).distinct().order_by('trip_details__departure_date')[:5]
        
        upcoming_data = [{
            'id': app.id,
            'travel_request_id': app.get_travel_request_id(),
            'departure_date': app.trip_details.first().departure_date if app.trip_details.exists() else None,
            'destination': app.trip_details.first().to_location.city_name if app.trip_details.exists() else None
        } for app in upcoming]
        
        # Settlement pending
        settlement_pending = TravelApplication.objects.filter(
            employee=user,
            status='completed',
            is_settled=False
        ).count()
        
        return success_response(
            data={
                'status_counts': status_counts,
                'recent_applications': recent_data,
                'upcoming_travels': upcoming_data,
                'settlement_pending': settlement_pending,
                'total_applications': TravelApplication.objects.filter(employee=user).count()
            },
            message='Dashboard data retrieved successfully'
        )


class ManagerDashboardView(APIView):
    """Manager dashboard with team statistics"""
    permission_classes = [IsAuthenticated]
    
    @require_role('Manager', 'CHRO', 'CEO', 'Admin')
    def get(self, request):
        from apps.travel.models import TravelApplication, TravelApprovalFlow
        
        user = request.user
        
        # Pending approvals
        pending = TravelApprovalFlow.objects.filter(
            approver=user,
            status='pending'
        ).count()
        
        # Team statistics (subordinates)
        team_members = User.objects.filter(reporting_manager=user)
        team_travel_count = TravelApplication.objects.filter(
            employee__in=team_members
        ).count()
        
        # This month's approvals
        this_month = timezone.now().replace(day=1)
        approvals_this_month = TravelApprovalFlow.objects.filter(
            approver=user,
            status='approved',
            approved_at__gte=this_month
        ).count()
        
        # Budget overview
        pending_budget = TravelApplication.objects.filter(
            approval_flows__approver=user,
            approval_flows__status='pending'
        ).aggregate(total=Sum('estimated_total_cost'))['total'] or 0
        
        # Average approval time
        avg_time = TravelApprovalFlow.objects.filter(
            approver=user,
            status='approved'
        ).annotate(
            approval_time=F('approved_at') - F('created_at')
        ).aggregate(avg=Avg('approval_time'))
        
        return success_response(
            data={
                'pending_approvals': pending,
                'team_size': team_members.count(),
                'team_travel_requests': team_travel_count,
                'approvals_this_month': approvals_this_month,
                'pending_budget': float(pending_budget),
                'average_approval_hours': avg_time['avg'].total_seconds() / 3600 if avg_time['avg'] else 0
            },
            message='Manager dashboard retrieved successfully'
        )


class TravelDeskDashboardEnhancedView(APIView):
    """Enhanced travel desk dashboard"""
    permission_classes = [IsAuthenticated]
    permission_required = 'booking_manage'
    
    def get(self, request):
        from apps.travel.models import TravelApplication, AccommodationBooking, VehicleBooking
        
        # Applications pending travel desk
        pending_apps = TravelApplication.objects.filter(
            status='pending_travel_desk'
        ).count()
        
        # Booking statistics
        today = timezone.now().date()
        week_start = today - timedelta(days=today.weekday())
        
        booking_stats = {
            'accommodation': {
                'pending': AccommodationBooking.objects.filter(status='pending').count(),
                'this_week': AccommodationBooking.objects.filter(created_at__gte=week_start).count(),
            },
            'vehicle': {
                'pending': VehicleBooking.objects.filter(status='pending').count(),
                'this_week': VehicleBooking.objects.filter(created_at__gte=week_start).count(),
            }
        }
        
        # Upcoming bookings
        upcoming = AccommodationBooking.objects.filter(
            check_in_date__gte=today,
            check_in_date__lte=today + timedelta(days=7),
            status__in=['guest_house_confirmed', 'arc_hotel_confirmed']
        ).count()
        
        return success_response(
            data={
                'pending_applications': pending_apps,
                'booking_statistics': booking_stats,
                'upcoming_check_ins': upcoming
            },
            message='Travel desk dashboard retrieved successfully'
        )


class FinanceDashboardView(APIView):
    """Finance dashboard with claim statistics and application list"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        from apps.expenses.models import ExpenseClaim, ClaimStatusMaster
        from utils.pagination import StandardResultsSetPagination
        from django.db.models import Q
        
        # Verify finance permissions
        if not self._verify_finance_permissions(request.user):
            return error_response(
                message='Permission denied',
                errors={'detail': 'Finance role required to access this dashboard'},
                status_code=status.HTTP_403_FORBIDDEN
            )
        
        # Get claim statistics
        statistics = self._get_claim_statistics()
        
        # Get filtered and paginated claims list
        claims_queryset = self._get_filtered_claims(request)
        
        # Apply pagination
        paginator = StandardResultsSetPagination()
        page = paginator.paginate_queryset(claims_queryset, request)
        
        # Serialize claims data with only required fields
        claims_data = []
        for claim in page:
            employee_name = f"{claim.employee.first_name} {claim.employee.last_name}".strip()
            travel_request_id = claim.travel_application.get_travel_request_id() if claim.travel_application else None
            
            claim_data = {
                'travel_application': claim.travel_application.id if claim.travel_application else None,
                'travel_request_id': travel_request_id,
                'claim_application_id': claim.id,
                'employee_name': employee_name,
                'status_code': claim.status.code if claim.status else None,
                'status_label': claim.status.label if claim.status else None,
                'total_da': float(claim.total_da or 0),
                'total_incidental': float(claim.total_incidental or 0),
                'total_expenses': float(claim.total_expenses or 0),
                'advance_received': float(claim.advance_received or 0),
                'final_amount_payable': float(claim.final_amount_payable or 0),
            }
            claims_data.append(claim_data)
        
        # Build response with exact format requested
        response_data = {
            'statistics': statistics,
            'results': claims_data
        }
        
        return success_response(
            data=response_data,
            message='Finance dashboard data retrieved successfully'
        )
    
    def _verify_finance_permissions(self, user):
        """Check if user has finance role or appropriate permissions"""
        if not user or not user.is_authenticated:
            return False
        
        # Check if user has finance role
        user_roles = [role.role_type for role in user.get_all_roles()]
        if 'finance' in user_roles:
            return True
        
        # Check if user is staff (admin access)
        if user.is_staff or user.is_superuser:
            return True
        
        # Check for specific finance permissions
        user_permissions = user.get_user_permissions_list()
        finance_permissions = ['expense_claim_approve', 'finance_dashboard_access']
        if any(perm in user_permissions for perm in finance_permissions):
            return True
        
        return False
    
    def _get_claim_statistics(self):
        """Calculate statistics for claim status counts"""
        from apps.expenses.models import ExpenseClaim
        
        # Map frontend status names to backend status codes
        status_mapping = {
            'pending': ['finance_pending'],
            'paid': ['paid'],
            'closed': ['closed'],
        }
        
        statistics = {}
        
        for frontend_status, backend_codes in status_mapping.items():
            count = ExpenseClaim.objects.filter(
                status__code__in=backend_codes
            ).count()
            statistics[frontend_status] = count
        
        return statistics
    
    def _get_filtered_claims(self, request):
        """Apply search and status filters to claims queryset"""
        from apps.expenses.models import ExpenseClaim
        from django.db.models import Q
        
        # Base queryset with optimized joins
        queryset = ExpenseClaim.objects.select_related(
            'employee', 'status', 'travel_application'
        ).all()
        
        # Status filter
        status_filter = request.query_params.get('status')
        if status_filter:
            # Map frontend status to backend codes
            status_mapping = {
                'pending': ['finance_pending'],
                'paid': ['paid'],
                'closed': ['closed'],
            }
            
            backend_codes = status_mapping.get(status_filter, [status_filter])
            queryset = queryset.filter(status__code__in=backend_codes)
        
        # Search filter (employee name or travel request ID)
        search = request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(employee__first_name__icontains=search) |
                Q(employee__last_name__icontains=search) |
                Q(employee__username__icontains=search) |
                Q(travel_application__id__icontains=search)
            )
        
        # Order by most recent first
        queryset = queryset.order_by('-created_on')
        
        return queryset
