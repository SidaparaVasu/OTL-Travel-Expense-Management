from datetime import date
from django.utils import timezone
from rest_framework import serializers
from django.db import transaction

from .constants import CLAIM_MANAGER_APPROVAL_REQUIRED

from apps.expenses.models import (
    ExpenseTypeMaster,
    ClaimStatusMaster,
    ExpenseClaim,
    ExpenseItem,
    DAIncidentalBreakdown,
    ClaimApprovalFlow,
    ClaimFinanceActionLog,
)
from apps.travel.models.application import TravelApplication

from apps.expenses.business_logic.claims import (
    validate_claim_payload,
    compute_claim_totals_and_prepare,
)

# -------------------------
# Helper Functions
#--------------------------
from apps.travel.models.approval import TravelApprovalFlow
from apps.authentication.models.profiles import OrganizationalProfile
import logging

logger = logging.getLogger(__name__)

# Create initial approval stage
def get_initial_claim_approver(tr):
    # Look for Manager approval (level=1)
    mgr = tr.approval_flows.filter(approval_level=1, status="approved").order_by("-approved_at").first()
    if mgr:
        return mgr.approver

    # Look for CHRO approval (level=2)
    chro = tr.approval_flows.filter(approval_level=2, status="approved").order_by("-approved_at").first()
    if chro:
        return chro.approver

    # Look for CEO approval (level=3)
    ceo = tr.approval_flows.filter(approval_level=3, status="approved").order_by("-approved_at").first()
    if ceo:
        return ceo.approver

    # fallback → reporting manager from employee profile
    profile = OrganizationalProfile.objects.filter(user=tr.employee).first()
    if profile and profile.reporting_manager:
        return profile.reporting_manager
    
    return None


# -------------------------
# Expense Item Serializer
# -------------------------
class ExpenseItemSerializer(serializers.ModelSerializer):
    expense_type = serializers.PrimaryKeyRelatedField(
        queryset=ExpenseTypeMaster.objects.filter(is_active=True)
    )
    expense_type_display = serializers.SerializerMethodField()
    booking_id = serializers.IntegerField(required=False, allow_null=True)

    class Meta:
        model = ExpenseItem
        fields = [
            "id",
            "expense_type",
            "expense_type_display",
            "expense_date",
            "amount",
            "has_receipt",
            "receipt_file",
            "is_self_certified",
            "self_certified_reason",
            "distance_km",
            "vendor_name",
            "bill_number",
            "city_category",
            "remarks",
            "booking_id",
            "is_booking_expense",
        ]

    def get_expense_type_display(self, obj):
        et = getattr(obj, "expense_type", None)
        # if obj is unsaved dict-like during validation, et may be instance or PK - handle both
        if hasattr(et, "name"):
            return et.name
        return None


# -------------------------
# DA Breakdown Serializer
# -------------------------
class DAIncidentalBreakdownSerializer(serializers.ModelSerializer):
    class Meta:
        model = DAIncidentalBreakdown
        fields = [
            "id",
            "date",
            "eligible_da",
            "eligible_incidental",
            "hours",
            "remarks",
        ]


# -------------------------
# Claim Approval Flow Serializer (read-only helper)
# -------------------------
class ClaimApprovalFlowSerializer(serializers.ModelSerializer):
    approver_name = serializers.CharField(source="approver.get_full_name", read_only=True)

    class Meta:
        model = ClaimApprovalFlow
        fields = ["id", "approver", "approver_name", "level", "status", "remarks", "acted_on"]


# -------------------------
# Claim Finance Action Log Serializer
# -------------------------
class ClaimFinanceActionLogSerializer(serializers.ModelSerializer):
    action_by_name = serializers.CharField(source="action_by.get_full_name", read_only=True)
    
    class Meta:
        model = ClaimFinanceActionLog
        fields = [
            "id", 
            "action_by", 
            "action_by_name", 
            "action", 
            "previous_status_code", 
            "new_status_code", 
            "remarks", 
            "action_date"
        ]


