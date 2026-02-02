from django.db import models
from django.core.validators import MinValueValidator
from django.utils import timezone

class AdvanceProcessing(models.Model):
    """
    Tracks the processing status of a Travel Application's advance request by Finance.
    Acts as the 'Requisition Record'.
    """
    STATUS_CHOICES = [
        ('pending', 'Pending Processing'),
        ('processed', 'Processed'),
        ('rejected', 'Rejected'), # Optional, if finance rejects the advance but not the app?
    ]

    PAYMENT_MODE_CHOICES = [
        ('bank_transfer', 'Bank Transfer (NEFT/RTGS/IMPS)'),
        ('cash', 'Cash'),
        ('check', 'Check/DD'),
        ('corporate_card', 'Corporate Card Load'),
        ('payroll', 'Payroll Adjustment'),
        ('other', 'Other'),
    ]

    application = models.OneToOneField(
        'TravelApplication',
        on_delete=models.CASCADE,
        related_name='advance_processing',
        help_text="Link to the travel application requesting advance"
    )

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    # Processing Details
    processed_amount = models.DecimalField(
        max_digits=10, 
        decimal_places=2,
        validators=[MinValueValidator(0)],
        help_text="Actual amount processed/transfered"
    )
    
    payment_mode = models.CharField(max_length=50, choices=PAYMENT_MODE_CHOICES)
    reference_number = models.CharField(
        max_length=100, 
        blank=True, 
        help_text="Transaction ID, UTR, Check Number etc."
    )
    
    remarks = models.TextField(blank=True, help_text="Finance remarks")

    # Metadata
    processed_by = models.ForeignKey(
        'authentication.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='processed_advances'
    )
    processed_at = models.DateTimeField(default=timezone.now)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-processed_at']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['processed_by']),
        ]

    def __str__(self):
        return f"Advance {self.application.get_travel_request_id()} - {self.status}"
