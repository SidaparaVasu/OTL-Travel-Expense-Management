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



class BookingAgentProfile(models.Model):
    """
    Profile for booking agents and external service providers
    """
    PROFILE_TYPE_CHOICES = [
        ('booking_agent', 'Booking Agent'),
        ('hotel_vendor', 'Hotel Vendor'),
        ('transport_vendor', 'Transport Vendor'),
        ('airline_vendor', 'Airline Vendor'),
        ('consultant', 'Consultant'),
        ('other', 'Other'),
    ]
    
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='booking_agent_profile',
        primary_key=True
    )
    
    profile_type = models.CharField(
        max_length=50,
        choices=PROFILE_TYPE_CHOICES,
        default='other'
    )
    
    # Organization Details
    organization_name = models.CharField(max_length=200)
    contact_person = models.CharField(max_length=100)
    phone = models.CharField(max_length=20)
    email = models.EmailField()
    address = models.TextField(blank=True)
    
    # Service Information
    service_categories = models.JSONField(
        default=list,
        blank=True,
        help_text="List of service categories. Example: ['flight_booking', 'hotel_booking']"
    )

    serves_all_cities = models.BooleanField(
        default=False,
        help_text="If enabled, agent serves all cities"
    )
    
    service_cities = models.ManyToManyField(
        CityMaster,
        blank=True,
        related_name="booking_agents",
        help_text="Cities this booking agent serves"
    )
    
    # Business Details
    gst_number = models.CharField(max_length=15, blank=True)
    pan_number = models.CharField(max_length=10, blank=True)
    license_number = models.CharField(max_length=50, blank=True)
    
    # Status
    is_verified = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'external_profiles'
        verbose_name = 'Booking Agent Profile'
        verbose_name_plural = 'Booking Agent Profiles'
    
    def __str__(self):
        return f"{self.organization_name} ({self.get_profile_type_display()})"