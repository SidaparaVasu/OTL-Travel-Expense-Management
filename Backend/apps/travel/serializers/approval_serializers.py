from rest_framework import serializers
from ..models import TravelApprovalFlow, TravelApplication

class TravelApprovalFlowSerializer(serializers.ModelSerializer):
    approver_name = serializers.CharField(source='approver.get_full_name', read_only=True)
    travel_request_id = serializers.CharField(source='travel_application.get_travel_request_id', read_only=True)
    employee_name = serializers.CharField(source='travel_application.employee.get_full_name', read_only=True)
    escalation_reason_display = serializers.CharField(source='get_escalation_reason_display', read_only=True)
    
    class Meta:
        model = TravelApprovalFlow
        fields = [
            'id', 'travel_application', 'travel_request_id', 'employee_name',
            'approver', 'approver_name', 'approval_level', 'sequence',
            'edit_count',
            'can_view', 'can_approve', 'status', 'approved_at', 'notes',
            'is_required', 'triggered_by_rule', 'escalation_reason_display', 'created_at',
        ]
        read_only_fields = ['approver', 'approval_level', 'sequence', 'created_at']

class ApprovalActionSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=['approve', 'reject'])
    notes = serializers.CharField(required=False, allow_blank=True)
    
    def validate_notes(self, value):
        action = self.initial_data.get('action')
        if not value:
            if action == 'reject':
                raise serializers.ValidationError("Notes are required when rejecting an application")
            elif action == 'approve':
                raise serializers.ValidationError("Remarks are required when approving an application")
        return value

class ManagerApprovalListSerializer(serializers.ModelSerializer):
    """
    Serializer for manager's pending approval list
    """
    travel_request_id = serializers.CharField(source='get_travel_request_id', read_only=True)
    employee_name = serializers.CharField(source='employee.get_full_name', read_only=True)
    employee_grade = serializers.CharField(source='employee.grade.name', read_only=True)
    department = serializers.CharField(source='employee.department.dept_name', read_only=True)
    current_approval = serializers.SerializerMethodField()
    trip_summary = serializers.SerializerMethodField()
    cancellation_reason = serializers.CharField(read_only=True)
    cancellation_rejection_reason = serializers.CharField(read_only=True)
    can_approve_or_reject = serializers.SerializerMethodField()

    class Meta:
        model = TravelApplication
        fields = [
            'id', 'travel_request_id', 'employee_name', 'employee_grade',
            'department', 'purpose', 'estimated_total_cost', 'status',
            'submitted_at', 'current_approval', 'trip_summary', 'cancellation_reason',
            'cancellation_rejection_reason', 'can_approve_or_reject',
        ]

    def get_current_approval(self, obj):
        current_flow = obj.active_approval_flows().filter(
            approver=self.context['request'].user,
            status='pending',
        ).first()

        if current_flow:
            return {
                'approval_level': current_flow.approval_level,
                'sequence': current_flow.sequence,
                'can_approve': current_flow.can_approve,
                'triggered_by_rule': current_flow.triggered_by_rule,
                'escalation_reason_display': current_flow.get_escalation_reason_display(),
            }
        return None

    def get_can_approve_or_reject(self, obj):
        """
        True only when the requesting user has a pending approval flow AND
        the 30-day settlement window is still open (today <= settlement_due_date).
        Frontend uses this to show/hide Approve / Reject buttons.
        """
        from django.utils import timezone

        request = self.context.get('request')
        if not request or not request.user:
            return False

        has_pending = obj.active_approval_flows().filter(
            approver=request.user,
            status='pending',
            can_approve=True,
        ).exists()

        if not has_pending:
            return False

        today = timezone.now().date()
        if obj.settlement_due_date and today > obj.settlement_due_date:
            return False

        return True

    def get_trip_summary(self, obj):
        trips = []
        for trip in obj.trip_details.all():
            trips.append({
                'from': trip.from_location.city_name,
                'to': trip.to_location.city_name,
                'departure': trip.departure_date,
                'return': trip.return_date,
                'duration': trip.get_duration_days()
            })
        return trips