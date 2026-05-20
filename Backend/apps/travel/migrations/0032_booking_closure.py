from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('travel', '0031_add_bulk_booking_file_to_booking'),
    ]

    operations = [
        migrations.AddField(
            model_name='booking',
            name='allow_claim',
            field=models.BooleanField(blank=True, help_text='Current claim eligibility for this booking when status is closed.', null=True),
        ),
        migrations.AddField(
            model_name='booking',
            name='closed_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='booking',
            name='closed_by',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='closed_bookings', to=settings.AUTH_USER_MODEL),
        ),
        migrations.CreateModel(
            name='BookingClosureLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('action', models.CharField(choices=[('closed', 'Closed'), ('claim_allowed', 'Claim Allowed'), ('claim_disallowed', 'Claim Disallowed')], max_length=30)),
                ('closure_reason', models.TextField(blank=True, default='')),
                ('claim_decision_reason', models.TextField()),
                ('allow_claim', models.BooleanField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('booking', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='closure_logs', to='travel.booking')),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='booking_closure_logs', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['created_at'],
                'indexes': [models.Index(fields=['booking', 'created_at'], name='travel_book_booking_6a8f1d_idx')],
            },
        ),
    ]
