import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('travel', '0039_booking_is_approved'),
    ]

    operations = [
        migrations.CreateModel(
            name='HRMSLeaveRecord',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('leave_approval_id', models.BigIntegerField(blank=True, help_text='Approval ID returned by HRMS OdLeaveApprove API', null=True)),
                ('from_date', models.DateField()),
                ('to_date', models.DateField()),
                ('leave_period', models.PositiveIntegerField(help_text='Total number of leave days')),
                ('status', models.CharField(choices=[('ACTIVE', 'Active'), ('DELETED', 'Deleted'), ('FAILED', 'Failed')], default='ACTIVE', max_length=20)),
                ('request_payload', models.JSONField(blank=True, null=True)),
                ('response_payload', models.JSONField(blank=True, null=True)),
                ('error_message', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('travel_application', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='hrms_leave_records', to='travel.travelapplication')),
            ],
            options={
                'db_table': 'travel_hrms_leave_records',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='hrmsleaverecord',
            index=models.Index(fields=['travel_application', 'status'], name='travel_hrms_travel__c657be_idx'),
        ),
        migrations.AddIndex(
            model_name='hrmsleaverecord',
            index=models.Index(fields=['leave_approval_id'], name='travel_hrms_leave_a_1a7b8e_idx'),
        ),
    ]
