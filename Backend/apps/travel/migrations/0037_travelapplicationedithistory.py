import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("travel", "0036_alter_auditlog_action_and_more"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="TravelApplicationEditHistory",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "edit_count",
                    models.PositiveIntegerField(
                        help_text="Modification version this edit applies to (matches TR suffix when > 0).",
                    ),
                ),
                (
                    "reason",
                    models.TextField(help_text="Applicant's reason for modifying the application."),
                ),
                ("needs_reapproval", models.BooleanField(default=False)),
                (
                    "system_change_summary",
                    models.TextField(
                        blank=True,
                        default="",
                        help_text="Auto-detected critical changes from the system (if any).",
                    ),
                ),
                ("previous_status", models.CharField(blank=True, default="", max_length=30)),
                ("status_after_update", models.CharField(blank=True, default="", max_length=30)),
                (
                    "submitted_at",
                    models.DateTimeField(
                        blank=True,
                        help_text="When the applicant completed resubmit after this edit (if applicable).",
                        null=True,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "edited_by",
                    models.ForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="travel_application_edits",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "travel_application",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="edit_history",
                        to="travel.travelapplication",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
                "indexes": [
                    models.Index(
                        fields=["travel_application", "-created_at"],
                        name="travel_trav_travel_a_hist_idx",
                    ),
                    models.Index(
                        fields=["travel_application", "edit_count"],
                        name="travel_trav_travel_a_ec_idx",
                    ),
                ],
            },
        ),
    ]
