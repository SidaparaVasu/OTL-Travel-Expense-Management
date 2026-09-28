from django.db import models


class HRMSLeaveRecord(models.Model):
    """
    Tracks HRMS OD Leave approval and cancellation lifecycle for travel applications.
    """
    STATUS_CHOICES = [
        ('ACTIVE', 'Active'),
        ('DELETED', 'Deleted'),
        ('FAILED', 'Failed'),
    ]

    travel_application = models.ForeignKey(
        'TravelApplication',
        on_delete=models.CASCADE,
        related_name='hrms_leave_records'
    )
    leave_approval_id = models.BigIntegerField(
        null=True,
        blank=True,
        help_text="Approval ID returned by HRMS OdLeaveApprove API"
    )
    from_date = models.DateField()
    to_date = models.DateField()
    leave_period = models.PositiveIntegerField(help_text="Total number of leave days")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')

    # Audit & Diagnostics
    request_payload = models.JSONField(null=True, blank=True)
    response_payload = models.JSONField(null=True, blank=True)
    error_message = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'travel_hrms_leave_records'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['travel_application', 'status']),
            models.Index(fields=['leave_approval_id']),
        ]

    def __str__(self):
        return f"HRMSLeaveRecord TR#{self.travel_application_id} (ApprovalID: {self.leave_approval_id}) - {self.status}"
