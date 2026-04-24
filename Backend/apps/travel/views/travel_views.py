from django.shortcuts import render

# Create your views here.
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView, ListAPIView, RetrieveAPIView
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from django.utils import timezone
from ..models import TravelApplication, Booking
from apps.travel.models import TravelApprovalFlow
from ..serializers.travel_serializers import *
from apps.authentication.permissions import IsEmployee, IsOwnerOrApprover
from rest_framework.parsers import MultiPartParser, FormParser
from apps.authentication.mixins import BranchFilterMixin
from rest_framework.pagination import PageNumberPagination
from django.db.models import Q
from utils.response_formatter import success_response, error_response, validation_error_response, paginated_response
from django.core.exceptions import ValidationError
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters
from .filters import TravelApplicationFilter
from utils.pagination import StandardResultsSetPagination

import logging

logger = logging.getLogger(__name__)

class TravelApplicationPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 100

class TravelApplicationDashboardStatsView(APIView):
    """Dashboard statistics for employee"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        user = request.user
        
        stats = {
            'total_applications': TravelApplication.objects.filter(employee=user).count(),
            'draft': TravelApplication.objects.filter(employee=user, status='draft').count(),
            'pending': TravelApplication.objects.filter(
                employee=user, 
                status__in=['submitted', 'pending_manager', 'pending_chro', 'pending_ceo']
            ).count(),
            'approved': TravelApplication.objects.filter(
                employee=user,
                status__in=['approved_manager', 'approved_chro', 'approved_ceo', 
                          'pending_travel_desk', 'booking_in_progress', 'booked']
            ).count(),
            'rejected': TravelApplication.objects.filter(
                employee=user,
                status__in=['rejected_manager', 'rejected_chro', 'rejected_ceo']
            ).count(),
            'completed': TravelApplication.objects.filter(employee=user, status='completed').count(),
        }
        
        return success_response(
            data=stats,
            message='Dashboard statistics retrieved successfully'
        )

class MyDraftApplicationsView(ListAPIView):
    serializer_class = TravelApplicationSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return TravelApplication.objects.filter(
            employee=self.request.user,
            status='draft'
        ).order_by('-created_at')

class MyPendingApplicationsView(ListAPIView):
    serializer_class = TravelApplicationSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        # return self.request
        return TravelApplication.objects.filter(
            employee=self.request.user,
            status__in=['submitted', 'pending_manager', 'pending_chro', 'pending_ceo']
        ).order_by('-submitted_at')

class TravelApplicationListCreateView(BranchFilterMixin, ListCreateAPIView):
    """
        Travel Applications API
        
        list:
        Get list of travel applications for the authenticated user.
        Supports filtering by status, date ranges, and search.
        Enhanced with branch-based access control.
        
        create:
        Create a new travel application.
        Application starts in 'draft' status and must be submitted separately.
    """
    serializer_class = TravelApplicationSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = TravelApplicationFilter
    search_fields = ['purpose', 'internal_order', 'sanction_number', 'employee__username']
    ordering_fields = ['created_at', 'estimated_total_cost', 'submitted_at']
    ordering = ['-created_at']
    permission_classes = [IsAuthenticated]
    pagination_class = TravelApplicationPagination
    
    def get_queryset(self):
        """
        Branch-Based Access Control with Role-Specific Filtering:
        - CEO/CHRO: See all applications across all branches
        - Admin/Travel Desk/Finance: See only their branch applications
        - Manager: See their own + subordinates' applications (within branch)
        - Employee: See only their own applications
        """
        user = self.request.user
        queryset = TravelApplication.objects.all()
        
        # Apply branch-based filtering using mixin
        queryset = self.apply_branch_filter(queryset, user, employee_field='employee')
        
        # Additional filtering for Manager role: include subordinates within branch
        if user.has_role('Manager'):
            queryset = queryset.filter(
                Q(employee=user) | 
                Q(employee__organizational_profile__reporting_manager=user)
            )
        
        # Optimization: Select and prefetch related data
        return queryset.select_related(
            'employee',
            'employee__grade',
            'general_ledger',
            'current_approver'
        ).prefetch_related(
            'trip_details',
            'trip_details__from_location',
            'trip_details__to_location',
            'trip_details__bookings',
            'approval_flows',
            'approval_flows__approver'
        ).distinct().order_by('-created_at')
    
    def list(self, request, *args, **kwargs):
        """Override to use standard response format"""
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return paginated_response(
                serializer.data, 
                self.paginator, 
                message="Travel applications retrieved successfully"
            )
        
        serializer = self.get_serializer(queryset, many=True)
        return success_response(
            data=serializer.data,
            message="Travel applications retrieved successfully"
        )
    
    # @api_ratelimit(rate='20/h')  # 20 creations per hour
    def create(self, request, *args, **kwargs):
        """Override to use standard response format"""
        serializer = self.get_serializer(data=request.data)
        
        if not serializer.is_valid():
            return validation_error_response(serializer.errors)
        
        try:
            self.perform_create(serializer)
            return success_response(
                data=serializer.data,
                message="Travel application created successfully",
                status_code=status.HTTP_201_CREATED
            )
        except Exception as e:
            return error_response(
                message="Failed to create travel application",
                errors={'detail': str(e)},
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def perform_create(self, serializer):
        # Ensure the application is linked to the logged-in user
        serializer.save(employee=self.request.user)

class TravelApplicationDetailView(BranchFilterMixin, RetrieveUpdateDestroyAPIView):
    """
    Retrieve, update, delete travel application.
    Enhanced with branch-based access control.
    """
    serializer_class = TravelApplicationSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrApprover]
    
    def get_queryset(self):
        """
        Apply branch-based filtering to ensure users can only access
        applications from their branch (except CEO/CHRO).
        """
        queryset = TravelApplication.objects.select_related('employee', 'general_ledger')
        # Apply branch filtering using mixin
        return self.apply_branch_filter(queryset, self.request.user, employee_field='employee')
    
    @transaction.atomic
    def update(self, request, *args, **kwargs):
        """Override update to handle re-approval logic"""
        from apps.travel.services.edit_helpers import can_edit_application, determine_reapproval_needed, reset_approval_flows
        from apps.travel.models.audit import AuditLog
        from django.contrib.contenttypes.models import ContentType
        
        instance = self.get_object()
        
        # Check if user can edit
        can_edit, message = can_edit_application(instance, request.user)
        if not can_edit:
            return error_response(
                message=message,
                status_code=status.HTTP_403_FORBIDDEN
            )
        
        # Store original data for comparison
        original_status = instance.status
        original_approver = instance.current_approver
        
        # Perform the update
        serializer = self.get_serializer(instance, data=request.data, partial=kwargs.get('partial', False))
        
        if not serializer.is_valid():
            return validation_error_response(serializer.errors)
        
        # Determine if re-approval is needed
        needs_reapproval, reason, new_status = determine_reapproval_needed(instance, request.data)
        
        # Save the updated application
        self.perform_update(serializer)
        
        # Handle re-approval if needed
        if needs_reapproval:
            reset_approval_flows(instance, request.user)
            
            # Create audit log for edit with re-approval
            AuditLog.objects.create(
                user=request.user,
                action='edit_with_reapproval',
                content_type=ContentType.objects.get_for_model(instance),
                object_id=instance.id,
                changes={
                    'edited_by': request.user.get_full_name(),
                    'changes_made': reason,
                    'previous_status': original_status,
                    'new_status': new_status,
                    'reapproval_required': True
                }
            )
            
            # Send notification about re-approval
            try:
                from apps.notifications.center import NotificationCenter
                
                recipients_list = [instance.employee.id]
                if original_approver:
                    recipients_list.append(original_approver.id)
                    
                NotificationCenter.notify(
                    event_name="travel.edited_reapproval",
                    reference={"type": "TravelRequest", "id": instance.id},
                    payload={
                        "employee_id": instance.employee.id,
                        "request_id": instance.get_travel_request_id(),
                        "employee_name": instance.employee.get_full_name(),
                        "approver_name": original_approver.get_full_name() if original_approver else "Approver",
                        "changes": reason,
                        "message": "Your travel request has been updated and requires re-approval",
                        "recipients": recipients_list
                    }
                )
            except Exception as e:
                logger.warning(f"Failed to send re-approval notification: {e}")
        else:
            # Create audit log for minor edit
            AuditLog.objects.create(
                user=request.user,
                action='edit',
                content_type=ContentType.objects.get_for_model(instance),
                object_id=instance.id,
                changes={
                    'edited_by': request.user.get_full_name(),
                    'changes_made': reason,
                    'status': instance.status,
                    'reapproval_required': False
                }
            )
        
        return success_response(
            data=serializer.data,
            message=f"Travel application updated successfully{' - Re-approval required' if needs_reapproval else ''}",
            status_code=status.HTTP_200_OK
        )


class TravelApplicationEditView(APIView):
    """
    Get travel application data for editing with eligibility check
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request, pk):
        from apps.travel.services.edit_helpers import can_edit_application
        
        try:
            application = TravelApplication.objects.select_related(
                'employee',
                'general_ledger',
                'current_approver'
            ).prefetch_related(
                'trip_details__from_location',
                'trip_details__to_location',
                'trip_details__bookings__booking_type',
                'trip_details__bookings__sub_option'
            ).get(pk=pk)
        except TravelApplication.DoesNotExist:
            return error_response(
                message="Travel application not found",
                status_code=status.HTTP_404_NOT_FOUND
            )
        
        # Check if user can edit
        can_edit, message = can_edit_application(application, request.user)
        
        if not can_edit:
            return success_response(
                data={
                    'can_edit': False,
                    'reason': message
                },
                message=message
            )
        
        # Serialize the application data
        serializer = TravelApplicationSerializer(application)
        
        return success_response(
            data={
                'can_edit': True,
                'application': serializer.data
            },
            message="Application data fetched for editing"
        )



