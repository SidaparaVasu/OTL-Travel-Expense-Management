# Generated migration for loading cancellation email notification fixtures

from django.db import migrations
import json
import os


def load_cancellation_email_templates(apps, schema_editor):
    """Load cancellation email templates from fixture file"""
    EmailTemplateMaster = apps.get_model('notifications', 'EmailTemplateMaster')
    
    # Define the templates directly (PKs 14-18)
    templates = [
        {
            "pk": 14,
            "template_key": "travel.cancellation.requested",
            "template_name": "Travel Cancellation Request Submitted",
            "subject": "Cancellation Request for Travel Application — {{ request_id }}",
            "body_html": "<p>Dear {{ approver_name }},</p>\n<p><strong>{{ employee_name }}</strong> has submitted a request to cancel their approved travel application.</p>\n<p><strong>Request ID:</strong> {{ request_id }}</p>\n<p><strong>Purpose:</strong> {{ purpose }}</p>\n<p><strong>Travel Dates:</strong> {{ travel_dates }}</p>\n<p><strong>Cancellation Reason:</strong> {{ cancellation_reason }}</p>\n<p>Please log in to the Travel Management System to review this cancellation request and approve or reject it.</p>\n<p>Thank you,<br>Travel Management System</p>",
            "body_text": "Dear {{ approver_name }}, {{ employee_name }} has requested to cancel travel application {{ request_id }}. Reason: {{ cancellation_reason }}. Please review and take action.",
            "cc_emails": [],
            "bcc_emails": [],
            "is_active": True,
        },
        {
            "pk": 15,
            "template_key": "travel.cancellation.approved",
            "template_name": "Travel Cancellation Approved",
            "subject": "Your Travel Cancellation Has Been Approved — {{ request_id }}",
            "body_html": "<p>Dear {{ employee_name }},</p>\n<p>Your cancellation request for travel application <strong>{{ request_id }}</strong> has been <strong>approved</strong> by {{ approver_name }}.</p>\n<p><strong>Purpose:</strong> {{ purpose }}</p>\n<p><strong>Travel Dates:</strong> {{ travel_dates }}</p>\n<p><strong>Approver Notes:</strong> {{ notes }}</p>\n<p>Your travel application has been successfully cancelled. All associated bookings have been marked as cancelled.</p>\n<p>If you had any advance payment for this travel, the finance team will process the refund accordingly.</p>\n<p>Thank you,<br>Travel Management System</p>",
            "body_text": "Dear {{ employee_name }}, your cancellation request for travel application {{ request_id }} has been approved by {{ approver_name }}.",
            "cc_emails": [],
            "bcc_emails": [],
            "is_active": True,
        },
        {
            "pk": 16,
            "template_key": "travel.cancellation.rejected",
            "template_name": "Travel Cancellation Rejected",
            "subject": "Your Cancellation Request Has Been Rejected — {{ request_id }}",
            "body_html": "<p>Dear {{ employee_name }},</p>\n<p>Your cancellation request for travel application <strong>{{ request_id }}</strong> has been <strong>rejected</strong> by {{ approver_name }}.</p>\n<p><strong>Rejection Reason:</strong> {{ rejection_reason }}</p>\n<p>Your travel application has been restored to its previous status: <strong>{{ previous_status }}</strong>. You may proceed with your travel as originally planned.</p>\n<p>If you still wish to cancel, please contact your approver ({{ approver_name }}) for clarification or submit a new cancellation request with additional justification.</p>\n<p>Thank you,<br>Travel Management System</p>",
            "body_text": "Dear {{ employee_name }}, your cancellation request for travel application {{ request_id }} has been rejected by {{ approver_name }}. Reason: {{ rejection_reason }}.",
            "cc_emails": [],
            "bcc_emails": [],
            "is_active": True,
        },
        {
            "pk": 17,
            "template_key": "travel.cancellation.booking_agent",
            "template_name": "Travel Cancellation - Booking Agent Notification",
            "subject": "Travel Booking Cancelled — {{ request_id }}",
            "body_html": "<p>Dear {{ booking_agent_name }},</p>\n<p>The travel application <strong>{{ request_id }}</strong> that was assigned to you for booking has been <strong>cancelled</strong>.</p>\n<p><strong>Employee:</strong> {{ employee_name }}</p>\n<p><strong>Purpose:</strong> {{ purpose }}</p>\n<p><strong>Cancellation Reason:</strong> {{ cancellation_reason }}</p>\n<p><strong>Important:</strong> All booking actions for this travel application have been disabled. Please do not proceed with any bookings or confirmations for this request.</p>\n<p>If you have already initiated any booking processes, please halt them immediately and notify the Travel Desk.</p>\n<p>Thank you,<br>Travel Management System</p>",
            "body_text": "Dear {{ booking_agent_name }}, travel application {{ request_id }} assigned to you has been cancelled. Please halt all booking activities.",
            "cc_emails": [],
            "bcc_emails": [],
            "is_active": True,
        },
        {
            "pk": 18,
            "template_key": "travel.cancellation.travel_desk",
            "template_name": "Travel Cancellation - Travel Desk Notification",
            "subject": "Travel Application Cancelled — {{ request_id }}",
            "body_html": "<p>Dear {{ travel_desk_name }},</p>\n<p>The travel application <strong>{{ request_id }}</strong> that was pending in your queue has been <strong>cancelled</strong>.</p>\n<p><strong>Employee:</strong> {{ employee_name }}</p>\n<p><strong>Purpose:</strong> {{ purpose }}</p>\n<p><strong>Travel Dates:</strong> {{ travel_dates }}</p>\n<p><strong>Cancellation Reason:</strong> {{ cancellation_reason }}</p>\n<p><strong>Important:</strong> This application cannot be forwarded to booking agents. All processing for this request must be halted immediately.</p>\n<p>Please ensure this application is removed from your active queue.</p>\n<p>Thank you,<br>Travel Management System</p>",
            "body_text": "Dear {{ travel_desk_name }}, travel application {{ request_id }} has been cancelled. Do not forward to booking agents.",
            "cc_emails": [],
            "bcc_emails": [],
            "is_active": True,
        },
    ]
    
    for template_data in templates:
        EmailTemplateMaster.objects.update_or_create(
            pk=template_data['pk'],
            defaults={
                'template_key': template_data['template_key'],
                'template_name': template_data['template_name'],
                'subject': template_data['subject'],
                'body_html': template_data['body_html'],
                'body_text': template_data['body_text'],
                'cc_emails': template_data['cc_emails'],
                'bcc_emails': template_data['bcc_emails'],
                'is_active': template_data['is_active'],
            }
        )
    
    print("✅ Loaded 5 cancellation email templates (PKs 14-18)")


