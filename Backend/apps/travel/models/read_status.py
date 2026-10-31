from django.db import models


class TravelApplicationReadStatus(models.Model):
    """
    Per-(travel desk user, travel application) read/unread flag.

    Travel Desk users share the application queue, so read state is tracked
    per user rather than on the application itself.

    - A row with is_read=True  -> the user has marked the application read.
    - A row with is_read=False -> the user explicitly marked it unread.
    - No row at all            -> treated as unread (default).
    """

    travel_application = models.ForeignKey(
        'TravelApplication',
        on_delete=models.CASCADE,
        related_name='read_statuses',
    )
    user = models.ForeignKey(
        'authentication.User',
        on_delete=models.CASCADE,
        related_name='travel_application_read_statuses',
    )
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Travel Application Read Status'
        verbose_name_plural = 'Travel Application Read Statuses'
        unique_together = ('travel_application', 'user')
        indexes = [
            models.Index(fields=['user', 'is_read']),
        ]

    def __str__(self):
        state = 'Read' if self.is_read else 'Unread'
        return f"{self.user.username} - Application {self.travel_application_id} - {state}"
