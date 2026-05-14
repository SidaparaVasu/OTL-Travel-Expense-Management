from django.core.management.base import BaseCommand
from django_celery_beat.models import PeriodicTask, CrontabSchedule, IntervalSchedule
import json

class Command(BaseCommand):
    help = 'Register periodic tasks for notifications and settlement expiry'

    def handle(self, *args, **options):
        # 1. Settlement Expiry Check (Daily at 00:05)
        daily_schedule, _ = CrontabSchedule.objects.get_or_create(
            minute='5',
            hour='0',
            day_of_week='*',
            day_of_month='*',
            month_of_year='*',
            timezone='Asia/Kolkata'
        )

        expired_task, created = PeriodicTask.objects.get_or_create(
            name='Daily Settlement Expiry Check',
            defaults={
                'task': 'apps.notifications.tasks.check_for_expired_settlements',
                'crontab': daily_schedule,
                'queue': 'notifications',
                'args': json.dumps([]),
            }
        )
        if not created:
            expired_task.crontab = daily_schedule
            expired_task.save()
        self.stdout.write(self.style.SUCCESS(f'Task "Daily Settlement Expiry Check" {"created" if created else "updated"}.'))

        # 2. Reminder Worker (Every 15 minutes)
        interval_schedule, _ = IntervalSchedule.objects.get_or_create(
            every=15,
            period=IntervalSchedule.MINUTES,
        )

        reminder_task, created = PeriodicTask.objects.get_or_create(
            name='Notification Reminder Worker',
            defaults={
                'task': 'apps.notifications.tasks.notification_reminder_worker',
                'interval': interval_schedule,
                'queue': 'notifications',
                'args': json.dumps([]),
            }
        )
        if not created:
            reminder_task.interval = interval_schedule
            reminder_task.save()
        self.stdout.write(self.style.SUCCESS(f'Task "Notification Reminder Worker" {"created" if created else "updated"}.'))

        # 3. Auto-Skip Expired Approvals (Daily at 00:10 IST)
        # Runs after settlement expiry check (00:05) so notifications fire first.
        skip_schedule, _ = CrontabSchedule.objects.get_or_create(
            minute='10',
            hour='0',
            day_of_week='*',
            day_of_month='*',
            month_of_year='*',
            timezone='Asia/Kolkata'
        )

        skip_task, created = PeriodicTask.objects.get_or_create(
            name='Daily Auto-Skip Expired Approvals',
            defaults={
                'task': 'apps.notifications.tasks.auto_skip_expired_approvals',
                'crontab': skip_schedule,
                'queue': 'notifications',
                'args': json.dumps([]),
            }
        )
        if not created:
            skip_task.crontab = skip_schedule
            skip_task.save()
        self.stdout.write(self.style.SUCCESS(f'Task "Daily Auto-Skip Expired Approvals" {"created" if created else "updated"}.'))

        self.stdout.write(self.style.SUCCESS('All periodic tasks registered successfully.'))
