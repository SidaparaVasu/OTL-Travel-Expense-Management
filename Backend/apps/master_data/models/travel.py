from django.db import models
from django.core.validators import MinValueValidator

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
    

class VehicleTypeMaster(models.Model):
    """
    Types of vehicles available for booking
    """
    VEHICLE_CATEGORY_CHOICES = [
        ('sedan', 'Sedan'),
        ('suv', 'SUV'),
        ('hatchback', 'Hatchback'),
        ('bus', 'Bus'),
        ('tempo', 'Tempo Traveller'),
    ]
    
    name = models.CharField(max_length=100)
    category = models.CharField(max_length=20, choices=VEHICLE_CATEGORY_CHOICES)
    capacity = models.IntegerField(validators=[MinValueValidator(1)])
    rate_per_km = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    rate_per_day = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    minimum_charge = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)
    
    def __str__(self):
        return f"{self.name} ({self.category}) - {self.capacity} seater"

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