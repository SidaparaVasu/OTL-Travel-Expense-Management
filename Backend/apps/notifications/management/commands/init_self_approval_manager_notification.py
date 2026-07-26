import os
from django.core.management.base import BaseCommand
from apps.notifications.models import EmailTemplateMaster, NotificationRule
from django.conf import settings


class Command(BaseCommand):
    help = 'Initialize the self-approved travel request manager intimation notification'

    def handle(self, *args, **options):
        templates_dir = os.path.join(settings.BASE_DIR, 'apps', 'notifications', 'email_templates')

        # 1. Load HTML template from file
        tmpl_path = os.path.join(templates_dir, 'travel_self_approved_manager.html')
        with open(tmpl_path, 'r', encoding='utf-8') as f:
            tmpl_html = f.read()

        # 2. Create / update EmailTemplateMaster
        tmpl, created = EmailTemplateMaster.objects.update_or_create(
            template_key='travel.self_approved.manager_intimation',
            defaults={
                'template_name': 'Self-Approved TR — Reporting Manager Intimation',
                'subject': 'FYI: Travel Request {{ request_id }} Auto-Approved for {{ employee_name }}',
                'body_html': tmpl_html,
                'is_active': True,
            }
        )
        action = 'Created' if created else 'Updated'
        self.stdout.write(self.style.SUCCESS(f'{action} EmailTemplateMaster: {tmpl.template_key}'))

        # 3. Create / update NotificationRule
        #    recipient_resolver = 'reporting_manager' — resolved at dispatch time via payload['manager_id']
        rule, created = NotificationRule.objects.update_or_create(
            event_name='travel.self_approved.manager_intimation',
            defaults={
                'description': (
                    'Notify the reporting manager (FYI) when a team member\'s travel request '
                    'is automatically self-approved without requiring higher-level approval.'
                ),
                'template': tmpl,
                'channels': ['email'],
                'recipient_resolver': 'reporting_manager',
                'is_active': True,
                'send_reminder': False,
                'reminder_intervals': [],
            }
        )
        action = 'Created' if created else 'Updated'
        self.stdout.write(self.style.SUCCESS(
            f'{action} NotificationRule: travel.self_approved.manager_intimation'
        ))
