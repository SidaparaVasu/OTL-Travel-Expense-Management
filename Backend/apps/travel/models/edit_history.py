from django.db import models


class TravelApplicationEditHistory(models.Model):
    """
    Applicant-provided reason for each modification of a submitted travel application.
    edit_count: 0 = first submission context; 1+ = modification cycles after resubmit.
    """

    travel_application = models.ForeignKey(
        "travel.TravelApplication",
        on_delete=models.CASCADE,
        related_name="edit_history",
    )
    edit_count = models.PositiveIntegerField(
        help_text="Modification version this edit applies to (matches TR suffix when > 0).",
    )
    reason = models.TextField(help_text="Applicant's reason for modifying the application.")
    edited_by = models.ForeignKey(
        "authentication.User",
        on_delete=models.SET_NULL,
        null=True,
        related_name="travel_application_edits",
    )
    needs_reapproval = models.BooleanField(default=False)
    system_change_summary = models.TextField(
        blank=True,
        default="",
        help_text="Auto-detected critical changes from the system (if any).",
    )
    previous_status = models.CharField(max_length=30, blank=True, default="")
    status_after_update = models.CharField(max_length=30, blank=True, default="")
    submitted_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the applicant completed resubmit after this edit (if applicable).",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["travel_application", "-created_at"]),
            models.Index(fields=["travel_application", "edit_count"]),
        ]

    def __str__(self):
        return (
            f"{self.travel_application_id} edit#{self.edit_count} "
            f"by {self.edited_by_id} at {self.created_at}"
        )
