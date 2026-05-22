from django.db import migrations, models


def backfill_booking_is_approved(apps, schema_editor):
    Booking = apps.get_model("travel", "Booking")
    TravelApplication = apps.get_model("travel", "TravelApplication")
    post_approval = {
        "pending_travel_desk",
        "booking_in_progress",
        "booked",
        "completed",
    }
    app_ids = TravelApplication.objects.filter(
        status__in=post_approval,
    ).values_list("id", flat=True)
    if app_ids:
        Booking.objects.filter(
            trip_details__travel_application_id__in=app_ids,
        ).update(is_approved=True)


class Migration(migrations.Migration):

    dependencies = [
        ("travel", "0038_rename_travel_trav_travel_a_hist_idx_travel_trav_travel__c8069c_idx_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="booking",
            name="is_approved",
            field=models.BooleanField(
                default=False,
                help_text=(
                    "True once the parent travel application has completed all approvals "
                    "for the current cycle; blocks applicant edit/delete until reset on resubmit."
                ),
            ),
        ),
        migrations.RunPython(backfill_booking_is_approved, migrations.RunPython.noop),
    ]
