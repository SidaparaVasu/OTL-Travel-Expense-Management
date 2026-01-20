from django.db import models
from django.conf import settings
from apps.master_data.models import CityMaster

class OrganizationalProfile(models.Model):
    """
    Profile for organizational users (company employees)
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='organizational_profile',
        primary_key=True
    )
    
    employee_id = models.CharField(max_length=50, unique=True, blank=True, null=True)
    employee_code = models.CharField(max_length=50, unique=True, blank=True, null=True, help_text="Alpha Emp Code from HRMS")
    
    # Organizational Relations
    company = models.ForeignKey(
        'master_data.CompanyInformation',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='employees'
    )
    department = models.ForeignKey(
        'master_data.DepartmentMaster',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='employees'
    )
    designation = models.ForeignKey(
        'master_data.DesignationMaster',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='employees'
    )
    employee_type = models.ForeignKey(
        'master_data.EmployeeTypeMaster',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='employees'
    )
    grade = models.ForeignKey(
        'master_data.GradeMaster',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='employees'
    )
    base_location = models.ForeignKey(
        'master_data.LocationMaster',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='employees'
    )
    
    # Reporting Structure - Keep simple FK to User
    reporting_manager = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='subordinates'
    )
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'organizational_profiles'
        verbose_name = 'Organizational Profile'
        verbose_name_plural = 'Organizational Profiles'
        indexes = [
            models.Index(fields=["employee_id"]),
            models.Index(fields=["company"]),
            models.Index(fields=["department"]),
        ]
    
    def __str__(self):
        return f"{self.employee_id or 'No ID'} - {self.user.get_full_name()}"
    
    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)

        # --- Grade Synchronization Patch ---
        # Ensure User.grade always mirrors OrganizationalProfile.grade
        if self.grade and getattr(self.user, "grade", None) != self.grade:
            self.user.grade = self.grade
            self.user.save(update_fields=["grade"])



# ============================================================
# 2) BOOKING AGENT PROFILE (Vendor base)
# ============================================================

class BookingAgentProfile(models.Model):
    """
    Booking Agent Vendor Profile (replaces ExternalProfile).
    One external vendor is represented by one user.
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="booking_agent_profile",
        primary_key=True
    )

    organization_name = models.CharField(max_length=200)
    address = models.TextField(blank=True)

    gst_number = models.CharField(max_length=15, blank=True)
    pan_number = models.CharField(max_length=10, blank=True)
    license_number = models.CharField(max_length=50, blank=True)

    is_verified = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Booking Agent Profile"
        verbose_name_plural = "Booking Agent Profiles"
        indexes = [
            models.Index(fields=["organization_name"]),
            models.Index(fields=["is_active"]),
            models.Index(fields=["is_verified"]),
        ]

    def __str__(self):
        return self.organization_name