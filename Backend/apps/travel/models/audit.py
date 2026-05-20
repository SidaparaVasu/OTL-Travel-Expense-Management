from django.db import models
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey

class AuditLog(models.Model):
    """Track all important changes"""
    
    ACTION_CHOICES = [
        ('create', 'Created'),
        ('update', 'Updated'),
        ('delete', 'Deleted'),
        ('approve', 'Approved'),
        ('reject', 'Rejected'),
        ('submit', 'Submitted'),
        ('cancel', 'Cancelled'),

        # Travel Desk / Booking Agent workflow
        ('assign_booking', 'Booking Assigned'),
        ('update_booking_status', 'Booking Status Updated'),
        ('forward_to_travel_desk', 'Forwarded to Travel Desk'),
        ('ceo_resume_booking', 'CEO Resumed Booking'),
        ('cancel_booking', 'Booking Cancelled'),
        ('close_booking', 'Booking Closed'),
        ('update_claim_elig', 'Claim Eligibility Updated'),
    ]
    
    user = models.ForeignKey('authentication.User', on_delete=models.SET_NULL, null=True)
    action = models.CharField(max_length=30, choices=ACTION_CHOICES)
    timestamp = models.DateTimeField(auto_now_add=True)
    
    # Generic relation to any model
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey('content_type', 'object_id')
    
    # Change details
    changes = models.JSONField(default=dict)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    
    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['content_type', 'object_id']),
            models.Index(fields=['user', '-timestamp']),
        ]
    
    def __str__(self):
        return f"{self.user} {self.action} {self.content_object} at {self.timestamp}"