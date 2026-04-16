import io
import traceback
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from rest_framework.parsers import MultiPartParser, FormParser
from django.utils import timezone
from datetime import datetime
from decimal import Decimal
from django.http import FileResponse, HttpResponse
from django.db.models import Q, Sum
from concurrent.futures import ThreadPoolExecutor

from apps.expenses.reports.claim_details_report import generate_claim_details_report

# Setup executor for PDF generation
executor = ThreadPoolExecutor(max_workers=5)

from apps.expenses.serializers import *
from apps.travel.serializers.travel_serializers import TravelApplicationSerializer
from apps.expenses.models import *
from apps.master_data.models.approval import ApprovalMatrix
from apps.master_data.models.travel import TravelModeMaster
from utils.pagination import StandardResultsSetPagination
from utils.response_formatter import *
from apps.authentication.mixins import BranchFilterMixin

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
import logging

logger = logging.getLogger(__name__)

# -------------------------
# Validate endpoint
# -------------------------
class ClaimValidateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            serializer = ClaimValidateSerializer(data=request.data)
            # Use raise_exception to let DRF handle ValidationError -> 400 with detail
            serializer.is_valid(raise_exception=False)

            if serializer.errors:
                return error_response(data=serializer.errors, message="Validation failed")

            validation_output = getattr(serializer, "_validation_output", {"errors": {}, "warnings": {}, "computed": {}})
            return success_response(message="Validation successful", data=validation_output)
        except Exception as ex:
            tb = traceback.format_exc()
            return error_response(data={"detail": str(ex), "trace": tb}, message="Unexpected error")


# -------------------------
# Submit endpoint
# -------------------------
class ClaimSubmitView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            serializer = ClaimSubmitSerializer(data=request.data)
            serializer.is_valid(raise_exception=False)
            if serializer.errors:
                logger.error(f"ClaimSubmitSerializer validation failed: {serializer.errors}")
                return error_response(data=serializer.errors, message="Validation failed")

            with transaction.atomic():
                claim = serializer.save()

            return success_response(message="Claim submitted successfully", data={"claim_id": claim.id})
        except serializers.ValidationError as ve:
            return error_response(data=ve.detail, message="Validation failed")
        except Exception as ex:
            tb = traceback.format_exc()
            return error_response(data={"detail": str(ex), "trace": tb}, message="Unexpected error")


# -------------------------------------------------------
# My Claims: List + Create (create via ClaimSubmit serializer)
# -------------------------------------------------------
class ClaimListCreateView(BranchFilterMixin, APIView):
    """
    List and create expense claims with branch-based access control.
    - Employees see only their own claims
    - Staff (Admin, Finance, etc.) see only their branch claims
    - CEO/CHRO see all claims across all branches
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        GET: list claims for the authenticated user.
        Branch-based filtering applied for staff users.
        Supports filters: status, from_date, to_date, search.
        """
        try:
            # Base queryset
            qs = ExpenseClaim.objects.select_related("employee", "status", "travel_application").all()

            # Apply branch filtering - handles all roles appropriately
            qs = self.apply_branch_filter(qs, request.user, employee_field='employee')

            # Status filter
            status_q = request.query_params.get("status")
            if status_q:
                qs = qs.filter(status__code=status_q)
            
            # Date range filters
            ffrom = request.query_params.get("from_date")
            tto = request.query_params.get("to_date")
            if ffrom:
                qs = qs.filter(created_on__date__gte=ffrom)
            if tto:
                qs = qs.filter(created_on__date__lte=tto)
            
            # Search filter: Enhanced to handle TR IDs, Claim IDs, and text search
            search = request.query_params.get("search")
            if search:
                search_filter = Q()
                search_str = str(search).strip()

                # 1. Numeric ID matching
                if search_str.isdigit():
                    search_filter |= Q(id=int(search_str)) | Q(travel_application_id=int(search_str))
                
                # 2. Travel Request ID pattern (TR/TSF/YYYY/ID)
                elif "/" in search_str:
                    parts = search_str.split("/")
                    # extract final sequence if numeric
                    if parts and parts[-1].isdigit():
                        search_filter |= Q(travel_application_id=int(parts[-1]))

                # 3. Purpose and Employee search
                search_filter |= Q(travel_application__purpose__icontains=search_str)
                search_filter |= Q(employee__username__icontains=search_str)
                search_filter |= Q(employee__first_name__icontains=search_str)
                search_filter |= Q(employee__last_name__icontains=search_str)
                
                qs = qs.filter(search_filter)

            qs = qs.order_by("-created_on")

            paginator = StandardResultsSetPagination()
            page = paginator.paginate_queryset(qs, request)
            serializer = ClaimListSerializer(page, many=True, context={"request": request})
            
            return paginated_response(serializer_data=serializer.data, paginator=paginator, message="Claims retrieved")
        except Exception as ex:
            tb = traceback.format_exc()
            return error_response(data={"detail": str(ex), "trace": tb}, message="Unexpected error")

    def post(self, request):
        """
        POST: submit a claim. Uses ClaimSubmitRequestSerializer from existing business logic.
        """
        try:
            serializer = ClaimSubmitRequestSerializer(data=request.data)
            serializer.is_valid(raise_exception=False)
            if serializer.errors:
                logger.error(f"ClaimSubmitRequestSerializer validation failed: {serializer.errors}")
                return error_response(data=serializer.errors, message="Validation failed")

            claim = serializer.save()
            return success_response(message="Claim submitted successfully", data={"claim_id": claim.id})
        except Exception as ex:
            tb = traceback.format_exc()
            return error_response(data={"detail": str(ex), "trace": tb}, message="Unexpected error")

