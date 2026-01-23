from django.db import models
from django.conf import settings
from apps.master_data.models import CompanyInformation

class GuestProfile(models.Model):
    """
    Profile for non-organizational travelers (guests).
    """
    NATIONALITY_TYPE_CHOICES = [
        ('indian', 'Indian'),
        ('foreign', 'Foreign'),
    ]

    GENDER_CHOICES = [
        ('M', 'Male'),
        ('F', 'Female'),
        ('O', 'Other'),
    ]

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="created_guests"
    )
    
    company = models.ForeignKey(
        CompanyInformation,
        on_delete=models.CASCADE,
        related_name="guest_profiles"
    )

    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    email = models.EmailField(blank=True)
    
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES)
    age = models.PositiveIntegerField(null=True, blank=True)
    
    contact_number = models.CharField(max_length=20, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    
    nationality_type = models.CharField(
        max_length=20, 
        choices=NATIONALITY_TYPE_CHOICES,
        default='indian'
    )

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "guest_profiles"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["created_by"]),
            models.Index(fields=["company"]),
            models.Index(fields=["email"]),
        ]

    def __str__(self):
        return f"{self.first_name} {self.last_name} (Guest)"


class ApplicationTraveler(models.Model):
    """
    Links a specific traveler (Self or Guest) to a Travel Application.
    One application can have multiple travelers.
    """
    travel_application = models.ForeignKey(
        'travel.TravelApplication',
        on_delete=models.CASCADE,
        related_name="display_travelers"
    )

    # If traveler is the internal user (Self)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="travel_participations"
    )

    # If traveler is a guest
    guest = models.ForeignKey(
        GuestProfile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="travel_participations"
    )

    is_primary = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "application_travelers"
        unique_together = [
            ('travel_application', 'user'),
            ('travel_application', 'guest')
        ] 
        # Note: multiple guests might be allowed, but unique guest profile per app prevents duplicates.
        # If user adds same guest twice, it should be blocked.

    def __str__(self):
        if self.user:
            return f"User: {self.user.get_full_name()}"
        if self.guest:
            return f"Guest: {self.guest.first_name} {self.guest.last_name}"
        return "Unknown Traveler"