class TravelApplicationBulkUploadView(APIView):
    """
    Upload bulk booking file (Excel/CSV) for an application
    """
    permission_classes = [IsAuthenticated, IsOwnerOrApprover]
    parser_classes = [MultiPartParser, FormParser]
    
    def post(self, request, pk):
        try:
            application = TravelApplication.objects.get(pk=pk)
            self.check_object_permissions(request, application)
            
            if application.status != 'draft':
                 return error_response(
                    message="Cannot upload files to submitted application",
                    status_code=status.HTTP_400_BAD_REQUEST
                )

            serializer = BulkFileUploadSerializer(application, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return success_response(
                    data=serializer.data,
                    message="Bulk file uploaded successfully"
                )
            return validation_error_response(serializer.errors)
            
        except TravelApplication.DoesNotExist:
            return error_response(
                message="Travel application not found",
                status_code=status.HTTP_404_NOT_FOUND
            )


class TravelApplicationSubmitView(APIView):
    """
    Submit a travel application for approval.
    This version uses ApprovalEngineV2.
    """
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, pk):

        # 1) Load travel application
        # Only accept draft status (including applications reset to draft after re-approval)
        try:
            travel_app = TravelApplication.objects.get(
                pk=pk,
                employee=request.user,
                status='draft'
            )
        except TravelApplication.DoesNotExist:
            return error_response(
                message="Travel application not found or already submitted",
                status_code=status.HTTP_404_NOT_FOUND
            )

        # 2) Validate serializer (minimal payload to enforce internal checks)
        serializer = TravelApplicationSubmissionSerializer(
            instance=travel_app,
            data={},
            partial=True
        )
        if not serializer.is_valid():
            return validation_error_response(serializer.errors)
        
        # 2.5) STRICT VALIDATION: Check for mandatory fields that are nullable in DB (Draft Support)
        missing_fields = []
        if not travel_app.internal_order:
            missing_fields.append("Internal Order (IO)")
        if not travel_app.general_ledger:
            missing_fields.append("General Ledger (GL)")
        if not travel_app.purpose: # Should not happen as text field is usually empty string, but check for safety
             missing_fields.append("Purpose")

        if missing_fields:
            return error_response(
                message="Cannot submit application with missing mandatory fields.",
                errors={"validation": f"Missing: {', '.join(missing_fields)}"},
                status_code=400
            )

        # Check trip details integrity
        trips = travel_app.trip_details.all()
        if not trips.exists():
             return error_response(
                message="Cannot submit application without trip details.",
                status_code=400
            )

        for i, trip in enumerate(trips):
            trip_missing = []
            if not trip.from_location: trip_missing.append("Origin")
            if not trip.to_location: trip_missing.append("Destination")
            if not trip.departure_date: trip_missing.append("Departure Date")
            if not trip.return_date: trip_missing.append("Return Date")
            
            # Start/End time is mandatory for travel
            if not trip.start_time: trip_missing.append("Start Time") 
            if not trip.end_time: trip_missing.append("End Time")
            
            if trip_missing:
                 return error_response(
                    message=f"Trip cannot be incomplete.",
                    errors={"validation": f"Trip {i+1} missing: {', '.join(trip_missing)}"},
                    status_code=400
                )

        # 3) Validate transition: draft → pending_manager
        can_submit, msg = travel_app.can_transition_to("pending_manager")
        if not can_submit:
            return error_response(
                message="Cannot submit travel request",
                errors={"validation": msg},
                status_code=400
            )

        # 3.2) Overlap check at submission time for self/self_guest applications.
        # Draft saves are always allowed, but submission is blocked if an active
        # (non-draft) self application already covers the same period.
        if travel_app.travel_for in ['self', 'self_guest']:
            from apps.travel.business_logic.validators import validate_duplicate_travel_request
            for trip in travel_app.trip_details.all():
                if trip.departure_date and trip.return_date:
                    try:
                        validate_duplicate_travel_request(
                            travel_app.employee,
                            trip.departure_date,
                            trip.return_date,
                            exclude_id=travel_app.id
                        )
                    except Exception as e:
                        return error_response(
                            message="Cannot submit travel request due to overlapping period.",
                            errors={"validation": str(e)},
                            status_code=400
                        )

        # 3.5) Auto-create "Bulk Upload" booking if file is present
        # This ensures the application is routed to Travel Desk even if no other bookings exist.
        travel_app.create_bulk_booking_if_needed()

        # EARLY CHECK - Collect all bookings
        all_bookings = []
        for trip in travel_app.trip_details.all():
            all_bookings.extend(list(trip.bookings.all()))

        # STEP 5: Check special rules BEFORE engine
        ceo_required = False
        chro_required = False

        # 4) Collect warnings (advance-booking)
        warnings = []
        today = timezone.now().date()

        for trip in travel_app.trip_details.all():
            if not trip.departure_date:
                continue

            days_ahead = (trip.departure_date - today).days

            for booking in trip.bookings.all():
                mode = booking.booking_type.name.lower()

                if "flight" in mode and days_ahead < 7:
                    warnings.append({
                        "type": "advance_booking_violation",
                        "mode": "Flight",
                        "message": f"Flight booking is only {days_ahead} days ahead (policy: 7 days minimum)",
                        "severity": "warning"
                    })

                if "train" in mode and days_ahead < 3:
                    warnings.append({
                        "type": "advance_booking_violation",
                        "mode": "Train",
                        "message": f"Train booking is only {days_ahead} days ahead (policy: 3 days minimum)",
                        "severity": "warning"
                    })

        # 5) Calculate estimated cost
        try:
            travel_app.calculate_estimated_cost()
        except Exception as e:
            logger.warning(f"[SubmitView] Cost calculation failed for TA {travel_app.id}: {e}")

        # 6) Build approver chain using ApprovalEngineV2
        from apps.travel.business_logic.approval_engine_v2 import ApprovalEngineV2

        engine = ApprovalEngineV2(travel_app, request.user)
        approver_entries = engine.build()

        # If no approvers → treat as self approval
        if len(approver_entries) == 0 and travel_app.self_approved:
            travel_app.status = "pending_travel_desk"
            # travel_app.save(update_fields=["status", "self_approved"])
            travel_app.save(update_fields=["status"])

        # STEP 6.5: CHECK FOR SELF-APPROVAL (NEW)
        self_approved = False
        if not approver_entries:
            self_approved = True

        # -----------------------------------------
        # SELF-APPROVAL SCENARIO (NO APPROVERS)
        # -----------------------------------------
        if self_approved or not approver_entries:            
            # Create auto-approval flow entry for record
            TravelApprovalFlow.objects.create(
                travel_application=travel_app,
                approver=request.user,
                approval_level="self_approval",
                sequence=1,
                status="approved",
                can_view=True,
                can_approve=True,
                is_required=True,
                notes="Auto-approved (no approver required)",
                approved_at=timezone.now()
            )
            # Directly move to travel desk
            travel_app.status = "pending_travel_desk"
            travel_app.self_approved = True
            travel_app.submitted_at = timezone.now()
            travel_app.current_approver = None
            travel_app.set_settlement_due_date()
            travel_app.save(update_fields=["status", "self_approved", "submitted_at", "current_approver", "settlement_due_date"]) 
            
            from apps.travel.services.auto_forward_bookings import auto_forward_flight_train_bookings, auto_confirm_self_arranged_bookings
            auto_forward_flight_train_bookings(travel_app, system_user=request.user)
            auto_confirm_self_arranged_bookings(travel_app, system_user=request.user)

            # Schedule auto-completion
            travel_app.schedule_completion_task()

            return success_response(
                data={
                    "travel_request_id": travel_app.get_travel_request_id(),
                    "status": travel_app.status,
                    "self_approved": True,
                    "message": "Travel request auto-approved based on grade / policy rules",
                    "warnings": warnings,
                    "estimated_cost": float(travel_app.estimated_total_cost),
                    "settlement_due_date": str(travel_app.settlement_due_date)
                },
                message="Travel application auto-approved successfully",
                status_code=200
            )

        # -----
        # If approvers list exists → continue with manager/CEO/CHRO reorder logic
        # -----

        org_profile = getattr(request.user, "organizational_profile", None)
        reporting_manager = getattr(org_profile, "reporting_manager", None)

        from apps.authentication.models import UserRole

        is_ceo = UserRole.objects.filter(
            user=request.user,
            role__name__iexact="CEO",
            is_active=True
        ).exists()

        is_chro = UserRole.objects.filter(
            user=request.user,
            role__name__iexact="CHRO",
            is_active=True
        ).exists()

        # determine rule triggers
        ceo_required = any(a.level == "ceo" for a in approver_entries)
        chro_required = any(a.level == "chro" for a in approver_entries)

        # Reporting manager = self case
        if reporting_manager == request.user:
            if is_ceo and ceo_required:     # CEO submitting CEO-required request
                approver_entries = [a for a in approver_entries if a.level != "manager"]
            if is_chro and chro_required:   # CHRO submitting CHRO-required request
                approver_entries = [a for a in approver_entries if a.level != "manager"]

            # re-normalize
            for i, a in enumerate(approver_entries, start=1):
                a.sequence = i

        if not approver_entries:
            return error_response(
                "No valid approvers available. Reporting manager or role setup may be incorrect.",
                status_code=400
            )

        # 7) Create TravelApprovalFlow rows
        approval_chain = []
        for entry in approver_entries:
            flow = TravelApprovalFlow.objects.create(
                travel_application=travel_app,
                approver=entry.user,
                approval_level=entry.level,
                sequence=entry.sequence,
                status="pending",
                can_view=entry.can_view,
                can_approve=entry.can_approve,
                is_required=entry.is_required
            )

            approval_chain.append({
                "sequence": flow.sequence,
                "approval_level": flow.approval_level,
                "approver": flow.approver.get_full_name(),
                "approver_email": flow.approver.email,
                "status": flow.status
            })

        # 8) Update travel application
        first_approver = approver_entries[0]
        travel_app.status = f"pending_{first_approver.level}"
        travel_app.submitted_at = timezone.now()
        travel_app.current_approver = first_approver.user
        travel_app.set_settlement_due_date()
        travel_app.save()

        # Schedule auto-completion
        from apps.notifications.tasks import schedule_travel_completion
        schedule_travel_completion(travel_app)

        # 9) Send email notification
        try:
            from apps.notifications.center import NotificationCenter
            
            # Get first trip segment for email summary
            first_trip = travel_app.trip_details.first()
            from_city = first_trip.from_location.city_name if first_trip and first_trip.from_location else "N/A"
            to_city = first_trip.to_location.city_name if first_trip and first_trip.to_location else "N/A"
            
            # Format dates (DD-Mon-YY HH:MM)
            def format_dt(d, t):
                if not d: return "N/A"
                dt_str = d.strftime("%d-%b-%y")
                if t:
                    dt_str += f" {t.strftime('%H:%M')}"
                return dt_str

            start_date_str = format_dt(first_trip.departure_date, first_trip.start_time) if first_trip else "N/A"
            end_date_str = format_dt(first_trip.return_date, first_trip.end_time) if first_trip else "N/A"

            NotificationCenter.notify(
                event_name="travel.submitted",
                reference={"type": "TravelRequest", "id": travel_app.id},
                payload={
                    "employee_id": request.user.id,
                    "approver_id": travel_app.current_approver.id,
                    "request_id": travel_app.get_travel_request_id(),
                    "employee_name": request.user.get_full_name(),
                    "approver_name": travel_app.current_approver.get_full_name(),
                    "purpose": travel_app.purpose,
                    "from_city": from_city,
                    "to_city": to_city,
                    "from_date": start_date_str,
                    "to_date": end_date_str,
                    "io_number": travel_app.internal_order or "N/A",
                    "gl_code": travel_app.general_ledger.gl_code if travel_app.general_ledger else "N/A",
                    "gl_description": travel_app.general_ledger.vertical_name if travel_app.general_ledger else "N/A",
                    "sanc_number": travel_app.sanction_number or "N/A",
                    "portal_url": "https://hrms.orangetechnolab.com/tscsr/",
                    # For default_resolver logic
                    "recipients": [travel_app.current_approver.id, request.user.id]
                }
            )

        except Exception as e:
            logger.warning(f"[SubmitView] Email sending failed: {e}")

        # 10) Final response
        return success_response(
            data={
                "travel_request_id": travel_app.get_travel_request_id(),
                "status": travel_app.status,
                "current_approver": travel_app.current_approver.get_full_name(),
                "approval_chain": approval_chain,
                "warnings": warnings,
                "estimated_cost": float(travel_app.estimated_total_cost),
                "settlement_due_date": str(travel_app.settlement_due_date)
            },
            message="Travel application submitted successfully",
            status_code=200
        )


