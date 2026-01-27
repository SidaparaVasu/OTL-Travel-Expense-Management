from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone

class GuestHouseMaster(models.Model):
    """Enhanced Guest House model per requirements"""
    
    PROPERTY_TYPES = [
        ('guest_house', 'Guest House'),
        ('service_apartment', 'Service Apartment'),
        ('transit_lodge', 'Transit Lodge'),
    ]
    
    OWNERSHIP_TYPES = [
        ('company_owned', 'Company-owned'),
        ('leased', 'Leased'),
        ('third_party', 'Third-party'),
    ]
    
    BILLING_TYPES = [
        ('per_night', 'Per Night'),
        ('per_stay', 'Per Stay'),
        ('monthly', 'Monthly'),
    ]
    
    # Basic Information
    name = models.CharField(max_length=100)
    property_type = models.CharField(max_length=30, choices=PROPERTY_TYPES, null=True, blank=True)
    ownership_type = models.CharField(max_length=20, choices=OWNERSHIP_TYPES, null=True, blank=True)
    
    # Registration Details
    gstin = models.CharField(max_length=15, blank=True)
    registration_number = models.CharField(max_length=50, blank=True)
    vendor_code = models.CharField(max_length=50, blank=True)
    cost_center = models.CharField(max_length=50, blank=True)
    gl_code = models.ForeignKey('GLCodeMaster', on_delete=models.SET_NULL, null=True)
    
    # Billing
    rate_card = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    billing_type = models.CharField(max_length=20, choices=BILLING_TYPES, null=True, blank=True)
    
    # Location
    address = models.TextField()
    city = models.ForeignKey('CityMaster', on_delete=models.PROTECT, null=True, blank=True)
    district = models.CharField(max_length=100, blank=True)
    state = models.ForeignKey('StateMaster', on_delete=models.PROTECT, null=True, blank=True)
    country = models.ForeignKey('CountryMaster', on_delete=models.PROTECT, null=True, blank=True)
    pin_code = models.CharField(max_length=10, null=True, blank=True)
    
    # Contact Details
    contact_person = models.CharField(max_length=100)
    phone_number = models.CharField(max_length=15)
    email = models.EmailField(null=True, blank=True)
    manager = models.ForeignKey('authentication.User', on_delete=models.SET_NULL, null=True, related_name='managed_guest_houses')
    emergency_contact = models.CharField(max_length=100, blank=True)
    
    # Capacity
    total_rooms = models.PositiveIntegerField(null=True, blank=True)
    room_types = models.JSONField(default=list)
    max_occupancy = models.PositiveIntegerField(null=True, blank=True)
    
    # Amenities
    amenities = models.JSONField(default=dict)
    
    # Timings
    check_in_time = models.TimeField(null=True, blank=True)
    check_out_time = models.TimeField(null=True, blank=True)
    booking_window_days = models.PositiveIntegerField(default=30)
    
    # Audit
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey('authentication.User', on_delete=models.SET_NULL, null=True, related_name='created_guest_houses')
    updated_by = models.ForeignKey('authentication.User', on_delete=models.SET_NULL, null=True, related_name='updated_guest_houses')
    is_active = models.BooleanField(default=True)
    
    class Meta:
        ordering = ['city', 'name']
        indexes = [
            models.Index(fields=['city', 'is_active']),
            models.Index(fields=['state', 'city']),
        ]
    
    def __str__(self):
        return f"{self.name} - {self.city.city_name}"
    
    def get_availability_status(self, check_in_date, check_out_date):
        """Check room availability for given dates"""
        # Implementation with booking integration
        return True

