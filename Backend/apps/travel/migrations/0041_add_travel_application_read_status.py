import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('master_data', '0001_initial'),
        ('travel', '0040_hrmsleaverecord'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='TravelApplicationReadStatus',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('scope', models.CharField(choices=[('user', 'User'), ('location', 'Location')], max_length=10)),
                ('is_read', models.BooleanField(default=False)),
                ('read_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('travel_application', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='read_statuses',
                    to='travel.travelapplication',
                )),
                ('user', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='travel_application_read_statuses',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('location', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='travel_application_read_statuses',
                    to='master_data.locationmaster',
                )),
                ('marked_by', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='read_status_changes',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name': 'Travel Application Read Status',
                'verbose_name_plural': 'Travel Application Read Statuses',
            },
        ),
        migrations.AddIndex(
            model_name='travelapplicationreadstatus',
            index=models.Index(fields=['scope', 'is_read'], name='travel_trav_scope_is_re_idx'),
        ),
    ]
