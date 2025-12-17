from django.db import models
from django.utils import timezone
from apps.notifications.center import NotificationCenter
from utils.get_assigned_agents import get_assigned_booking_agent
from utils.get_travel_desk_users import get_travel_desk_users

class TravelApprovalFlow(models.Model):
    """
    Dynamic approval chain for each travel application
    """
    APPROVAL_LEVELS = [
        ('self_approval', 'Self Approval'),
        ('manager', 'Reporting Manager'),
        ('chro', 'CHRO'),
        ('ceo', 'CEO'),
        ('travel_desk', 'Travel Desk'),
    ]
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('skipped', 'Skipped'),
    ]
    
    travel_application = models.ForeignKey(
        'TravelApplication', 
        on_delete=models.CASCADE,
        related_name='approval_flows'
    )
    approver = models.ForeignKey(
        'authentication.User',
        on_delete=models.CASCADE,
        related_name='approval_tasks'
    )
    approval_level = models.CharField(max_length=20, choices=APPROVAL_LEVELS)
    sequence = models.PositiveIntegerField()
    
    # Permissions
    can_view = models.BooleanField(default=True)
    can_approve = models.BooleanField(default=True)
    
    # Status and timing
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    approved_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)
    
    # Auto-generated based on business rules
    is_required = models.BooleanField(default=True)
    triggered_by_rule = models.CharField(max_length=100, blank=True)  # e.g., "flight_above_10k"
    parallel_group = models.CharField(max_length=50, blank=True, null=True,  help_text="Group ID for parallel approvals")

    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ('travel_application', 'approver', 'approval_level')
        ordering = ['sequence']
        indexes = [
            models.Index(fields=['travel_application', 'sequence']),
            models.Index(fields=['approver', 'status']),
        ]
    
    def __str__(self):
        return f"{self.travel_application.get_travel_request_id()} - {self.approval_level} ({self.status})"
    
    def is_parallel_approval_complete(self):
        """Check if all parallel approvals in same group are complete"""
        if not self.parallel_group:
            return True  # Not a parallel approval
        
        parallel_approvals = TravelApprovalFlow.objects.filter(
            travel_application=self.travel_application,
            parallel_group=self.parallel_group
        )
        
        # Check if all in group are approved
        return all(
            approval.status == 'approved' 
            for approval in parallel_approvals
        )
    
    def approve(self, notes=""):
        self.status = 'approved'
        self.approved_at = timezone.now()
        self.notes = notes
        self.save()

        application = self.travel_application

        # -----------------------------------------
        # SPECIAL CASE: CEO approval after cost escalation
        # -----------------------------------------
        if (
            self.approval_level == "ceo"
            and self.triggered_by_rule in [
                "actual_cost_crossed_policy_limit",
                "actual_cost_exceeded_allowed_delta",
            ]
        ):
            # Resume booking workflow
            application.status = "booking_in_progress"
            application.current_approver = None
            application.save(update_fields=["status", "current_approver"])

            # Audit (important)
            from apps.travel.models.audit import AuditLog
            AuditLog.objects.create(
                user=self.approver,
                action="resume_booking_after_ceo_approval",
                content_object=application,
                changes={
                    "approval_flow_id": self.id,
                    "reason": self.triggered_by_rule,
                },
            )
            return

        # -----------------------------------------
        # DEFAULT FLOW
        # -----------------------------------------
        application.update_status_after_approval(self)
        assigned_agent = get_assigned_booking_agent(application)

        # Notify Booking Agent
        NotificationCenter.notify(
            event_name="travel.ceo.reapproval_approved",
            reference={"type": "TravelRequest", "id": application.id},
            payload={
                "request_id": application.get_travel_request_id(),
                "employee_name": application.employee.get_full_name(),
                "booking_agent_name": assigned_agent.get_full_name() if assigned_agent else "",
                "action_required": "Resume booking",

                # REQUIRED for default_resolver
                "recipients": [
                    application.employee.id,
                    *( [assigned_agent.id] if assigned_agent else [] ),
                ],
            },
        )
        

    def reject(self, notes=""):
        """Reject application"""
        self.status = 'rejected'
        self.approved_at = timezone.now()
        self.notes = notes
        self.save()
        
        # Update travel application status to rejected
        self.travel_application.status = f'rejected_{self.approval_level}'
        self.travel_application.save()

        assigned_agent = get_assigned_booking_agent(self.travel_application)
        travel_desk_users = get_assigned_booking_agent(self.travel_application)

        NotificationCenter.notify(
        event_name="travel.ceo.reapproval_rejected",
        reference={"type": "TravelRequest", "id": self.travel_application.id},
        payload={
            "request_id": self.travel_application.get_travel_request_id(),
            "reason": self.notes,
            "action_required": "Travel Desk intervention required",

            # REQUIRED for default_resolver
            "recipients": [
                self.travel_application.employee.id,
                *( [assigned_agent.id] if assigned_agent else [] ),
            ],
        },
    )
