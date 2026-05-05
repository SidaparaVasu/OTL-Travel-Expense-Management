from django.db import migrations


def fix_settlement_expired_rule(apps, schema_editor):
    """
    Ensure the NotificationRule for travel.settlement.expired is configured
    as a one-shot notification: send_reminder=False, reminder_intervals=[].
    This prevents the reminder worker from re-firing it after the daily cron
    has already sent it once.
    """
    NotificationRule = apps.get_model('notifications', 'NotificationRule')
    NotificationRule.objects.filter(
        event_name='travel.settlement.expired'
    ).update(
        send_reminder=False,
        reminder_intervals=[]
    )


def reverse_fix(apps, schema_editor):
    # No meaningful reverse — leave the rule as-is
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('notifications', '0003_load_cancellation_notification_data'),
    ]

    operations = [
        migrations.RunPython(fix_settlement_expired_rule, reverse_fix),
    ]