# -------------------------
# Main Claim Serializer (list/detail)
# -------------------------
class ExpenseClaimSerializer(serializers.ModelSerializer):
    items = ExpenseItemSerializer(many=True, read_only=True, required=False)
    da_breakdown = DAIncidentalBreakdownSerializer(many=True, read_only=True)
    approval_flow = ClaimApprovalFlowSerializer(many=True, read_only=True)
    finance_action_logs = ClaimFinanceActionLogSerializer(many=True, read_only=True)

    employee_name = serializers.SerializerMethodField()
    travel_request_id = serializers.SerializerMethodField()
    status_code = serializers.SerializerMethodField()
    status_label = serializers.SerializerMethodField()
    approval_history_count = serializers.SerializerMethodField()
    last_approver = serializers.SerializerMethodField()
    last_action_status = serializers.SerializerMethodField()

    def get_employee_name(self, obj):
        # safe fallback if user or profile doesn't exist
        if obj.employee:
            full = obj.employee.get_full_name()
            return full or obj.employee.username or obj.employee.email
        return None

    def get_travel_request_id(self, obj):
        return obj.travel_application.get_travel_request_id() if obj.travel_application else None
    
    def get_status_code(self, obj):
        return obj.status.code if obj.status else None

    def get_status_label(self, obj):
        return obj.status.label if obj.status else None

    def get_approval_history_count(self, obj):
        return obj.approval_flow.count()

    def get_last_approver(self, obj):
        last = obj.approval_flow.order_by("-acted_on").first()
        return last.approver.get_full_name() if last and last.approver else None

    def get_last_action_status(self, obj):
        last = obj.approval_flow.order_by("-acted_on").first()
        return last.status if last else None

    class Meta:
        model = ExpenseClaim
        fields = [
            "id",
            "travel_application",
            "travel_request_id",
            "employee",
            "employee_name",
            "status",
            "status_code",
            "status_label",
            "submitted_on",
            "total_da",
            "total_incidental",
            "total_expenses",
            "advance_received",
            "final_amount_payable",
            "is_late_submission",
            "late_submission_reason",
            "exceptions",
            "paid_on",
            "closed_on",
            "items",
            "da_breakdown",
            "approval_flow",
            "finance_action_logs",
            "approval_history_count",
            "last_approver",
            "last_action_status",
            "actual_travel_start_date",
            "actual_travel_start_time",
            "actual_travel_end_date",
            "actual_travel_end_time",
            "created_on",
            "updated_on",
        ]
        read_only_fields = [
            "status",
            "submitted_on",
            "total_da",
            "total_incidental",
            "total_expenses",
            "advance_received",
            "final_amount_payable",
            "is_late_submission",
            "exceptions",
            "paid_on",
            "closed_on",
            "created_on",
            "updated_on",
        ]


# -------------------------
# Validate Serializer
# -------------------------
class ClaimValidateSerializer(serializers.Serializer):
    travel_application_id = serializers.IntegerField()
    claim_id = serializers.IntegerField(required=False)
    items = ExpenseItemSerializer(many=True)
    acknowledged_warnings = serializers.ListField(required=False)
    exception_reasons = serializers.ListField(required=False)

    # Actual Travel Dates and Distance
    actual_travel_start_date = serializers.DateField(required=False, allow_null=True)
    actual_travel_start_time = serializers.TimeField(required=False, allow_null=True)
    actual_travel_end_date = serializers.DateField(required=False, allow_null=True)
    actual_travel_end_time = serializers.TimeField(required=False, allow_null=True)
    one_way_distance_km = serializers.DecimalField(
        max_digits=8, 
        decimal_places=2, 
        required=True,
        help_text="One-way distance must be greater than 50 K.M. and travel duration must be greater than 8 hours to calculate DA and Incidentals as per policy."
    )

    def validate(self, data):
        tr = TravelApplication.objects.filter(id=data["travel_application_id"]).first()
        if not tr:
            raise serializers.ValidationError({"travel_application_id": "Invalid TR ID"})

        # Run business validation (returns dict with errors/warnings/computed)
        result = validate_claim_payload(data, travel_application=tr)

        # Save for view to use
        self._validation_output = result

        # Raise DRF-style validation error if business errors exist
        if result["errors"]:
            raise serializers.ValidationError(result["errors"])

        return data