# Annual Rate Contract Hotels
class ARCHotelMaster(models.Model):
    """Enhanced ARC Hotel model per requirements"""
    
    HOTEL_TYPES = [
        ('resort', 'Resort'),
        ('business', 'Business'),
        ('boutique', 'Boutique'),
    ]
    
    STAR_RATINGS = [(i, f'{i} Star') for i in range(1, 8)]
    
    # Basic Information
    name = models.CharField(max_length=100)
    hotel_type = models.CharField(max_length=20, choices=HOTEL_TYPES, null=True, blank=True)
    star_rating = models.PositiveIntegerField(
        choices=STAR_RATINGS, 
        validators=[MinValueValidator(1), MaxValueValidator(7)], 
        null=True, blank=True
    )
    group_name = models.CharField(max_length=100, blank=True)
    
    # Registration
    gstin = models.CharField(max_length=15, null=True, blank=True)
    pan = models.CharField(max_length=10, null=True, blank=True)
    operating_since = models.PositiveIntegerField(null=True, blank=True) # Year, e.g. 1965
    
    # Location
    address = models.TextField()
    city = models.ForeignKey('CityMaster', on_delete=models.PROTECT, null=True, blank=True)
    state = models.ForeignKey('StateMaster', on_delete=models.PROTECT, null=True, blank=True)
    country = models.ForeignKey('CountryMaster', on_delete=models.PROTECT, null=True, blank=True)
    postal_code = models.CharField(max_length=10, null=True, blank=True)
    
    # Contact
    phone_number = models.CharField(max_length=15)
    email = models.EmailField(null=True, blank=True)
    website = models.URLField(blank=True)
    social_media = models.JSONField(default=dict, blank=True)
    
    # Capacity
    total_rooms = models.PositiveIntegerField(null=True, blank=True)
    room_types = models.JSONField(default=list, blank=True)
    check_in_time = models.TimeField(null=True, blank=True)
    check_out_time = models.TimeField(null=True, blank=True)
    
    # Facilities
    facilities = models.JSONField(default=dict, blank=True)
    
    # Rate Information (RESTORED)
    rate_per_night = models.DecimalField(max_digits=8, decimal_places=2)
    tax_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=12.00)
    
    # Contract Details (RESTORED)
    contract_start_date = models.DateField()
    contract_end_date = models.DateField()
    
    # Category for compatibility (ADDED)
    CATEGORY_CHOICES = [
        ('3_star', '3 Star'),
        ('4_star', '4 Star'),
        ('5_star', '5 Star'),
        ('budget', 'Budget'),
        ('deluxe', 'Deluxe'),
    ]
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    
    # Audit
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey('authentication.User', on_delete=models.SET_NULL, null=True, related_name='created_hotels')
    updated_by = models.ForeignKey('authentication.User', on_delete=models.SET_NULL, null=True, related_name='updated_hotels')
    is_active = models.BooleanField(default=True)
    
    class Meta:
        ordering = ['city', 'category', 'rate_per_night']
        indexes = [
            models.Index(fields=['city', 'category', 'is_active']),
            models.Index(fields=['contract_start_date', 'contract_end_date']),
            models.Index(fields=['star_rating', 'hotel_type']),
        ]
    
    def __str__(self):
        return f"{self.name} ({self.category}) - {self.city}"
    
    def is_contract_valid(self):
        """Check if contract is currently valid"""
        today = timezone.now().date()
        return self.contract_start_date <= today <= self.contract_end_date
    
    def get_total_rate_with_tax(self):
        """Calculate total rate including tax"""
        tax_amount = (self.rate_per_night * self.tax_percentage) / 100
        return self.rate_per_night + tax_amount


class LocationSPOC(models.Model):
    """
    Location-wise Single Point of Contact for vehicle bookings
    """
    SPOC_TYPE_CHOICES = [
        ('local', 'Local Transport'),
        ('inter_unit', 'Inter-Unit Transport'),
        ('both', 'Both Local & Inter-Unit'),
    ]
    
    location = models.ForeignKey('LocationMaster', on_delete=models.CASCADE)
    spoc_user = models.ForeignKey('authentication.User', on_delete=models.CASCADE)
    spoc_type = models.CharField(max_length=20, choices=SPOC_TYPE_CHOICES)
    phone_number = models.CharField(max_length=15)
    email = models.EmailField()
    backup_spoc = models.ForeignKey(
        'authentication.User', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='backup_spoc_locations'
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ('location', 'spoc_type')
        indexes = [
            models.Index(fields=['location', 'spoc_type', 'is_active']),
        ]
    
    def __str__(self):
        return f"{self.location.location_name} - {self.spoc_user.username} ({self.spoc_type})"