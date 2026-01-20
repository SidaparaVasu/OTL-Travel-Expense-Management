from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator

from apps.authentication.models import BookingAgentProfile
from apps.master_data.models import VehicleCategoryMaster, VehicleTypeMaster, CityMaster

# ============================================================
# 1) MASTER TABLES (Dynamic)
# ============================================================
class ProfileTypeMaster(models.Model):
    """
    Dynamic profile types for booking agents/vendors.

    Examples:
    - flight_agent
    - train_agent
    - flight_train_agent
    - hotel_agent
    - vehicle_agent
    """
    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "profile_type_master"
        verbose_name = "Profile Type Master"
        verbose_name_plural = "Profile Type Master"
        indexes = [
            models.Index(fields=["code"]),
            models.Index(fields=["is_active"]),
        ]

    def __str__(self):
        return self.name


class ServiceCategoryMaster(models.Model):
    """
    Dynamic service categories.

    Examples:
    - flight_booking
    - train_booking
    - guest_house_booking
    - arc_hotel_booking
    - vehicle_booking
    """
    BOOKING_GROUP_CHOICES = [
        ("ticket", "Ticket"),
        ("accommodation", "Accommodation"),
        ("conveyance", "Conveyance"),
        ("other", "Other"),
    ]

    code = models.CharField(max_length=60, unique=True)
    name = models.CharField(max_length=150)

    booking_group = models.CharField(
        max_length=20,
        choices=BOOKING_GROUP_CHOICES,
        default="other"
    )

    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "service_category_master"
        verbose_name = "Service Category Master"
        verbose_name_plural = "Service Category Master"
        indexes = [
            models.Index(fields=["code"]),
            models.Index(fields=["booking_group"]),
            models.Index(fields=["is_active"]),
        ]

    def __str__(self):
        return self.name


class ProfileTypeServiceMap(models.Model):
    """
    Mapping: Which profile type can provide which service categories.

    Example:
      flight_train_agent -> flight_booking + train_booking
      hotel_agent        -> guest_house_booking + arc_hotel_booking
    """
    profile_type = models.ForeignKey(
        ProfileTypeMaster,
        on_delete=models.CASCADE,
        related_name="service_mappings"
    )

    service_category = models.ForeignKey(
        ServiceCategoryMaster,
        on_delete=models.CASCADE,
        related_name="profile_mappings"
    )

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "profile_type_service_map"
        verbose_name = "Profile Type Service Map"
        verbose_name_plural = "Profile Type Service Maps"
        unique_together = ("profile_type", "service_category")
        indexes = [
            models.Index(fields=["profile_type"]),
            models.Index(fields=["service_category"]),
            models.Index(fields=["is_active"]),
        ]

    def __str__(self):
        return f"{self.profile_type.code} -> {self.service_category.code}"


# ============================================================
# 2) BOOKING AGENT SERVICE (Vendor provides multiple services)
# ============================================================
class BookingAgentService(models.Model):
    """
    A vendor can support multiple profile types/services.

    Example: Eastern Travel supports:
        - flight_train_agent
        - hotel_agent
        - vehicle_agent

    City serving logic:
        serves_all_cities=True  -> PAN India
        serves_all_cities=False -> service_cities must be specified
    """
    booking_agent_profile = models.ForeignKey(
        BookingAgentProfile,
        on_delete=models.CASCADE,
        related_name="services"
    )

    profile_type = models.ForeignKey(
        ProfileTypeMaster,
        on_delete=models.PROTECT,
        related_name="booking_agent_services"
    )

    serves_all_cities = models.BooleanField(default=False)

    service_cities = models.ManyToManyField(
        CityMaster,
        blank=True,
        related_name="booking_agent_services",
        help_text="Cities this service supports (if serves_all_cities is False)"
    )

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "booking_agent_services"
        verbose_name = "Booking Agent Service"
        verbose_name_plural = "Booking Agent Services"
        unique_together = ("booking_agent_profile", "profile_type")
        indexes = [
            models.Index(fields=["booking_agent_profile"]),
            models.Index(fields=["profile_type"]),
            models.Index(fields=["serves_all_cities"]),
            models.Index(fields=["is_active"]),
        ]

    def __str__(self):
        return f"{self.booking_agent_profile.organization_name} - {self.profile_type.code}"


