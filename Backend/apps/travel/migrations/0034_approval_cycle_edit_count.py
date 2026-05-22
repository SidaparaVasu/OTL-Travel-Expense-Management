from django.db import migrations, models


def backfill_edit_count_zero(apps, schema_editor):
    """Existing submitted TRs stay at edit_count=0 (first submission, not an edit)."""
    TravelApplication = apps.get_model("travel", "TravelApplication")
    TravelApprovalFlow = apps.get_model("travel", "TravelApprovalFlow")

    TravelApplication.objects.filter(submitted_at__isnull=False, edit_count__gt=0).update(
        edit_count=0
    )
    TravelApprovalFlow.objects.all().update(edit_count=0)


class Migration(migrations.Migration):

    dependencies = [
        (
            "travel",
            "0033_rename_travel_book_booking_6a8f1d_idx_travel_book_booking_fce7ed_idx_and_more",
        ),
    ]

    operations = [
        migrations.AddField(
            model_name="travelapplication",
            name="edit_count",
            field=models.PositiveIntegerField(
                default=0,
                help_text="Modification count; 0 = original submission. Incremented on resubmit after critical edit.",
            ),
        ),
        migrations.AddField(
            model_name="travelapprovalflow",
            name="edit_count",
            field=models.PositiveIntegerField(
                default=0,
                help_text="Application version this step applies to (matches TravelApplication.edit_count).",
            ),
        ),
        migrations.AlterUniqueTogether(
            name="travelapprovalflow",
            unique_together={("travel_application", "approver", "approval_level")},
        ),
        migrations.AlterModelOptions(
            name="travelapprovalflow",
            options={"ordering": ["sequence"]},
        ),
        migrations.AddIndex(
            model_name="travelapprovalflow",
            index=models.Index(
                fields=["travel_application", "edit_count"],
                name="travel_trav_travel_edit_idx",
            ),
        ),
        migrations.RunPython(backfill_edit_count_zero, migrations.RunPython.noop),
    ]