# -------------------------------------------------------
# My Personal Claims: Strictly for the logged-in user
# -------------------------------------------------------
class MyExpenseClaimsListView(APIView):
    """
    Dashboard view for employee's own expense claims.
    Strictly filters data to ensure personal isolation regardless of roles.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            user = request.user
            # Base queryset: strictly current user only
            qs = ExpenseClaim.objects.filter(employee=user).select_related(
                "employee", "status", "travel_application"
            )

            # Status filter
            status_q = request.query_params.get("status")
            if status_q:
                qs = qs.filter(status__code=status_q)
            
            # Date range filters
            ffrom = request.query_params.get("from_date")
            tto = request.query_params.get("to_date")
            if ffrom:
                qs = qs.filter(created_on__date__gte=ffrom)
            if tto:
                qs = qs.filter(created_on__date__lte=tto)
            
            # Search filter: Enhanced to handle TR IDs, Claim IDs, and text search
            search = request.query_params.get("search")
            if search:
                search_filter = Q()
                search_str = str(search).strip()

                # 1. Numeric ID matching
                if search_str.isdigit():
                    search_filter |= Q(id=int(search_str)) | Q(travel_application_id=int(search_str))
                
                # 2. Travel Request ID pattern (TR/TSF/YYYY/ID)
                elif "/" in search_str:
                    parts = search_str.split("/")
                    if parts and parts[-1].isdigit():
                        search_filter |= Q(travel_application_id=int(parts[-1]))

                # 3. Purpose search (employee search not strictly needed for personal view but kept for consistency)
                search_filter |= Q(travel_application__purpose__icontains=search_str)
                
                qs = qs.filter(search_filter)

            qs = qs.order_by("-created_on")

            paginator = StandardResultsSetPagination()
            page = paginator.paginate_queryset(qs, request)
            serializer = ClaimListSerializer(page, many=True, context={"request": request})
            
            return paginated_response(serializer_data=serializer.data, paginator=paginator, message="Claims retrieved")
        except Exception as ex:
            tb = traceback.format_exc()
            return error_response(data={"detail": str(ex), "trace": tb}, message="Unexpected error")


# -------------------------
# Claim detail
# -------------------------
class ClaimDetailView(BranchFilterMixin, APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, claim_id):
        try:
            claim = ExpenseClaim.objects.select_related("employee", "status", "travel_application").filter(id=claim_id).first()
            if not claim:
                return error_response(data={"claim": ["Claim not found"]}, message="Claim not found")
            
            user = request.user
            is_employee = (claim.employee == user)
            is_staff = user.is_staff
            is_approver = claim.approval_flow.filter(approver=user).exists()

            # Auto-approver logic (manager fallback)
            from apps.authentication.models.profiles import OrganizationalProfile
            profile = OrganizationalProfile.objects.filter(user=claim.employee).first()
            is_reporting_manager = (
                profile and profile.reporting_manager == user
            )

            # 2. Staff role check (Finance, Travel Desk, Admin)
            is_staff_role = (
                user.has_role('Admin') or 
                user.has_role('admin') or
                user.has_role('Travel Desk') or
                user.has_role('Finance')
            )
            
            # Check branch access for staff roles
            has_branch_access = is_staff_role and self.check_branch_access(user, claim.employee)

            if not (is_employee or is_staff or is_approver or is_reporting_manager or has_branch_access):
                return error_response(
                    data={"permission": ["You cannot view this claim"]},
                    message="Forbidden"
                )
            
            # ----------------------------------------------------
            # Report Generation (PDF)
            # ----------------------------------------------------
            if request.query_params.get("download_report") == "true":
                try:
                    def generate():
                        return generate_claim_details_report(claim_id)

                    pdf_bytes = executor.submit(generate).result()

                    if not pdf_bytes:
                        return error_response(message="Report generation failed")

                    filename = f"Claim_Report_{claim_id}.pdf"
                    response = HttpResponse(pdf_bytes, content_type="application/pdf")
                    response["Content-Disposition"] = f'attachment; filename="{filename}"'
                    return response
                except Exception as e:
                    logger.error(f"Error generating claim report: {str(e)}", exc_info=True)
                    return error_response(message="Failed to generate report")

            serializer = ClaimDetailSerializer(claim, context={"request": request})
            return success_response(message="Claim detail retrieved", data=serializer.data)
        except Exception as ex:
            tb = traceback.format_exc()
            return error_response(data={"detail": str(ex), "trace": tb}, message="Unexpected error")
        
# -------------------------
# Claim list (with filters + pagination)
# -------------------------
class ClaimListView(BranchFilterMixin, APIView):
    """
    General claim list with branch-based access control.
    Finance and Travel Desk users see only their branch claims.
    CEO/CHRO see all claims across all branches.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            user = request.user
            # Base queryset
            qs = ExpenseClaim.objects.select_related("employee", "status", "travel_application").all()

            # Apply branch filtering - handles all roles appropriately
            qs = self.apply_branch_filter(qs, user, employee_field='employee')

            # Status filter
            status_q = request.query_params.get("status")
            if status_q:
                qs = qs.filter(status__code=status_q)
            
            # Date range filters
            from_date = request.query_params.get("from")
            to_date = request.query_params.get("to")
            if from_date:
                qs = qs.filter(submitted_on__date__gte=from_date)
            if to_date:
                qs = qs.filter(submitted_on__date__lte=to_date)

            qs = qs.order_by("-submitted_on")

            # Pagination
            paginator = StandardResultsSetPagination()
            page = paginator.paginate_queryset(qs, request)
            serializer = ExpenseClaimSerializer(page, many=True, context={"request": request})
            return paginated_response(serializer_data=serializer.data, paginator=paginator, message="Success")
        except Exception as ex:
            tb = traceback.format_exc()
            return error_response(data={"detail": str(ex), "trace": tb}, message="Unexpected error")