class TravelApplicationSubmitViewOld(APIView):
    """
    Submit travel application for approval
    """
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, pk):
        # -----------------------------
        # LOAD APPLICATION
        # -----------------------------
        try:
            travel_app = TravelApplication.objects.get(
                pk=pk,
                employee=request.user,
                status='draft'
            )
        except TravelApplication.DoesNotExist:
            return error_response(
                message='Travel application not found or already submitted',
                status_code=status.HTTP_404_NOT_FOUND
            )

        # -----------------------------
        # VALIDATE BASIC FIELDS
        # -----------------------------
        serializer = TravelApplicationSubmissionSerializer(
            instance=travel_app,
            data={}
        )
        if not serializer.is_valid():
            return validation_error_response(serializer.errors)

        # -----------------------------
        # VALIDATE STATE TRANSITION
        # -----------------------------
        can_submit, validation_msg = travel_app.can_transition_to("pending_manager")
        if not can_submit:
            return error_response(
                message="Cannot submit travel request",
                errors={"validation": validation_msg},
                status_code=400
            )

        # -----------------------------
        # WARNINGS: ADVANCE BOOKING
        # -----------------------------
        warnings = []
        today = timezone.now().date()

        for trip in travel_app.trip_details.all():
            if not trip.departure_date:
                continue

            days_ahead = (trip.departure_date - today).days

            for booking in trip.bookings.all():
                mode_name = booking.booking_type.name.lower()

                if 'flight' in mode_name and days_ahead < 7:
                    warnings.append({
                        "type": "advance_booking_violation",
                        "mode": "Flight",
                        "message": f"Flight booking is only {days_ahead} days ahead (policy: 7 days minimum)",
                        "severity": "warning"
                    })

                elif 'train' in mode_name and days_ahead < 3:
                    warnings.append({
                        "type": "advance_booking_violation",
                        "mode": "Train",
                        "message": f"Train booking is only {days_ahead} days ahead (policy: 3 days minimum)",
                        "severity": "warning"
                    })

        # -----------------------------
        # COST CALCULATION
        # -----------------------------
        try:
            travel_app.calculate_estimated_cost()
        except Exception as e:
            logger.warning(f"Cost calculation failed for TravelApp {travel_app.id}: {str(e)}")

        # -----------------------------
        # GATHER ALL BOOKINGS
        # -----------------------------
        all_bookings = []
        for trip in travel_app.trip_details.all():
            all_bookings.extend(list(trip.bookings.all()))

        # ================================================================================
        # APPROVER RESOLUTION ENGINE
        # ================================================================================
        from apps.authentication.models import Role, UserRole

        def get_role_user(role_name: str):
            role = Role.objects.filter(name=role_name).first()
            if not role:
                return None
            ur = UserRole.objects.filter(role=role, is_active=True).first()
            return ur.user if ur else None

        def user_has_role(user, role_name: str):
            """Check if user has a specific role"""
            role = Role.objects.filter(name__iexact=role_name).first()
            if not role:
                return False
            return UserRole.objects.filter(user=user, role=role, is_active=True).exists()

        def resolve_approvers(user, all_bookings):
            approvers = []

            org_profile = getattr(user, "organizational_profile", None)
            reporting_manager = getattr(org_profile, "reporting_manager", None)

            is_ceo = user_has_role(user, "CEO")
            is_chro = user_has_role(user, "CHRO")

            # 1️) MANAGER APPROVAL
            if reporting_manager == user:
                approvers.append({
                    "level": "manager",
                    "user": user,
                    "is_required": True,
                    "can_view": True,
                    "can_approve": True,
                })
            else:
                if not reporting_manager:
                    raise Exception("Reporting manager is not assigned.")
                approvers.append({
                    "level": "manager",
                    "user": reporting_manager,
                    "is_required": True,
                    "can_view": True,
                    "can_approve": True,
                })

            # 2️) SPECIAL RULE: FLIGHT > 10k → CEO
            flight_bookings = [
                b for b in all_bookings if "flight" in b.booking_type.name.lower()
            ]
            exp_flight = any(b.estimated_cost and b.estimated_cost > 10000 for b in flight_bookings)

            if exp_flight:
                if is_ceo:
                    approvers.append({
                        "level": "ceo",
                        "user": user,
                        "is_required": True,
                        "can_view": True,
                        "can_approve": True,
                    })
                else:
                    ceo_user = get_role_user("CEO")
                    if ceo_user:
                        approvers.append({
                            "level": "ceo",
                            "user": ceo_user,
                            "is_required": True,
                            "can_view": True,
                            "can_approve": True,
                        })

            # 3️) SPECIAL RULE: CAR DISTANCE >150km → CHRO
            car_bookings = [b for b in all_bookings if "car" in b.booking_type.name.lower()]
            for cb in car_bookings:
                dist = cb.booking_details.get("distance_km", 0)
                if dist > 150:
                    if is_ceo:
                        # CEO overrides → CEO self-approval
                        approvers.append({
                            "level": "chro",
                            "user": user,
                            "is_required": True,
                            "can_view": True,
                            "can_approve": True,
                        })
                    elif is_chro:
                        approvers.append({
                            "level": "chro",
                            "user": user,
                            "is_required": True,
                            "can_view": True,
                            "can_approve": True,
                        })
                    else:
                        chro_user = get_role_user("CHRO")
                        if chro_user:
                            approvers.append({
                                "level": "chro",
                                "user": chro_user,
                                "is_required": True,
                                "can_view": True,
                                "can_approve": True,
                            })

            # 4️) DEDUPE + NORMALIZE
            deduped = []
            seen = {}

            for ap in approvers:
                uid = ap["user"].id
                if uid not in seen:
                    seen[uid] = ap
                    deduped.append(ap)
                else:
                    existing = seen[uid]
                    existing["is_required"] |= ap["is_required"]
                    existing["can_view"] |= ap["can_view"]
                    existing["can_approve"] |= ap["can_approve"]

            # normalize sequence
            for i, ap in enumerate(deduped, start=1):
                ap["sequence"] = i

            return deduped

        # FINAL RESOLUTION
        approvers_needed = resolve_approvers(request.user, all_bookings)

        if not approvers_needed:
            return error_response(
                "No valid approvers available. Reporting manager or role setup may be incorrect.",
                status_code=400
            )

        # -----------------------------
        # CREATE APPROVAL FLOW ENTRIES
        # -----------------------------
        from ..models import TravelApprovalFlow

        approval_chain = []

        for ap in approvers_needed:
            flow = TravelApprovalFlow.objects.create(
                travel_application=travel_app,
                approver=ap["user"],
                approval_level=ap["level"],
                sequence=ap["sequence"],
                status='pending',
                can_view=ap["can_view"],
                can_approve=ap["can_approve"],
                is_required=ap["is_required"],
            )

            approval_chain.append({
                "sequence": flow.sequence,
                "approval_level": flow.approval_level,
                "approver": flow.approver.get_full_name(),
                "approver_email": flow.approver.email,
                "status": flow.status
            })

        # -----------------------------
        # UPDATE APPLICATION
        # -----------------------------
        can_submit, msg = travel_app.can_transition_to("pending_manager")
        if not can_submit:
            return error_response(
                message="Cannot submit travel request",
                errors={"validation": msg},
                status_code=400
            )

        travel_app.status = "pending_manager"
        travel_app.submitted_at = timezone.now()
        travel_app.current_approver = approvers_needed[0]["user"]
        travel_app.set_settlement_due_date()
        travel_app.save()

        # -----------------------------
        # SEND EMAIL NOTIFICATION
        # -----------------------------
        try:
            from apps.notifications.services import EmailNotificationService
            EmailNotificationService.send_travel_request_submitted(travel_app)
        except Exception as e:
            logger.warning(f"Email sending failed: {str(e)}")

        # -----------------------------
        # SUCCESS RESPONSE
        # -----------------------------
        return success_response(
            data={
                "travel_request_id": travel_app.get_travel_request_id(),
                "status": travel_app.status,
                "current_approver": travel_app.current_approver.get_full_name(),
                "approval_chain": approval_chain,
                "warnings": warnings,
                "estimated_cost": float(travel_app.estimated_total_cost),
                "settlement_due_date": str(travel_app.settlement_due_date)
            },
            message="Travel application submitted successfully",
            status_code=200
        )

