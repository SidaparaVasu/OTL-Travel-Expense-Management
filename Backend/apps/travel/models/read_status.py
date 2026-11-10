from django.db import models


class TravelApplicationReadStatus(models.Model):
    """
    Tracks read/unread state for a travel application at two scopes:

    scope = 'user'     -> personal read state for one desk user
                         unique on (travel_application, user)
    scope = 'location' -> shared read state for all desk users at a location
                         unique on (travel_application, location)

    Both rows are written together when a user toggles the status.
    'marked_by' records who last changed a location-scoped row for audit.
    """

    SCOPE_USER = 'user'
    SCOPE_LOCATION = 'location'
    SCOPE_CHOICES = [
        (SCOPE_USER, 'User'),
        (SCOPE_LOCATION, 'Location'),
    ]

    travel_application = models.ForeignKey(
        'TravelApplication',
        on_delete=models.CASCADE,
        related_name='read_statuses',
    )
    scope = models.CharField(max_length=10, choices=SCOPE_CHOICES)

    # Populated when scope = 'user'
    user = models.ForeignKey(
        'authentication.User',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='travel_application_read_statuses',
    )

    # Populated when scope = 'location'
    location = models.ForeignKey(
        'master_data.LocationMaster',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='travel_application_read_statuses',
    )

    # Audit: who last changed this row (meaningful for location scope)
    marked_by = models.ForeignKey(
        'authentication.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='read_status_changes',
    )

    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Travel Application Read Status'
        verbose_name_plural = 'Travel Application Read Statuses'
        indexes = [
            models.Index(fields=['scope', 'is_read']),
        ]

    def __str__(self):
        state = 'Read' if self.is_read else 'Unread'
        if self.scope == self.SCOPE_USER:
            return f"[user] {self.user_id} - App {self.travel_application_id} - {state}"
        return f"[location] {self.location_id} - App {self.travel_application_id} - {state}"
