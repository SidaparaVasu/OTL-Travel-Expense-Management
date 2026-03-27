from django.db import models
from django.utils import timezone
from apps.authentication.models import User

class BackdatedTRAllowance(models.Model):
    """
    Model to track administrative permissions for back-dated travel requests.
    Admin users can grant temporary permission windows to employees.
    """
    user = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        related_name='backdated_tr_allowances',
        help_text="Employee who is being granted permission"
    )
    allowed_from = models.DateTimeField(
        help_text="Start time of the permission window"
    )
    allowed_until = models.DateTimeField(
        help_text="End time of the permission window"
    )
    granted_by = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        related_name='granted_backdated_allowances',
        help_text="Administrator who granted this permission"
    )
    reason = models.TextField(
        blank=True, 
        help_text="Administrative reason for granting this exception"
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Manual override to revoke permission prematurely"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'travel_backdated_allowance'
        verbose_name = 'Back-dated TR Allowance'
        verbose_name_plural = 'Back-dated TR Allowances'
        ordering = ['-created_at']

    def __str__(self):
        return f"Allowance for {self.user.get_full_name()} until {self.allowed_until.strftime('%Y-%m-%d %H:%M')}"

    @property
    def is_currently_valid(self):
        now = timezone.now()
        return self.is_active and self.allowed_from <= now <= self.allowed_until
