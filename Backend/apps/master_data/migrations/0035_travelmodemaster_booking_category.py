from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('master_data', '0034_travelmodemaster_is_self_arranged_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='travelmodemaster',
            name='booking_category',
            field=models.CharField(
                choices=[
                    ('ticketing',     'Ticketing'),
                    ('accommodation', 'Accommodation'),
                    ('conveyance',    'Conveyance'),
                    ('bulk',          'Bulk Booking'),
                ],
                default='conveyance',
                max_length=20,
                help_text=(
                    'Logical category this travel mode belongs to. '
                    'ticketing = Flight/Train; accommodation = all stay types; '
                    'conveyance = all vehicle/transport modes; bulk = legacy bulk-upload.'
                ),
            ),
        ),
    ]
