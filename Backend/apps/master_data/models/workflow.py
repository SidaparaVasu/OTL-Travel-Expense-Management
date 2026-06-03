from django.db import models

# DEPRECATED: This model/component is not in use anymore and is marked for deletion.
# Status: Deprecated since June 2, 2026 — no active usage recorded.
class ApprovalWorkflowMaster(models.Model):
    """
    Master approval workflow configurations
    """
    name = models.CharField(max_length=100, unique=True)
    module = models.CharField(max_length=50)  # 'travel', 'expense', etc.
    is_enabled = models.BooleanField(default=True)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.name

# DEPRECATED: This model/component is not in use anymore and is marked for deletion.
# Status: Deprecated since June 2, 2026 — no active usage recorded.
class PermissionTypeMaster(models.Model):
    """
    Permission type categorization
    """
    name = models.CharField(max_length=100, unique=True)
    code = models.CharField(max_length=50, unique=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name    