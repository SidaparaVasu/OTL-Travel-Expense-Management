from django.db import models
from apps.master_data.models.travel import GLCodeMaster

class GradeMaster(models.Model):
    """
    Employee grade master data for travel entitlements
    """
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    # sorting_no = models.PositiveIntegerField(unique=True)
    sorting_no = models.PositiveIntegerField()
    glcode = models.ForeignKey(GLCodeMaster, on_delete=models.CASCADE, null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['sorting_no']

    def __str__(self):
        return self.name