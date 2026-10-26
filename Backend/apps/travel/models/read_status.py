from django.db import models
from django.conf import settings


class TravelApplicationReadStatus(models.Model):
    """
    Tracks read/unread state of a travel application per travel desk user.
    Enables travel desk users to flag applications for better visibility.
    """
    application = models.ForeignKey(
        'travel.TravelApplication',
        on_delete=models.CASCADE,
        related_name='read_statuses'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='travel_application_read_statuses'
    )
    is_read = models.BooleanField(default=True)
    read_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'travel_application_read_status'
        verbose_name = 'Travel Application Read Status'
        verbose_name_plural = 'Travel Application Read Statuses'
        unique_together = ('application', 'user')
        indexes = [
            models.Index(fields=['user', 'is_read']),
            models.Index(fields=['application', 'user']),
        ]

    def __str__(self):
        status = "Read" if self.is_read else "Unread"
        return f"Application #{self.application_id} - User {self.user.username} ({status})"