# -------------------------
# Submit Serializer
# -------------------------
class ClaimSubmitSerializer(serializers.Serializer):
    travel_application_id = serializers.IntegerField()
    items = ExpenseItemSerializer(many=True)
    acknowledged_warnings = serializers.ListField(required=False)
    exception_reasons = serializers.ListField(required=False)

    # Actual Travel Dates and Distance
    actual_travel_start_date = serializers.DateField(required=False, allow_null=True)
    actual_travel_start_time = serializers.TimeField(required=False, allow_null=True)
    actual_travel_end_date = serializers.DateField(required=False, allow_null=True)
    actual_travel_end_time = serializers.TimeField(required=False, allow_null=True)
    one_way_distance_km = serializers.DecimalField(
        max_digits=8, 
        decimal_places=2, 
        required=True,
        help_text="One-way distance must be greater than 50 K.M. and travel duration must be greater than 8 hours to calculate DA and Incidentals as per policy."
    )

    def validate(self, data):
        # basic TR validation
        logger.info(f"Validating ClaimSubmitSerializer data keys: {list(data.keys())}")
        if 'items' in data:
            logger.info(f"Items count: {len(data['items'])}")
            for i, item in enumerate(data['items']):
                logger.info(f"Item [{i}] - Has BookingID: {item.get('booking_id')}, Has Receipt: {item.get('has_receipt')}, Type: {item.get('expense_type')}")

        tr = TravelApplication.objects.filter(id=data["travel_application_id"]).first()
        if not tr:
            raise serializers.ValidationError({"travel_application_id": "Travel request not found"})

        # Duplicate prevention: ensure no existing claim for same TR
        if ExpenseClaim.objects.filter(travel_application=tr).exists():
            raise serializers.ValidationError({"travel_application_id": ["Claim already exists for this Travel Request"]})

        # Enforce receipt requirement at serializer level (simple check)
        for idx, item in enumerate(data.get("items", [])):
            et = item.get("expense_type")
            # et is a model instance (PrimaryKeyRelatedField converted)
            if hasattr(et, "requires_receipt") and et.requires_receipt and not item.get("has_receipt", True):
                # allow self-certified if explicitly provided OR if linked to a booking (booking_id present)
                booking_id = item.get("booking_id")
                is_self_cert = item.get("is_self_certified", False)
                
                logger.debug(f"Checking receipt for item {idx}: et={et.name}, booking_id={booking_id}, self_cert={is_self_cert}")

                if not is_self_cert and not booking_id:
                    logger.warning(f"Validation Error: Receipt required for item {idx}")
                    raise serializers.ValidationError({
                        f"items[{idx}].has_receipt": [f"Receipt required for expense type: {et.name}"]
                    })

        # store TR for create
        self._travel_application = tr
        return data

    def create(self, validated_data):
        # travel application normalized in validate()
        tr = getattr(self, "_travel_application", None)
        if not tr:
            tr = TravelApplication.objects.filter(id=validated_data["travel_application_id"]).first()
            if not tr:
                raise serializers.ValidationError({"travel_application_id": "Travel request not found"})

        prepared = compute_claim_totals_and_prepare(validated_data, travel_application=tr)

        if prepared["errors"]:
            raise serializers.ValidationError(prepared["errors"])

        with transaction.atomic():
            default_status = ClaimStatusMaster.objects.filter(code="submitted").first()
            if not default_status:
                raise serializers.ValidationError(
                    {"status": "ClaimStatusMaster(code='submitted') is missing. Please seed master data."}
                )

            claim = ExpenseClaim.objects.create(
                travel_application=tr,
                employee=tr.employee,
                total_da=prepared["total_da"],
                total_incidental=prepared["total_incidental"],
                total_expenses=prepared["total_expenses"],
                advance_received=prepared["advance_received"],
                final_amount_payable=prepared["final_amount"],
                status=default_status,
                exceptions=prepared["warnings"] or {},
                actual_travel_start_date=validated_data.get("actual_travel_start_date"),
                actual_travel_start_time=validated_data.get("actual_travel_start_time"),
                actual_travel_end_date=validated_data.get("actual_travel_end_date"),
                actual_travel_end_time=validated_data.get("actual_travel_end_time"),
                one_way_distance_km=validated_data.get("one_way_distance_km"),
            )

            if CLAIM_MANAGER_APPROVAL_REQUIRED:
                manager_approver = get_initial_claim_approver(tr)
                
                if not manager_approver:
                    raise serializers.ValidationError({
                        "approver": ["Reporting manager not found for this employee"]
                    })
                
                # Set claim to manager_pending
                manager_pending_status = ClaimStatusMaster.objects.filter(code="manager_pending").first()
                claim.status = manager_pending_status
                claim.save()

                 # Create first approval flow row (Level 1)
                ClaimApprovalFlow.objects.create(
                    claim=claim,
                    approver=manager_approver,
                    level=1,
                    status="pending",
                    remarks="Awaiting manager approval",
                    acted_on=timezone.now()
                )
            else:
                # Direct to Finance - Bypass Manager
                finance_pending_status = ClaimStatusMaster.objects.filter(code="finance_pending").first()
                if not finance_pending_status:
                    raise serializers.ValidationError(
                        {"status": "ClaimStatusMaster(code='finance_pending') is missing. Please seed master data."}
                    )
                
                claim.status = finance_pending_status
                claim.save()

                # Create first approval flow row (Level 1 for Finance)
                # Since we don't have a specific finance user yet, we use a placeholder staff
                from django.contrib.auth import get_user_model
                User = get_user_model()
                finance_placeholder = User.objects.filter(groups__name='Finance').first() or User.objects.filter(is_staff=True).first()
                
                if finance_placeholder:
                    ClaimApprovalFlow.objects.create(
                        claim=claim,
                        approver=finance_placeholder,
                        level=1,
                        status="pending",
                        remarks="Awaiting Finance review",
                        # acted_on=None # Action has not happened yet
                    )


            # Late submission detection (mark flag)
            try:
                if tr.settlement_due_date and date.today() > tr.settlement_due_date:
                    claim.is_late_submission = True
                    claim.late_submission_reason = "Submitted after settlement due date"
                    claim.save()
            except Exception:
                # ignore if tr doesn't have settlement_due_date
                pass

            # Save items
            for item in prepared["items_prepared"]:
                item_data = item.copy()
                ExpenseItem.objects.create(claim=claim, **item_data)

            # Save DA breakdown
            for day in prepared["computed"]["da_breakdown"]:
                DAIncidentalBreakdown.objects.create(
                    claim=claim,
                    date=day["date"],
                    eligible_da=day["da"],
                    eligible_incidental=day["incidental"],
                    hours=day["duration_hours"],
                )

            # Resolve any pending settlement reminder events for this travel application.
            # Once a claim is created the employee has initiated settlement, so reminders
            # are no longer needed regardless of is_settled or due date.
            try:
                from apps.notifications.models import NotificationEvent
                NotificationEvent.objects.filter(
                    event_name='travel.settlement.reminder',
                    reference_id=tr.id,
                    is_resolved=False
                ).update(is_resolved=True)
            except Exception as e:
                logger.warning(
                    f"Failed to resolve settlement reminder events for TR {tr.id}: {e}"
                )

        return claim


