from django.db import models
from .company import CompanyInformation
    
class CityCategoriesMaster(models.Model):
    """
    City categories for DA/expense calculations (A, B, C)
    """
    # Example cateogaries
    CATEGORY_CHOICES = [
        ('A', 'Category A'),
        ('B', 'Category B'),
        ('C', 'Category C'),
    ]
    name = models.CharField(max_length=1, unique=True)
    description = models.TextField(blank=True)

    def __str__(self):
        return f"{self.name} - {self.description}"

# DEPRECATED: This model/component is not in use anymore and is marked for deletion.
# Status: Deprecated since June 2, 2026 — no active usage recorded.
class CityCategoryAssignment(models.Model):
    country_name = models.CharField(max_length=100)
    country_code = models.CharField(max_length=10, blank=True, null=True)
    state_name = models.CharField(max_length=100)
    state_code = models.CharField(max_length=10, blank=True, null=True)
    city_name = models.CharField(max_length=100)
    category = models.ForeignKey(CityCategoriesMaster, on_delete=models.CASCADE, related_name="city_category_assigment")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("country_name", "state_name", "city_name")
        ordering = ["country_name", "state_name", "city_name"]

    def __str__(self):
        return f"{self.city_name}, {self.state_name} ({self.country_name}) - {self.category}"
    
class CountryMaster(models.Model):
    """
    Country master data
    """
    country_name = models.CharField(max_length=100, unique=True)
    country_code = models.CharField(max_length=3, unique=True, blank=True)

    def __str__(self):
        return self.country_name

class StateMaster(models.Model):
    """
    State master data
    """
    state_name = models.CharField(max_length=100)
    state_code = models.CharField(max_length=3, blank=True)
    country = models.ForeignKey(CountryMaster, on_delete=models.CASCADE, related_name="states")

    class Meta:
        unique_together = ('state_name', 'country')

    def __str__(self):
        return f"{self.state_name}, {self.country.country_name}"

class CityMaster(models.Model):
    """
    City master data with category for expense calculations
    """
    city_name = models.CharField(max_length=100)
    city_code = models.CharField(max_length=10, blank=True)
    state = models.ForeignKey(StateMaster, on_delete=models.CASCADE, related_name="cities")
    category = models.ForeignKey(CityCategoriesMaster, on_delete=models.PROTECT, related_name="cities")

    class Meta:
        unique_together = ('city_name', 'state')

    def __str__(self):
        return f"{self.city_name}, {self.state.state_name}"

class LocationMaster(models.Model):
    """
    Office/Branch locations (Unit Location Master)
    """
    location_id = models.AutoField(primary_key=True)
    location_name = models.CharField(max_length=255)
    location_code = models.CharField(max_length=100, unique=True)
    company = models.ForeignKey(CompanyInformation, on_delete=models.CASCADE)
    city = models.ForeignKey(CityMaster, on_delete=models.CASCADE)
    state = models.ForeignKey(StateMaster, on_delete=models.CASCADE)
    country = models.ForeignKey(CountryMaster, on_delete=models.CASCADE)
    address = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ('location_name', 'company')

    def __str__(self):
        return f"{self.location_name} ({self.location_code})"