class TravelApplicationSubmitViewOlder(APIView):
    """
    Submit travel application for approval
    """
    permission_classes = [IsAuthenticated]
    
    @transaction.atomic
    def post(self, request, pk):
        try:
            travel_app = TravelApplication.objects.get(
                pk=pk, 
                employee=request.user,
                status='draft'
            )
        except TravelApplication.DoesNotExist:
            return error_response(
                message='Travel application not found or already submitted',
                status_code=status.HTTP_404_NOT_FOUND
            )
        
        # Validate before submission
        serializer = TravelApplicationSubmissionSerializer(instance=travel_app, data={})
        
        if not serializer.is_valid():
            return validation_error_response(serializer.errors)
        
        try:
            # Use transition_to method for safe status change
            # travel_app.transition_to('submitted', user=request.user)
            # travel_app.submitted_at = timezone.now()
            # travel_app.save(update_fields=['submitted_at'])
            
            # # Set settlement due date
            travel_app.set_settlement_due_date()
            
            # Trigger approval workflow
            from apps.travel.business_logic.approval_engine import ApprovalEngine, ApprovalEngineException
            
            try:
                approval_engine = ApprovalEngine(travel_app)
                approval_engine.initiate_approval_process()
                
                # Send email notification
                try:
                    from apps.notifications.services import EmailNotificationService
                    EmailNotificationService.send_travel_request_submitted(travel_app)
                except Exception as e:
                    logger.warning(f"Email notification failed: {str(e)}")
                
                return success_response(
                    data={
                        'travel_request_id': travel_app.get_travel_request_id(),
                        'status': travel_app.status,
                        'current_approver': travel_app.current_approver.get_full_name() if travel_app.current_approver else None,
                        'approval_chain': approval_engine.get_approval_summary()['approval_chain']
                    },
                    message='Travel application submitted successfully',
                    status_code=status.HTTP_200_OK
                )
                
            except ApprovalEngineException as e:
                return error_response(
                    message='Application submitted but approval workflow failed',
                    errors={
                        'detail': str(e),
                        'warning': 'Please contact admin to manually assign approvers'
                    },
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
                
        except ValidationError as e:
            return error_response(
                message='Status transition failed',
                errors={'detail': str(e)},
                status_code=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return error_response(
                message='Failed to submit travel application',
                errors={'detail': str(e)},
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class MyTravelApplicationsView(APIView):
    """
    Dashboard view for employee's travel applications
    """
    permission_classes = [IsAuthenticated,]
    pagination_class = StandardResultsSetPagination

    def get(self, request):
        user = request.user
        status_filter = request.query_params.get('status', 'all').lower()

        # Base queryset
        queryset = TravelApplication.objects.filter(employee=user)

        # Apply status filtering
        if status_filter != 'all':
            if status_filter == 'pending':
                queryset = queryset.filter(status__in=[
                    'submitted', 'pending_manager', 'pending_chro', 'pending_ceo'
                ])
            elif status_filter == 'approved':
                queryset = queryset.filter(status__in=[
                    'approved_manager', 'approved_chro', 'approved_ceo',
                    'pending_travel_desk', 'booking_in_progress', 'booked'
                ])
            elif status_filter == 'rejected':
                queryset = queryset.filter(status__in=[
                    'rejected_manager', 'rejected_chro', 'rejected_ceo'
                ])
            elif status_filter == 'draft':
                queryset = queryset.filter(status='draft')
            elif status_filter == 'completed':
                queryset = queryset.filter(status='completed')
            elif status_filter == 'cancellations':
                queryset = queryset.filter(status__in=[
                    'cancellation_requested', 'cancelled', 'cancellation_rejected'
                ])

        # Apply advanced filters (Search, Dates, Locations) using the FilterSet
        # We create a copy and remove 'status' because we handled it manually above,
        # and 'all' or grouped statuses might cause validation errors in the FilterSet.
        filter_params = request.GET.copy()
        if 'status' in filter_params:
            del filter_params['status']

        filterset = TravelApplicationFilter(filter_params, queryset=queryset)
        if filterset.is_valid():
            queryset = filterset.qs

        queryset = queryset.select_related('general_ledger').order_by('-created_at')

        # Pagination
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(queryset, request)

        # Pass context to serializer for can_edit field
        serializer = TravelApplicationSerializer(page, many=True, context={'request': request})

        # Statistics
        stats = {
            'total_applications': TravelApplication.objects.filter(employee=user).count(),
            'draft': TravelApplication.objects.filter(employee=user, status='draft').count(),
            'pending': TravelApplication.objects.filter(
                employee=user,
                status__in=['submitted', 'pending_manager', 'pending_chro', 'pending_ceo']
            ).count(),
            'approved': TravelApplication.objects.filter(
                employee=user,
                status__in=['approved_manager', 'approved_chro', 'approved_ceo',
                            'pending_travel_desk', 'booking_in_progress', 'booked']
            ).count(),
            'rejected': TravelApplication.objects.filter(
                employee=user,
                status__in=['rejected_manager', 'rejected_chro', 'rejected_ceo']
            ).count(),
            'completed': TravelApplication.objects.filter(employee=user, status='completed').count(),
        }

        return paginated_response(
            serializer_data={
                "statistics": stats,
                "applications": serializer.data
            },
            paginator=paginator
        )


class TravelApplicationValidationView(APIView):
    """
    Pre-submission validation endpoint
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request, pk):
        try:
            travel_app = TravelApplication.objects.get(pk=pk, employee=request.user)
        except TravelApplication.DoesNotExist:
            return Response(
                {'error': 'Travel application not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        validation_results = []
        has_errors = False
        has_warnings = False
        
        # Validate each trip and booking
        for trip in travel_app.trip_details.all():
            trip_validations = {
                'trip_id': trip.id,
                'from_to': f"{trip.from_location.city_name} → {trip.to_location.city_name}",
                'departure_date': trip.departure_date,
                'return_date': trip.return_date,
                'issues': [],
                'bookings': []
            }
            
            # Trip-level validations
            # Only check duplicate travel for self/self_guest applications, not guest-only
            if travel_app.travel_for != 'guest':
                try:
                    from apps.travel.business_logic.validators import validate_duplicate_travel_request
                    validate_duplicate_travel_request(
                        travel_app.employee,
                        trip.departure_date,
                        trip.return_date,
                        exclude_id=travel_app.id
                    )
                except Exception as e:
                    trip_validations['issues'].append({
                        'type': 'duplicate_travel',
                        'message': str(e),
                        'severity': 'error'
                    })
                    has_errors = True
            
            # Booking-level validations
            for booking in trip.bookings.all():
                booking_validation = {
                    'booking_id': booking.id, 
                    'booking_type': booking.booking_type.name,
                    'sub_option': booking.sub_option.name if booking.sub_option else None,
                    'estimated_cost': float(booking.estimated_cost or 0),
                    'issues': []
                }
                
                try:
                    # Advance booking validation
                    from apps.travel.business_logic.validators import validate_advance_booking
                    validate_advance_booking(
                        trip.departure_date,
                        booking.booking_type.name,
                        booking.estimated_cost or 0
                    )
                except Exception as e:
                    booking_validation['issues'].append({
                        'type': 'advance_booking',
                        'message': str(e),
                        'severity': 'error'
                    })
                    has_errors = True
                
                # Travel entitlement validation
                if booking.sub_option:
                    try:
                        from apps.travel.business_logic.validators import validate_travel_entitlement
                        validate_travel_entitlement(
                            travel_app.employee,
                            booking.booking_type,
                            booking.sub_option,
                            # trip.to_location.city.category
                            trip.to_location.category,
                            estimated_cost=booking.estimated_cost
                        )
                    except Exception as e:
                        booking_validation['issues'].append({
                            'type': 'entitlement',
                            'message': str(e),
                            'severity': 'error'
                        })
                        has_errors = True
                
                # Flight fare validation
                if booking.booking_type.name.lower() == 'flight' and booking.estimated_cost > 10000:
                    booking_validation['issues'].append({
                        'type': 'ceo_approval_required',
                        'message': f'Flight fare ₹{booking.estimated_cost} exceeds ₹10,000. CEO approval will be required.',
                        'severity': 'warning'
                    })
                    has_warnings = True
                
                # Own car distance validation
                if (booking.booking_type.name.lower() == 'car' and 
                    booking.booking_details.get('transport_type') == 'own_car'):
                    distance = booking.booking_details.get('distance_km', 0)
                    if distance > 150:
                        booking_validation['issues'].append({
                            'type': 'car_distance_limit',
                            'message': f'Own car distance {distance}km exceeds 150km limit. CHRO approval required.',
                            'severity': 'warning'
                        })
                        has_warnings = True
                    
                    # Car safety validation
                    try:
                        from apps.travel.business_logic.validators import validate_car_safety_requirements
                        validate_car_safety_requirements(booking.booking_details)
                    except Exception as e:
                        booking_validation['issues'].append({
                            'type': 'car_safety',
                            'message': str(e),
                            'severity': 'error'
                        })
                        has_errors = True
                
                trip_validations['bookings'].append(booking_validation)
            
            validation_results.append(trip_validations)
        
        # Calculate DA eligibility
        da_calculations = []
        for trip in travel_app.trip_details.all():
            duration_hours = trip.get_duration_days() * 24
            # Simplified distance calculation - you might want to enhance this
            estimated_distance = 100  # Default estimate
            
            from apps.travel.business_logic.validators import calculate_da_eligibility
            da_eligibility = calculate_da_eligibility(duration_hours, estimated_distance)
            
            if da_eligibility['eligible']:
                from apps.travel.business_logic.calculations import calculate_da_incidentals
                da_calc = calculate_da_incidentals(
                    travel_app.employee,
                    trip.get_city_category(),
                    trip.get_duration_days(),
                    duration_hours
                )
                da_calculations.append({
                    'trip_id': trip.id,
                    'eligible': True,
                    'da_type': da_eligibility['da_type'],
                    'calculations': da_calc
                })
            else:
                da_calculations.append({
                    'trip_id': trip.id,
                    'eligible': False,
                    'reason': da_eligibility['reason']
                })
        
        return Response({
            'can_submit': not has_errors,
            'has_warnings': has_warnings,
            'validation_summary': {
                'total_trips': len(validation_results),
                'errors_count': sum(len(trip.get('issues', [])) +
                                  sum(len(booking.get('issues', [])) for booking in trip.get('bookings', [])) 
                                  for trip in validation_results),
                'warnings_count': sum(len([issue for issue in trip.get('issues', []) if issue.get('severity') == 'warning']) +
                                    sum(len([issue for issue in booking.get('issues', []) if issue.get('severity') == 'warning']) 
                                        for booking in trip.get('bookings', [])) 
                                    for trip in validation_results)
            },
            'validation_results': validation_results,
            'da_calculations': da_calculations
        })
    

class TravelApplicationCostEstimateView(APIView):
    """
    Get cost estimates for travel application
    """
    permission_classes = [IsAuthenticated, IsEmployee]
    
    def get(self, request, pk):
        try:
            travel_app = TravelApplication.objects.get(pk=pk, employee=request.user)
        except TravelApplication.DoesNotExist:
            return Response(
                {'error': 'Travel application not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        cost_breakdown = {
            'travel_costs': [],
            'accommodation_costs': [],
            'da_incidentals': [],
            'total_estimated_cost': 0
        }
        
        total_cost = 0
        
        for trip in travel_app.trip_details.all():
            trip_costs = {
                'trip_id': trip.id,
                'from_to': f"{trip.from_location.city_name} → {trip.to_location.city_name}",
                'bookings': []
            }
            
            for booking in trip.bookings.all():
                booking_cost = {
                    'booking_type': booking.booking_type.name,
                    'sub_option': booking.sub_option.name if booking.sub_option else None,
                    'estimated_cost': float(booking.estimated_cost or 0)
                }
                
                if booking.booking_type.name.lower() in ['flight', 'train', 'car']:
                    cost_breakdown['travel_costs'].append(booking_cost)
                elif booking.booking_type.name.lower() == 'accommodation':
                    cost_breakdown['accommodation_costs'].append(booking_cost)
                
                total_cost += booking.estimated_cost or 0
                trip_costs['bookings'].append(booking_cost)
            
            # Calculate DA/Incidentals for this trip
            from apps.travel.business_logic.calculations import calculate_da_incidentals
            da_calc = calculate_da_incidentals(
                travel_app.employee,
                trip.get_city_category(),
                trip.get_duration_days(),
                trip.get_duration_days() * 24
            )
            
            if 'da_amount' in da_calc:
                da_entry = {
                    'trip_id': trip.id,
                    'city_category': trip.get_city_category(),
                    'duration_days': trip.get_duration_days(),
                    'da_amount': float(da_calc['da_amount']),
                    'incidental_amount': float(da_calc['incidental_amount']),
                    'total': float(da_calc['da_amount'] + da_calc['incidental_amount'])
                }
                cost_breakdown['da_incidentals'].append(da_entry)
                total_cost += da_entry['total']
        
        cost_breakdown['total_estimated_cost'] = float(total_cost)
        
        return Response(cost_breakdown)
    
class CheckBookingEntitlementView(APIView):
    """
    Check if user is entitled to specific booking type
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        sub_option_id = request.data.get('sub_option_id')
        city_category_id = request.data.get('city_category_id')
        
        if not sub_option_id or not city_category_id:
            return Response(
                {'error': 'sub_option_id and city_category_id required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        from apps.master_data.models import TravelSubOption, CityCategoriesMaster
        from apps.travel.business_logic.validators import check_booking_entitlement
        
        try:
            sub_option = TravelSubOption.objects.select_related('mode').get(id=sub_option_id)
            city_category = CityCategoriesMaster.objects.get(id=city_category_id)
            
            is_allowed, max_amount, message = check_booking_entitlement(
                request.user,
                sub_option.mode,
                sub_option,
                city_category
            )
            
            return Response({
                'is_allowed': is_allowed,
                'max_amount': float(max_amount) if max_amount else None,
                'message': message,
                'sub_option_name': sub_option.name,
                'city_category': city_category.name
            })
        
        except (TravelSubOption.DoesNotExist, CityCategoriesMaster.DoesNotExist) as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_404_NOT_FOUND
            )
        

class RequestAccommodationBookingView(APIView):
    """
    Request accommodation booking for approved travel application
    """
    permission_classes = [IsAuthenticated]
    
    @transaction.atomic
    def post(self, request, application_id):
        try:
            travel_app = TravelApplication.objects.get(
                id=application_id,
                employee=request.user,
                status__in=['approved_manager', 'approved_chro', 'approved_ceo']
            )
        except TravelApplication.DoesNotExist:
            return Response({'error': 'Application not found or not approved'}, status=404)
        
        results = []
        for trip in travel_app.trip_details.all():
            from apps.travel.business_logic.booking_engine import AccommodationBookingEngine
            engine = AccommodationBookingEngine(trip)
            
            result = engine.process_accommodation_request(
                guest_count=request.data.get('guest_count', 1),
                special_requests=request.data.get('special_requests', '')
            )
            results.append(result)
        
        return Response({'bookings': results})
    

class RequestVehicleBookingView(APIView):
    permission_classes = [IsAuthenticated]
    
    @transaction.atomic
    def post(self, request, application_id):
        travel_app = TravelApplication.objects.get(id=application_id, employee=request.user)
        
        vehicle_requests = request.data.get('vehicle_requests', [])
        results = []
        
        for trip_id in vehicle_requests:
            trip = travel_app.trip_details.get(id=trip_id)
            
            from apps.travel.business_logic.booking_engine import VehicleBookingEngine
            engine = VehicleBookingEngine(trip)
            
            result = engine.process_vehicle_request(request.data)
            results.append(result)
        
        return Response({'vehicle_bookings': results})
    

class BookingListAPIView(ListAPIView):
    serializer_class = BookingListSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Booking.objects.select_related(
            'booking_type', 'sub_option', 'trip_details__from_location', 'trip_details__to_location'
        )

        employee_id = self.request.query_params.get('employee_id')
        application_id = self.request.query_params.get('application_id')
        status = self.request.query_params.get('status')
        booking_type = self.request.query_params.get('booking_type')

        if employee_id:
            qs = qs.filter(trip_details__application__employee_id=employee_id)

        if application_id:
            qs = qs.filter(trip_details__application_id=application_id)

        if status:
            qs = qs.filter(status=status)

        if booking_type:
            qs = qs.filter(booking_type_id=booking_type)

        return qs


class BookingDetailAPIView(RetrieveAPIView):
    queryset = Booking.objects.all().select_related(
        'booking_type', 'sub_option', 'trip_details'
    )
    serializer_class = BookingDetailSerializer
    permission_classes = [IsAuthenticated]


class ItineraryAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, application_id):
        try:
            app = TravelApplication.objects.get(id=application_id)
        except TravelApplication.DoesNotExist:
            return Response({"error": "Not found"}, status=404)

        trip = app.trip_details
        bookings = Booking.objects.filter(trip_details=trip).select_related(
            'booking_type', 'sub_option'
        )

        # Timeline
        timeline = []
        
        for b in bookings:
            bd = b.booking_details
            
            event = {
                "type": b.booking_type.name.lower(),
                "title": self._format_title(b),
                "date": bd.get("departure_date") or trip.departure_date,
                "start_time": bd.get("departure_time"),
                "end_time": bd.get("arrival_time"),
                "details": bd
            }
            timeline.append(event)

        # Sort timeline by date
        timeline = sorted(timeline, key=lambda x: x["date"])

        response = {
            "application_id": app.id,
            "employee_name": app.employee.employee_name,
            "purpose": app.purpose,
            "locations": {
                "from": trip.from_location.name,
                "to": trip.to_location.name,
            },
            "trip_summary": {
                "start_date": trip.departure_date,
                "end_date": trip.return_date or trip.departure_date,
            },
            "timeline": timeline
        }

        return Response(response)

    def _format_title(self, booking):
        mode = booking.booking_type.name
        details = booking.booking_details

        if mode.lower() == "flight":
            return f"Flight: {details.get('from')} → {details.get('to')}"
        if mode.lower() == "train":
            return f"Train: {details.get('from')} → {details.get('to')}"
        if mode.lower() == "hotel":
            return f"Hotel Check-in: {details.get('hotel_name')}"
        return mode