class ClaimReceiptUploadView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, claim_id):
        """
        Upload one or multiple receipt files.
        Required fields:
            files[] : actual files
            items[] : matching ExpenseItem IDs
        """

        claim = ExpenseClaim.objects.filter(id=claim_id).first()
        if not claim:
            return error_response(data={"claim": ["Invalid claim ID"]}, message="Claim not found")

        # Permissions
        if claim.employee != request.user and not request.user.is_staff:
            return error_response(data={"permission": ["Not allowed"]}, message="Forbidden")

        files = request.FILES.getlist("files")
        items = request.data.getlist("items")

        if not files:
            return error_response(data=None, message="No files uploaded")
        if not items:
            return error_response(data=None, message="Missing 'items' mapping list")
        if len(files) != len(items):
            return error_response(data={"detail": "files count must match items count"}, message="Mismatch between files and items")

        updated_items = []

        with transaction.atomic():
            for file_obj, item_id in zip(files, items):
                exp_item = ExpenseItem.objects.filter(id=item_id, claim=claim).first()
                if not exp_item:
                    return error_response(message="Invalid item mapping", serializer_data={"item": [f"ExpenseItem {item_id} not found for claim {claim_id}"]})

                exp_item.receipt_file = file_obj
                exp_item.has_receipt = True
                exp_item.save()

                updated_items.append(exp_item.id)

        return success_response(message="Receipts uploaded successfully", data={"updated_items": updated_items})

