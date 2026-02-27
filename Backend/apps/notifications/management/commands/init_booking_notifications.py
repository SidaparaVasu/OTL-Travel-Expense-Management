import os
from django.core.management.base import BaseCommand
from apps.notifications.models import EmailTemplateMaster, NotificationRule
from django.conf import settings

class Command(BaseCommand):
    help = 'Initialize booking acceptance and rejection notifications'

    def handle(self, *args, **options):
        templates_dir = os.path.join(settings.BASE_DIR, 'apps', 'notifications', 'email_templates')
        
        # 1. Booking Accepted Template
        acc_path = os.path.join(templates_dir, 'booking_accepted.html')
        with open(acc_path, 'r', encoding='utf-8') as f:
            acc_html = f.read()
        
        acc_tmpl, _ = EmailTemplateMaster.objects.update_or_create(
            template_key='travel.booking.accepted',
            defaults={
                'template_name': 'Booking Accepted Email',
                'subject': 'Booking Request Accepted - {{ request_id }}',
                'body_html': acc_html,
                'is_active': True,
            }
        )
        self.stdout.write(self.style.SUCCESS(f'Template {acc_tmpl.template_key} created/updated.'))

        # 2. Booking Rejected Template
        rej_path = os.path.join(templates_dir, 'booking_rejected.html')
        with open(rej_path, 'r', encoding='utf-8') as f:
            rej_html = f.read()
        
        rej_tmpl, _ = EmailTemplateMaster.objects.update_or_create(
            template_key='travel.booking.rejected',
            defaults={
                'template_name': 'Booking Rejected Email',
                'subject': 'Booking Request Rejected - {{ request_id }}',
                'body_html': rej_html,
                'is_active': True,
            }
        )
        self.stdout.write(self.style.SUCCESS(f'Template {rej_tmpl.template_key} created/updated.'))

        # 3. Acceptance Rule
        NotificationRule.objects.update_or_create(
            event_name='travel.booking.accepted',
            defaults={
                'description': 'Notify employee and travel desk when agent accepts booking',
                'template': acc_tmpl,
                'channels': ['email', 'in_app'],
                'recipient_resolver': 'employee_and_desk',
                'is_active': True,
                'send_reminder': False,
            }
        )
        self.stdout.write(self.style.SUCCESS('Notification rule travel.booking.accepted created/updated.'))

        # 4. Rejection Rule
        NotificationRule.objects.update_or_create(
            event_name='travel.booking.rejected',
            defaults={
                'description': 'Notify travel desk when agent rejects booking',
                'template': rej_tmpl,
                'channels': ['email', 'in_app'],
                'recipient_resolver': 'travel_desk',
                'is_active': True,
                'send_reminder': False,
            }
        )
        self.stdout.write(self.style.SUCCESS('Notification rule travel.booking.rejected created/updated.'))
