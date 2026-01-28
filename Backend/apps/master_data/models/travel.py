from django.db import models
from django.core.validators import MinValueValidator


class MealPreferenceMaster(models.Model):
    """
    Master table for Meal Preferences.
    defined modes: 0=Ticketing, 1=Accommodation
    """
    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=100)
    
    # Stores which modes this meal is available for.
    allowed_modes = models.JSONField(default=list) 
    
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name

class GLCodeMaster(models.Model):
    """
    General Ledger codes for travel expenses
    """
    vertical_name = models.CharField(max_length=100)
    description = models.TextField(null=True, blank=True)
    short_description = models.CharField(max_length=100, null=True, blank=True)
    sorting_no = models.PositiveIntegerField(null=True, blank=True)
    gl_code = models.CharField(max_length=20, unique=True)
    is_active = models.BooleanField(default=True)
    
    def __str__(self):
        return f"{self.gl_code} - {self.vertical_name} ({self.short_description})"

class TravelModeMaster(models.Model):
    """
    High-level travel categories: Flight, Train, Car, Accommodation
    """
    name = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name

class TravelSubOptionMaster(models.Model):
    """
    Sub-options per mode (e.g., Flight: Economy/Business, Train: AC/Non-AC)
    """
    mode = models.ForeignKey(TravelModeMaster, on_delete=models.CASCADE, related_name="sub_options")
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ('mode', 'name')

    def __str__(self):
        return f"{self.mode.name} - {self.name}"

class GradeEntitlementMaster(models.Model):
    """
    Grade-wise travel entitlements with city category considerations
    """
    grade = models.ForeignKey('GradeMaster', on_delete=models.CASCADE)
    sub_option = models.ForeignKey(TravelSubOptionMaster, on_delete=models.CASCADE)
    city_category = models.ForeignKey('CityCategoriesMaster', on_delete=models.SET_NULL, null=True, blank=True)
    max_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    is_allowed = models.BooleanField(default=True)

    class Meta:
        unique_together = ('grade', 'sub_option', 'city_category')

    def __str__(self):
        city = self.city_category.name if self.city_category else "All Cities"
        return f"{self.grade.name} - {self.sub_option.name} ({city})"
    

class VehicleCategoryMaster(models.Model):
    """
    Dynamic vehicle categories instead of static choices.
    """
    code = models.CharField(max_length=30, unique=True)
    name = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # db_table = "vehicle_category_master"
        verbose_name = "Vehicle Category Master"
        verbose_name_plural = "Vehicle Category Master"
        indexes = [
            models.Index(fields=["code"]),
            models.Index(fields=["is_active"]),
        ]

    def __str__(self):
        return self.name

class VehicleTypeMaster(models.Model):
    """
    Types of vehicles available for booking
    """
    name = models.CharField(max_length=100)
    category = models.ForeignKey(
        VehicleCategoryMaster,
        on_delete=models.PROTECT,
        related_name="vehicle_types"
    )
    capacity = models.IntegerField(validators=[MinValueValidator(1)])
    
    rate_per_km = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    rate_per_day = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    minimum_charge = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        # db_table = "vehicle_type_master"
        verbose_name = "Vehicle Type Master"
        verbose_name_plural = "Vehicle Type Master"
        indexes = [
            models.Index(fields=["name"]),
            models.Index(fields=["category"]),
            models.Index(fields=["capacity"]),
            models.Index(fields=["is_active"]),
        ]
        constraints = [
            models.UniqueConstraint(fields=["name", "category", "capacity"], name="uniq_vehicle_type_name_cat_cap_travel")
        ]

    def __str__(self):
        return f"{self.name} ({self.category.name}) - {self.capacity} seater"

class TravelPolicyMaster(models.Model):
    """
    Travel policy rules and restrictions
    """
    POLICY_TYPE_CHOICES = [
        ('advance_booking', 'Advance Booking Requirements'),
        ('amount_limit', 'Amount Restrictions'),
        ('distance_limit', 'Distance Restrictions'),
        ('duration_limit', 'Duration Restrictions'),
        ('mode_restriction', 'Travel Mode Restrictions'),
    ]
    
    policy_type = models.CharField(max_length=30, choices=POLICY_TYPE_CHOICES)
    title = models.CharField(max_length=200)
    description = models.TextField()
    
    # Applicable conditions
    travel_mode = models.ForeignKey('TravelModeMaster', on_delete=models.CASCADE, null=True, blank=True)
    employee_grade = models.ForeignKey('GradeMaster', on_delete=models.CASCADE, null=True, blank=True)
    
    # Rule parameters (stored as JSON for flexibility)
    rule_parameters = models.JSONField(default=dict)
    # Example: {"days": 7} for flight advance booking
    # Example: {"max_amount": 10000} for amount limits
    # Example: {"max_distance": 150} for own car restrictions
    
    is_active = models.BooleanField(default=True)
    effective_from = models.DateField()
    effective_to = models.DateField(null=True, blank=True)
    
    class Meta:
        ordering = ['policy_type', 'title']
        indexes = [
            models.Index(fields=['policy_type', 'is_active']),
            models.Index(fields=['effective_from', 'effective_to']),
        ]
    
    def __str__(self):
        return f"{self.get_policy_type_display()}: {self.title}"
    
    def is_currently_effective(self):
        """Check if policy is currently in effect"""
        from django.utils import timezone
        today = timezone.now().date()
        
        if not self.is_active:
            return False
            
        if today < self.effective_from:
            return False
            
        if self.effective_to and today > self.effective_to:
            return False
            
        return True