# -------------------------
# Master serializers for frontend dropdowns
# -------------------------
class ExpenseTypeMasterSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseTypeMaster
        fields = ["id", "code", "name", "requires_receipt", "is_distance_based", "is_active"]


class ClaimStatusMasterSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClaimStatusMaster
        fields = ["id", "code", "label", "sequence", "is_terminal"]


# -------------------------
# Claim Approval Action serialzer
# -------------------------
class ApprovalActionSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=["approve", "reject"])
    remarks = serializers.CharField(required=False, allow_blank=True)
    level = serializers.IntegerField(required=False)  # optional override of approver level
    

# -------------------------
# Finance Action Serializer
# -------------------------
class FinanceActionSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=["mark_paid", "mark_closed", "return_to_applicant"])
    remarks = serializers.CharField(required=False, allow_blank=True)
    
    def validate(self, data):
        # Make remarks mandatory for return_to_applicant
        if data['action'] == 'return_to_applicant' and not data.get('remarks'):
            raise serializers.ValidationError({
                "remarks": "Remarks are required when returning claim to applicant"
            })
        return data
    

# Re-export common serializers for clarity in views
ClaimListSerializer = ExpenseClaimSerializer
ClaimDetailSerializer = ExpenseClaimSerializer
ClaimValidateRequestSerializer = ClaimValidateSerializer
ClaimSubmitRequestSerializer = ClaimSubmitSerializer
ClaimActionRequestSerializer = ApprovalActionSerializer
ExpenseTypeSerializer = ExpenseTypeMasterSerializer
ClaimStatusSerializer = ClaimStatusMasterSerializer

# Report filter serializer
class ClaimReportFilterSerializer(serializers.Serializer):
    from_date = serializers.DateField(required=False)
    to_date = serializers.DateField(required=False)
    employee = serializers.IntegerField(required=False)
    department = serializers.IntegerField(required=False)
    status = serializers.CharField(required=False)