# -------------------------
# Master endpoints (frontend)
# -------------------------
class ExpenseTypeListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Return only active expense types (used in dropdowns)."""
        try:
            types = ExpenseTypeMaster.objects.all().order_by("name")
            data = ExpenseTypeMasterSerializer(types, many=True).data
            return success_response(message="Success", data=data)
        except Exception as ex:
            return error_response(message="Unexpected error", data={"detail": str(ex)})

    def post(self, request):
        """Create a new expense type."""
        try:
            serializer = ExpenseTypeMasterSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return success_response(message="Created successfully", data=serializer.data)
        except Exception as ex:
            return error_response(message="Failed to create", data=serializer.errors)

class ExpenseTypeDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, pk):
        return ExpenseTypeMaster.objects.filter(pk=pk).first()

    def post(self, request, pk):
        """Update Expense Type (your frontend uses POST for update)."""
        et = self.get_object(pk)
        if not et:
            return error_response(message="Not found", data=None)

        serializer = ExpenseTypeMasterSerializer(et, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return success_response(message="Updated successfully", data=serializer.data)

        return error_response(message="Update failed", data=serializer.errors)

    def delete(self, request, pk):
        """
        Support BOTH:
         - Soft delete → toggle is_active
         - Hard delete → if ?hard=true 
        """
        et = self.get_object(pk)
        if not et:
            return error_response(message="Not found", data=None)

        hard = request.query_params.get("hard")

        if hard == "true":
            et.delete()
            return success_response(message="Hard delete successful", data=None)

        # Soft delete
        et.is_active = False
        et.save()
        return success_response(message="Soft delete successful", data=None)

class ClaimStatusListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Return claim statuses in correct business sequence."""
        try:
            statuses = ClaimStatusMaster.objects.all().order_by("sequence")
            data = ClaimStatusMasterSerializer(statuses, many=True).data
            return success_response(message="Success", data=data)
        except Exception as ex:
            return error_response(message="Unexpected error", data={"detail": str(ex)})

    def post(self, request):
        """Create a new claim status."""
        try:
            serializer = ClaimStatusMasterSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return success_response(message="Created successfully", data=serializer.data)
        except Exception as ex:
            return error_response(message="Failed to create", data=serializer.errors)

class ClaimStatusDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, pk):
        return ClaimStatusMaster.objects.filter(pk=pk).first()

    def post(self, request, pk):
        """Update claim status (frontend uses POST)"""
        cs = self.get_object(pk)
        if not cs:
            return error_response(message="Not found", data=None)

        serializer = ClaimStatusMasterSerializer(cs, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return success_response(message="Updated successfully", data=serializer.data)

        return error_response(message="Update failed", data=serializer.errors)

    def delete(self, request, pk):
        """Hard delete only."""
        cs = self.get_object(pk)
        if not cs:
            return error_response(message="Not found", data=None)

        cs.delete()
        return success_response(message="Deleted", data=None)


# -------------------------
# Pending Claim Approvals for Responsible Approver
# -------------------------
class ClaimPendingApprovalListView(BranchFilterMixin, APIView):
    """
    Pending claim approvals with branch-based access control.
    Approvers see only pending claims from their branch.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        # Base queryset: Fetch all claims where this user is an approver
        claims = ExpenseClaim.objects.filter(
            approval_flow__approver=user
        ).select_related(
            "travel_application",
            "employee",
            "status"
        ).distinct()
        
        # Apply branch filtering - Approvers see only their branch
        claims = self.apply_branch_filter(claims, user, employee_field='employee')

        # Optional filters
        status_q = request.query_params.get("status")   # e.g. manager_pending, approved, rejected
        if status_q:
            claims = claims.filter(status__code=status_q)

        search = request.query_params.get("search")
        if search:
            claims = claims.filter(
                Q(id__icontains=search) |
                Q(travel_application__travel_request_id__icontains=search) |
                Q(employee__first_name__icontains=search) |
                Q(employee__last_name__icontains=search)
            )

        date_from = request.query_params.get("from_date")
        date_to = request.query_params.get("to_date")
        if date_from:
            claims = claims.filter(created_on__date__gte=date_from)
        if date_to:
            claims = claims.filter(created_on__date__lte=date_to)

        claims = claims.order_by("-created_on")

        paginator = StandardResultsSetPagination()
        page = paginator.paginate_queryset(claims, request)
        serializer = ClaimListSerializer(page, many=True)

        return paginated_response(
            message="Approval claims fetched successfully",
            serializer_data=serializer.data,
            paginator=paginator
        )

# -------------------------
# ClaimActionView — Approve / Reject
# -------------------------
class ClaimActionView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_claim_final_approver(self, tr):
        """
        Decide who should approve the claim:
        1. Last approver of travel application (highest approval_level & approved)
        2. Else: reporting manager
        3. If employee has no manager → auto-approve
        """

        # Try last approver from travel approval flow
        last_flow = tr.approval_flows.filter(
            status="approved"
        ).order_by("-approval_level", "-approved_at").first()

        if last_flow:
            return last_flow.approver

        # Fallback → reporting manager
        from apps.authentication.models.profiles import OrganizationalProfile
        profile = OrganizationalProfile.objects.filter(user=tr.employee).first()
        if profile and profile.reporting_manager:
            return profile.reporting_manager

        # No manager → auto approve
        return None

    def post(self, request, claim_id):
        serializer = ApprovalActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        action = serializer.validated_data["action"]
        remarks = serializer.validated_data.get("remarks", "")

        claim = ExpenseClaim.objects.select_related(
            "travel_application", "employee", "status"
        ).filter(id=claim_id).first()

        if not claim:
            return error_response(data=None, message="Claim not found")

        tr = claim.travel_application
        approver = self._get_claim_final_approver(tr)

        # Auto-approval scenario (self manager)
        if approver is None:
            return self._auto_handle(claim, request.user, action, remarks)
        
        # Permission check — only the approver can approve/reject
        if request.user != approver and not approver and not request.user.is_staff:
            return error_response(data=None, message="You are not authorized to act on this claim")
        
        return self._process_action(claim, request.user, action, remarks)
    
    # ----------------------------
    # Internal helpers
    # ----------------------------

    def _auto_handle(self, claim, user, action, remarks):
        """Auto approve or reject when no approver exists."""
        status_code = "approved" if action == "approve" else "rejected"
        status_obj = ClaimStatusMaster.objects.filter(code=status_code).first()

        claim.status = status_obj
        claim.save()

        flow = ClaimApprovalFlow.objects.filter(claim=claim, status="pending").first()
        if not flow:
            flow = ClaimApprovalFlow.objects.create(
                claim=claim,
                approver=user,
                sequence=1,
                status="pending"
            )

        flow.status = status_code
        flow.remarks = remarks or ("Auto-approved" if action == "approve" else "Auto-rejected")
        flow.approved_at = timezone.now()
        flow.save()

        return success_response(message=f"Claim {status_code}", data=None)

    def _process_action(self, claim, user, action, remarks):
        """Normal approval/rejection path."""
        with transaction.atomic():
            pending_flow = ClaimApprovalFlow.objects.filter(
                claim=claim,
                status="pending"
            ).first()

            if not pending_flow:
                return error_response(data=None, message="No pending approval exists")

            # Update existing row, do not create a new one
            pending_flow.status = "approved" if action == "approve" else "rejected"
            pending_flow.remarks = remarks
            pending_flow.approved_at = timezone.now()
            pending_flow.save()

            new_status_code = "finance_pending" if action == "approve" else "rejected"
            new_status = ClaimStatusMaster.objects.filter(code=new_status_code).first()
            claim.status = new_status
            claim.save()

            return success_response(message=f"Claim {new_status_code}", data={"new_status": new_status.code})


# -------------------------
# Finance Action View - Mark as Paid/Closed
# -------------------------
class ClaimFinanceActionView(BranchFilterMixin, APIView):
    """
    Finance Action View - Mark claims as Paid/Closed with branch-based access control.
    Finance users can only process claims from their assigned branch.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, claim_id):
        """
        Finance user can update claim status:
        - finance_pending -> paid
        - paid -> closed
        """
        try:
            # Verify finance permissions
            if not self._verify_finance_permissions(request.user):
                return error_response(
                    message='Permission denied',
                    data={'detail': 'Finance role required to perform this action'},
                    status_code=status.HTTP_403_FORBIDDEN
                )

            # Validate request data
            serializer = FinanceActionSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            
            action = serializer.validated_data["action"]
            remarks = serializer.validated_data.get("remarks", "")

            # Get claim with branch filtering
            claim_qs = ExpenseClaim.objects.select_related("status").filter(id=claim_id)
            
            # Apply branch filtering - Finance can only act on their branch claims
            claim_qs = self.apply_branch_filter(claim_qs, request.user, employee_field='employee')
            
            claim = claim_qs.first()
            if not claim:
                return error_response(
                    message="Claim not found or access denied",
                    data={"claim": ["Invalid claim ID or claim not in your branch"]},
                    status_code=status.HTTP_404_NOT_FOUND
                )

            # Validate action based on current status
            current_status = claim.status.code if claim.status else None
            
            if action == "mark_paid":
                if current_status != "finance_pending":
                    return error_response(
                        message="Invalid action",
                        data={"action": ["Can only mark claims as paid when status is finance_pending"]}
                    )
                new_status_code = "paid"
                
            elif action == "mark_closed":
                if current_status != "paid":
                    return error_response(
                        message="Invalid action", 
                        data={"action": ["Can only close claims when status is paid"]}
                    )
                new_status_code = "closed"
                
            elif action == "return_to_applicant":
                if current_status != "finance_pending":
                    return error_response(
                        message="Invalid action",
                        data={"action": ["Can only return claims when status is finance_pending"]}
                    )
                new_status_code = "revision_required"
                
            else:
                return error_response(
                    message="Invalid action",
                    data={"action": ["Action must be 'mark_paid', 'mark_closed', or 'return_to_applicant'"]}
                )

            # Update claim status
            with transaction.atomic():
                new_status = ClaimStatusMaster.objects.filter(code=new_status_code).first()
                if not new_status:
                    return error_response(
                        message="Status configuration error",
                        data={"status": [f"Status '{new_status_code}' not found in system"]}
                    )

                claim.status = new_status
                
                # Update timestamps based on action
                if action == "mark_paid":
                    claim.paid_on = timezone.now()
                elif action == "mark_closed":
                    claim.closed_on = timezone.now()
                
                claim.save()

                # Update any pending Hierarchical Approvals in the flow
                # This ensures the timeline reflects completion when Finance acts
                if action in ["mark_paid", "mark_closed"]:
                    claim.approval_flow.filter(status="pending").update(
                        status="approved",
                        acted_on=timezone.now(),
                        approver=request.user,
                        remarks=remarks or f"Approved via Finance Action: {action.replace('_', ' ').title()}"
                    )

                # Create finance action log
                ClaimFinanceActionLog.objects.create(
                    claim=claim,
                    action_by=request.user,
                    action=action,
                    previous_status_code=current_status,
                    new_status_code=new_status_code,
                    remarks=remarks,
                    action_date=timezone.now()
                )

            return success_response(
                message=f"Claim status updated to {new_status.label}",
                data={
                    "claim_id": claim.id,
                    "new_status": new_status_code,
                    "status_label": new_status.label
                }
            )

        except Exception as ex:
            tb = traceback.format_exc()
            return error_response(
                message="Unexpected error",
                data={"detail": str(ex), "trace": tb}
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


class ClaimableTravelApplicationsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        Return travel applications that:
        1. belong to logged-in user
        2. have status = completed
        3. do NOT already have an ExpenseClaim
        """

        qs = (
            TravelApplication.objects.filter(
                employee=request.user,
                status="completed"
            )
            .exclude(expense_claim__isnull=False)  # exclude apps with existing claim
            .exclude(travel_for='guest')           # exclude guest applications (no claims allowed)
            .select_related("employee", "general_ledger")
            .prefetch_related("trip_details", "trip_details__from_location", "trip_details__to_location")
            .order_by("-created_at")
        )

        serializer = TravelApplicationSerializer(qs, many=True)
        return Response({
            "success": True,
            "message": "Claimable travel applications retrieved successfully",
            "data": serializer.data
        })


# -------------------------------------------------------
# Claim Reports - PDF
# -------------------------------------------------------
class ClaimReportPDFView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        Generate PDF report for claims with filters.
        Returns: application/pdf stream
        """
        try:
            # permission: only staff/finance/admin can access
            if not (request.user.is_staff or request.user.groups.filter(name__in=["Finance"]).exists()):
                return Response(
                    error_response(
                        message="Forbidden",
                        serializer_data={"permission": ["Only finance/staff can generate reports"]}
                    ),
                    status=403
                )

            # validate filters
            serializer = ClaimReportFilterSerializer(data=request.query_params)
            serializer.is_valid(raise_exception=False)

            if serializer.errors:
                return Response(
                    error_response(
                        message="Invalid filters",
                        serializer_data=serializer.errors
                    ),
                    status=400
                )

            filters = serializer.validated_data

            qs = ExpenseClaim.objects.select_related(
                "employee", "status", "travel_application"
            ).all()

            # Apply filters
            if filters.get("employee"):
                qs = qs.filter(employee_id=filters["employee"])
            if filters.get("status"):
                qs = qs.filter(status__code=filters["status"])
            if filters.get("from_date"):
                qs = qs.filter(created_on__date__gte=filters["from_date"])
            if filters.get("to_date"):
                qs = qs.filter(created_on__date__lte=filters["to_date"])

            qs = qs.order_by("-created_on")[:1000]  # safety cap

            # Create PDF in-memory
            buffer = io.BytesIO()
            p = canvas.Canvas(buffer, pagesize=A4)
            width, height = A4

            # Title
            p.setFont("Helvetica-Bold", 16)
            p.drawString(40, height - 60, "Expense Claims Report")
            p.setFont("Helvetica", 10)
            p.drawString(
                40,
                height - 80,
                f"Generated by: {request.user.get_full_name() or request.user.username} "
                f"on {timezone.now().strftime('%Y-%m-%d %H:%M:%S')}"
            )
            y = height - 110

            # Table header
            p.setFont("Helvetica-Bold", 9)
            p.drawString(40, y, "Claim ID")
            p.drawString(100, y, "TR ID")
            p.drawString(220, y, "Employee")
            p.drawString(340, y, "Status")
            p.drawString(420, y, "Final Amount")
            p.setFont("Helvetica", 9)
            y -= 18

            # Rows
            for claim in qs:
                if y < 80:
                    p.showPage()
                    y = height - 80

                p.drawString(40, y, str(claim.id))

                tr_id = getattr(claim.travel_application, "travel_request_id", "") or ""
                p.drawString(100, y, tr_id[:18])

                emp = claim.employee.get_full_name() or claim.employee.username
                p.drawString(220, y, emp[:18])

                status_label = claim.status.label if claim.status else ""
                p.drawString(340, y, status_label[:12])

                p.drawString(420, y, str(claim.final_amount_payable))
                y -= 16

            p.showPage()
            p.save()
            buffer.seek(0)

            filename = f"expense_claims_report_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.pdf"
            return FileResponse(buffer, as_attachment=True, filename=filename)

        except Exception as ex:
            tb = traceback.format_exc()
            return Response(
                error_response(
                    message="Unexpected error",
                    serializer_data={"detail": str(ex), "trace": tb}
                ),
                status=500
            )


# -------------------------
# Claim Edit View - Edit claims in revision_required status
# -------------------------
class ClaimEditView(APIView):
    permission_classes = [IsAuthenticated]
    
    def put(self, request, claim_id):
        """
        Allow applicant to edit claim when status is revision_required.
        Updates expense items and recalculates totals.
        """
        try:
            claim = ExpenseClaim.objects.select_related(
                "employee", "status", "travel_application"
            ).filter(id=claim_id).first()
            
            # Validation
            if not claim:
                return error_response(
                    message="Claim not found",
                    data={"claim": ["Invalid claim ID"]}
                )
            
            if claim.employee != request.user:
                return error_response(
                    message="Permission denied",
                    data={"permission": ["You can only edit your own claims"]}
                )
            
            if claim.status.code != "revision_required":
                return error_response(
                    message="Invalid status",
                    data={"status": [f"Claim cannot be edited in '{claim.status.label}' status. Only claims in 'Revision Required' status can be edited."]}
                )
            
            # Import business logic
            from apps.expenses.business_logic.claims import compute_claim_totals_and_prepare
            
            # Update items (delete old, create new)
            with transaction.atomic():
                # Delete existing items
                claim.items.all().delete()
                
                # Recalculate totals and prepare new items
                prepared = compute_claim_totals_and_prepare(
                    request.data, 
                    travel_application=claim.travel_application,
                    exclude_claim_id=claim.id
                )
                
                if prepared["errors"]:
                    return error_response(
                        message="Validation failed",
                        data=prepared["errors"]
                    )
                
                # Update claim totals
                claim.total_da = prepared["total_da"]
                claim.total_incidental = prepared["total_incidental"]
                claim.total_expenses = prepared["total_expenses"]
                claim.final_amount_payable = prepared["final_amount"]
                claim.exceptions = prepared["warnings"] or {}
                claim.save()
                
                # Create new items
                for item in prepared["items_prepared"]:
                    item_data = item.copy()
                    ExpenseItem.objects.create(claim=claim, **item_data)
                
                # Update DA breakdown
                claim.da_breakdown.all().delete()
                for day in prepared["computed"]["da_breakdown"]:
                    DAIncidentalBreakdown.objects.create(
                        claim=claim,
                        date=day["date"],
                        eligible_da=day["da"],
                        eligible_incidental=day["incidental"],
                        hours=day["duration_hours"],
                    )
            
            return success_response(
                message="Claim updated successfully",
                data={"claim_id": claim.id}
            )
            
        except Exception as ex:
            tb = traceback.format_exc()
            return error_response(
                message="Unexpected error",
                data={"detail": str(ex), "trace": tb}
            )


# -------------------------
# Claim Resubmit View - Resubmit edited claims
# -------------------------
class ClaimResubmitView(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request, claim_id):
        """
        Resubmit claim after editing.
        Status changes from revision_required to finance_pending (bypasses manager).
        """
        try:
            claim = ExpenseClaim.objects.select_related(
                "employee", "status", "travel_application"
            ).filter(id=claim_id).first()
            
            # Validation
            if not claim:
                return error_response(
                    message="Claim not found",
                    data={"claim": ["Invalid claim ID"]}
                )
            
            if claim.employee != request.user:
                return error_response(
                    message="Permission denied",
                    data={"permission": ["You can only resubmit your own claims"]}
                )
            
            if claim.status.code != "revision_required":
                return error_response(
                    message="Invalid status",
                    data={"status": [f"Claim cannot be resubmitted in '{claim.status.label}' status. Only claims in 'Revision Required' status can be resubmitted."]}
                )
            
            # Update status to finance_pending
            with transaction.atomic():
                finance_pending = ClaimStatusMaster.objects.filter(
                    code="finance_pending"
                ).first()
                
                if not finance_pending:
                    return error_response(
                        message="Configuration error",
                        data={"status": ["Finance pending status not found in system"]}
                    )
                
                claim.status = finance_pending
                claim.submitted_on = timezone.now()
                claim.save()
                
                # Option A: Align Approval Flow at Re-submission
                from .constants import CLAIM_MANAGER_APPROVAL_REQUIRED
                
                # Dynamic level determination
                finance_level = 2 if CLAIM_MANAGER_APPROVAL_REQUIRED else 1

                # 1. If manager approval is required, ensure Level 1 (Manager) records are approved
                if CLAIM_MANAGER_APPROVAL_REQUIRED:

                    claim.approval_flow.filter(level=1, status="pending").update(
                        status="approved",
                        remarks="Auto-approved (Previously approved/Revised submission)",
                        acted_on=timezone.now()
                    )

                # 2. Identify the Finance User who returned this claim
                # This ensures the 'Pending' entry in timeline is assigned to the correct person
                last_return_log = claim.finance_action_logs.filter(
                    action="return_to_applicant"
                ).order_by("-action_date").first()
                
                # If no log found, we'll try to find any person who acted as Finance before
                finance_user = None
                if last_return_log:
                    finance_user = last_return_log.action_by
                else:
                    # Fallback: get any finance user from logs or defaults 
                    # (Production fix: should logically have a return log if status was revision_required)
                    last_finance_log = claim.finance_action_logs.all().first()
                    finance_user = last_finance_log.action_by if last_finance_log else None
                
                if not finance_user:
                    # Final fallback to any finance staff if really no logs exist
                    from django.contrib.auth import get_user_model
                    User = get_user_model()
                    finance_user = User.objects.filter(groups__name='Finance').first() or User.objects.filter(is_staff=True).first()

                # 3. Create/Update Finance record at the correct level
                finance_flow = claim.approval_flow.filter(level=finance_level).first()
                if finance_flow:
                    finance_flow.approver = finance_user
                    finance_flow.status = "pending"
                    finance_flow.remarks = "Resubmitted - Awaiting Finance Processing"
                    finance_flow.acted_on = None
                    finance_flow.save()
                else:
                    ClaimApprovalFlow.objects.create(
                        claim=claim,
                        approver=finance_user,
                        level=finance_level,
                        status="pending",
                        remarks="Resubmitted - Awaiting Finance Processing"
                    )

            
            return success_response(
                message="Claim resubmitted successfully",
                data={
                    "claim_id": claim.id, 
                    "status": "finance_pending",
                    "status_label": finance_pending.label
                }
            )
            
        except Exception as ex:
            tb = traceback.format_exc()
            return error_response(
                message="Unexpected error",
                data={"detail": str(ex), "trace": tb}
            )