class BookingAgentServiceCategory(models.Model):
    """
    Assign service categories to a BookingAgentService.

    Example:
      Eastern Travel - hotel_agent -> arc_hotel_booking + guest_house_booking
    """
    booking_agent_service = models.ForeignKey(
        BookingAgentService,
        on_delete=models.CASCADE,
        related_name="service_categories"
    )

    service_category = models.ForeignKey(
        ServiceCategoryMaster,
        on_delete=models.PROTECT,
        related_name="booking_agent_service_links"
    )

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "booking_agent_service_categories"
        verbose_name = "Booking Agent Service Category"
        verbose_name_plural = "Booking Agent Service Categories"
        unique_together = ("booking_agent_service", "service_category")
        indexes = [
            models.Index(fields=["booking_agent_service"]),
            models.Index(fields=["service_category"]),
            models.Index(fields=["is_active"]),
        ]

    def __str__(self):
        return f"{self.booking_agent_service_id} -> {self.service_category.code}"


# ============================================================
# 3) CONTACT MANAGEMENT (Primary/Secondary, scalable)
# ============================================================

class BookingAgentContact(models.Model):
    """
    Contacts are linked to a BookingAgentService (not the vendor),
    because different services can have different contacts.
    """
    ROLE_CHOICES = [
        ("PRIMARY", "Primary"),
        ("SECONDARY", "Secondary"),
        ("ESCALATION", "Escalation"),
        ("FINANCE", "Finance"),
        ("OTHER", "Other"),
    ]

    booking_agent_service = models.ForeignKey(
        BookingAgentService,
        on_delete=models.CASCADE,
        related_name="contacts"
    )

    name = models.CharField(max_length=120)
    email = models.EmailField()
    phone = models.CharField(max_length=20)

    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="OTHER")

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "booking_agent_contacts"
        verbose_name = "Booking Agent Contact"
        verbose_name_plural = "Booking Agent Contacts"
        indexes = [
            models.Index(fields=["booking_agent_service"]),
            models.Index(fields=["email"]),
            models.Index(fields=["phone"]),
            models.Index(fields=["role"]),
            models.Index(fields=["is_active"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.role})"



class BookingAgentVehicleTypeMap(models.Model):
    """
    Links a vehicle-booking agent service with allowed vehicle types.
    This controls dropdown options in booking agent portal while booking conveyance.
    """
    booking_agent_service = models.ForeignKey(
        BookingAgentService,
        on_delete=models.CASCADE,
        related_name="vehicle_types"
    )

    vehicle_type = models.ForeignKey(
        VehicleTypeMaster,
        on_delete=models.PROTECT,
        related_name="booking_agent_links"
    )

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "booking_agent_vehicle_type_map"
        verbose_name = "Booking Agent Vehicle Type Map"
        verbose_name_plural = "Booking Agent Vehicle Type Maps"
        unique_together = ("booking_agent_service", "vehicle_type")
        indexes = [
            models.Index(fields=["booking_agent_service"]),
            models.Index(fields=["vehicle_type"]),
            models.Index(fields=["is_active"]),
        ]

    def __str__(self):
        return f"{self.booking_agent_service_id} -> {self.vehicle_type.name}"


# ============================================================
# 4) ASSIGNMENT RULES (Auto-forwarding / Defaults)
# ============================================================

class BookingAgentAssignmentRule(models.Model):
    """
    Defines default agent assignment rules by service category + city.

    - If only 1 agent available -> auto forward
    - If multiple -> travel desk selects
    - City-specific rule can override PAN India rule
    """
    service_category = models.ForeignKey(
        ServiceCategoryMaster,
        on_delete=models.PROTECT,
        related_name="assignment_rules"
    )

    city = models.ForeignKey(
        CityMaster,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assignment_rules"
    )

    booking_agent_service = models.ForeignKey(
        BookingAgentService,
        on_delete=models.CASCADE,
        related_name="assignment_rules"
    )

    priority = models.PositiveIntegerField(default=1)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "booking_agent_assignment_rules"
        verbose_name = "Booking Agent Assignment Rule"
        verbose_name_plural = "Booking Agent Assignment Rules"
        indexes = [
            models.Index(fields=["service_category"]),
            models.Index(fields=["city"]),
            models.Index(fields=["booking_agent_service"]),
            models.Index(fields=["priority"]),
            models.Index(fields=["is_active"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["service_category", "city", "booking_agent_service"],
                name="uniq_assignment_rule_service_city_agent"
            )
        ]

    def __str__(self):
        city_label = self.city.city_name if self.city else "PAN India"
        return f"{self.service_category.code} -> {self.booking_agent_service_id} ({city_label})"