def load_cancellation_notification_rules(apps, schema_editor):
    """Load cancellation notification rules"""
    NotificationRule = apps.get_model('notifications', 'NotificationRule')
    EmailTemplateMaster = apps.get_model('notifications', 'EmailTemplateMaster')
    
    rules = [
        {
            "event_name": "travel.cancellation.requested",
            "description": "Notification sent to approver when employee requests travel cancellation",
            "template_key": "travel.cancellation.requested",
            "channels": ["email", "in_app"],
            "recipient_resolver": "approver_and_stakeholders",
            "is_active": True,
        },
        {
            "event_name": "travel.cancellation.approved",
            "description": "Notification sent to employee when cancellation request is approved",
            "template_key": "travel.cancellation.approved",
            "channels": ["email", "in_app"],
            "recipient_resolver": "employee",
            "is_active": True,
        },
        {
            "event_name": "travel.cancellation.rejected",
            "description": "Notification sent to employee when cancellation request is rejected",
            "template_key": "travel.cancellation.rejected",
            "channels": ["email", "in_app"],
            "recipient_resolver": "employee",
            "is_active": True,
        },
        {
            "event_name": "travel.cancellation.booking_agent",
            "description": "Notification sent to booking agents when travel is cancelled during booking phase",
            "template_key": "travel.cancellation.booking_agent",
            "channels": ["email", "in_app"],
            "recipient_resolver": "booking_agents",
            "is_active": True,
        },
        {
            "event_name": "travel.cancellation.travel_desk",
            "description": "Notification sent to travel desk when travel is cancelled while pending with them",
            "template_key": "travel.cancellation.travel_desk",
            "channels": ["email", "in_app"],
            "recipient_resolver": "travel_desk",
            "is_active": True,
        },
    ]
    
    for rule_data in rules:
        # Get template by key
        template = EmailTemplateMaster.objects.filter(
            template_key=rule_data['template_key']
        ).first()
        
        # Use get_or_create with event_name as unique identifier
        # This avoids PK conflicts and allows idempotent migrations
        rule, created = NotificationRule.objects.get_or_create(
            event_name=rule_data['event_name'],
            defaults={
                'description': rule_data['description'],
                'template': template,
                'channels': rule_data['channels'],
                'recipient_resolver': rule_data['recipient_resolver'],
                'is_active': rule_data['is_active'],
                'send_reminder': False,
                'reminder_intervals': [],
                'escalation_resolver': None,
            }
        )
        
        # Update if already exists
        if not created:
            rule.description = rule_data['description']
            rule.template = template
            rule.channels = rule_data['channels']
            rule.recipient_resolver = rule_data['recipient_resolver']
            rule.is_active = rule_data['is_active']
            rule.send_reminder = False
            rule.reminder_intervals = []
            rule.escalation_resolver = None
            rule.save()
    
    print("✅ Loaded 5 cancellation notification rules")


def reverse_load_templates(apps, schema_editor):
    """Remove cancellation email templates"""
    EmailTemplateMaster = apps.get_model('notifications', 'EmailTemplateMaster')
    EmailTemplateMaster.objects.filter(pk__in=[14, 15, 16, 17, 18]).delete()
    print("❌ Removed cancellation email templates")


def reverse_load_rules(apps, schema_editor):
    """Remove cancellation notification rules"""
    NotificationRule = apps.get_model('notifications', 'NotificationRule')
    # Delete by event_name instead of PK to avoid conflicts
    NotificationRule.objects.filter(
        event_name__in=[
            'travel.cancellation.requested',
            'travel.cancellation.approved',
            'travel.cancellation.rejected',
            'travel.cancellation.booking_agent',
            'travel.cancellation.travel_desk',
        ]
    ).delete()
    print("❌ Removed cancellation notification rules")


class Migration(migrations.Migration):

    dependencies = [
        ('notifications', '0002_alter_emailtemplatemaster_options_and_more'),
    ]

    operations = [
        migrations.RunPython(
            load_cancellation_email_templates,
            reverse_code=reverse_load_templates
        ),
        migrations.RunPython(
            load_cancellation_notification_rules,
            reverse_code=reverse_load_rules
        ),
    ]
