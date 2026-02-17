from django.db import models
from apps.master_data.models.geography import LocationMaster
from apps.authentication.models import User
from apps.authentication.models.roles import Role

class LocationSPOCAssignment(models.Model):
    """
    Assigns a User to a specific Role for one or more Branch Locations.
    Used for routing requests (Travel Applications, etc.) to the correct SPOC.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='spoc_assignments')
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name='spoc_assignments')
    
    # Many-to-Many relationship for branch locations.
    # Blank=True allows for Global roles (no specific location attached).
    locations = models.ManyToManyField(LocationMaster, blank=True, related_name='spoc_assignments')
    
    is_global = models.BooleanField(default=False)

    is_active = models.BooleanField(default=True)
    assigned_by = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='spoc_assignments_made'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Location SPOC Assignment'
        verbose_name_plural = 'Location SPOC Assignments'
        # Ensure a user can only have ONE assignment entry per Role.
        # They can map multiple locations within this single entry.
        unique_together = ('user', 'role')
        indexes = [
            models.Index(fields=['role', 'is_active']),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.role.name}"
