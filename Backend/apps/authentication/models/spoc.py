from django.db import models
from apps.master_data.models.geography import LocationMaster
from apps.authentication.models import User

class LocationSPOCAssigner(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='spoc_assigner')
    role = models.ForeignKey('master_data.RoleMaster', on_delete=models.CASCADE)
    unit_location = models.ForeignKey(LocationMaster, on_delete=models.CASCADE)
    assigned_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='spoc_assigner_by')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Location SPOC Assigner'
        verbose_name_plural = 'Location SPOC Assigners'

    def __str__(self):
        return f"{self.unit_location.name} - {self.user.name}"