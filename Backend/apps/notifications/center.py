from django.template import Template, Context
from django.conf import settings
from django.utils import timezone
from django.db import transaction
from .models import NotificationRule, NotificationLog, NotificationEvent, EmailTemplateMaster
from apps.authentication.models import User
from .providers import EmailProviderFactory
import logging

logger = logging.getLogger(__name__)


class NotificationCenter:
    """Central notification orchestration API."""

    @staticmethod
    def notify(event_name: str, reference: dict, payload: dict):
        """
        Notify entrypoint.

        reference: {'type': 'TravelRequest', 'id': 12}
        payload: must contain IDs like 'employee_id', 'approver_id', 'booking_agent_id', 'desk_agent_id' as needed.
        """
        logger.error("[NOTIFY-ENTRY] event=%s payload=%s", event_name, payload)
        
        rule = NotificationRule.objects.filter(event_name=event_name, is_active=True).first()

        logger.error("[NOTIFY-RULE] event=%s rule=%s", event_name, rule)
        
        if not rule:
            logger.info("No NotificationRule found for event: %s", event_name)
            return

        # Render template if present
        subject, body_html, body_text = None, None, None
        if rule.template:
            subject, body_html, body_text = NotificationCenter._render_template(rule.template, payload)

        # Resolve recipients (list of User objects or simple dicts mapping to contact methods)
        recipients = NotificationCenter._resolve_recipients(rule.recipient_resolver, payload)

        logger.error("[NOTIFY-RECIPIENTS] event=%s resolver=%s recipients=%s", event_name, rule.recipient_resolver, recipients)

        if not recipients:
            logger.error(
                "[NOTIFY-ABORT] No recipients for event=%s payload=%s",
                event_name,
                payload
            )
            return

        # Create NotificationEvent for reminders if configured
        if rule.send_reminder and rule.reminder_intervals:
            # set first reminder time according to rule.reminder_intervals[0]
            seconds = rule.reminder_intervals[0] if len(rule.reminder_intervals) > 0 else None
            next_rem = timezone.now() + timezone.timedelta(seconds=seconds) if seconds else None
            NotificationEvent.objects.create(
                event_name=event_name,
                reference_type=reference.get('type'),
                reference_id=reference.get('id'),
                rule=rule,
                data=payload,
                next_reminder_at=next_rem,
                reminder_index=0,
            )

        # For one-shot events that have no reminder configured, still write a
        # resolved NotificationEvent as a proof-of-send receipt.  This allows
        # idempotency guards elsewhere to check "was this event ever fired for
        # this reference?" without having to query NotificationLog.
        # Currently applied to: travel.settlement.expired
        ONE_SHOT_RECEIPT_EVENTS = {'travel.settlement.expired'}
        if event_name in ONE_SHOT_RECEIPT_EVENTS and not (rule.send_reminder and rule.reminder_intervals):
            NotificationEvent.objects.get_or_create(
                event_name=event_name,
                reference_type=reference.get('type'),
                reference_id=reference.get('id'),
                defaults={
                    'rule': rule,
                    'data': payload,
                    'next_reminder_at': None,
                    'reminder_index': 0,
                    'is_resolved': True,  # born resolved — one-shot, no follow-ups
                },
            )

        # For each channel and recipient create log and enqueue Celery task
        for channel in rule.channels:
            for r in recipients:
                # r expected to be a User instance or dict { 'email':..., 'phone':... }
                recipient_contact = NotificationCenter._get_contact_for_channel(r, channel)
                if not recipient_contact:
                    logger.debug("No contact for channel %s on recipient %s", channel, r)
                    continue

                # Respect user preferences if r is User
                if isinstance(r, User):
                    prefs = getattr(r, 'notification_preferences', None)
                    # convert event_name dots to field-like name for preferences check
                    pref_key = event_name.replace('.', '_')
                    if prefs and not prefs.should_notify(pref_key, channel=channel):
                        NotificationLog.objects.create(
                            event_name=event_name,
                            channel=channel,
                            recipient=recipient_contact,
                            subject=subject,
                            body=body_text or body_html,
                            payload=payload,
                            status='skipped',
                        )
                        continue

                # create log
                log = NotificationLog.objects.create(
                    event_name=event_name,
                    channel=channel,
                    recipient=recipient_contact,
                    subject=subject,
                    body=body_text or body_html,
                    payload=payload,
                    status='queued',
                )

                # Enqueue Celery task only after the database transaction commits
                # to avoid race conditions where the worker starts before the log is visible.
                from . import tasks
                transaction.on_commit(
                    lambda l_id=log.id, c=channel, s=subject, bt=body_text, bh=body_html, p=payload: 
                    tasks.send_notification_task.apply_async(
                        args=[l_id, c, s, bt or '', bh or '', p],
                        queue='notifications'
                    )
                )

    @staticmethod
    def _render_template(template_obj: EmailTemplateMaster, payload: dict):
        """Render HTML (and text fallback) using Django template engine."""
        ctx = Context(payload)
        subj_template = Template(template_obj.subject or '')
        html_template = Template(template_obj.body_html or '')
        text_template = Template(template_obj.body_text or '')

        subject = subj_template.render(ctx)
        body_html = html_template.render(ctx)
        body_text = text_template.render(ctx)
        # If no body_text provided, generate a simple text fallback from HTML
        if not body_text:
            # crude fallback: strip tags - keep simple to avoid heavy deps
            import re
            body_text = re.sub(r'<[^>]+>', '', body_html)

        return subject, body_html, body_text

    @staticmethod
    def _resolve_recipients(resolver_key: str, payload: dict):
        """Resolve recipient User instances or simple dicts based on payload IDs.

        Supported resolver keys:
            - 'employee' -> payload['employee_id']
            - 'approver' -> payload['approver_id']
            - 'booking_agent' -> payload['booking_agent_id']
            - 'desk_agent' -> payload['desk_agent_id']
            - 'approver_and_stakeholders' -> approver + travel desk + booking agents (for cancellation requests)
            - 'booking_agents' -> all assigned booking agents (list)
            - 'travel_desk' -> travel desk user or all users with Travel Desk role
            - 'default_resolver' -> payload['recipients'] (list of ids or contacts)
        """        
        users = []
        try:
            if resolver_key == 'employee' and payload.get('employee_id'):
                users = list(User.objects.filter(id=payload.get('employee_id')))
            elif resolver_key == 'approver' and payload.get('approver_id'):
                users = list(User.objects.filter(id=payload.get('approver_id')))
            elif resolver_key == 'booking_agent' and payload.get('booking_agent_id'):
                users = list(User.objects.filter(id=payload.get('booking_agent_id')))
            elif resolver_key == 'desk_agent' and payload.get('desk_agent_id'):
                users = list(User.objects.filter(id=payload.get('desk_agent_id')))
            
            elif resolver_key == 'employee_and_desk':
                if payload.get('employee_id'):
                    users.extend(User.objects.filter(id=payload.get('employee_id')))
                if payload.get('travel_desk_id'):
                    users.extend(User.objects.filter(id=payload.get('travel_desk_id')))
            
            elif resolver_key == 'employee_and_booking_agent':
                if payload.get('employee_id'):
                    users.extend(User.objects.filter(id=payload.get('employee_id')))
                if payload.get('booking_agent_id'):
                    users.extend(User.objects.filter(id=payload.get('booking_agent_id')))
            
            # Cancellation-specific resolvers
            elif resolver_key == 'approver_and_stakeholders':
                # Primary approver
                if payload.get('approver_id'):
                    users.extend(User.objects.filter(id=payload.get('approver_id')))
                
                # Applicant (Employee)
                if payload.get('employee_id'):
                    users.extend(User.objects.filter(id=payload.get('employee_id')))
                
                # Travel desk user if assigned
                if payload.get('travel_desk_id'):
                    users.extend(User.objects.filter(id=payload.get('travel_desk_id')))
                
                # Booking agents if any
                if payload.get('booking_agent_ids'):
                    agent_ids = payload.get('booking_agent_ids', [])
                    users.extend(User.objects.filter(id__in=agent_ids))
            
            elif resolver_key == 'booking_agents':
                # All assigned booking agents
                if payload.get('booking_agent_ids'):
                    agent_ids = payload.get('booking_agent_ids', [])
                    users = list(User.objects.filter(id__in=agent_ids))
            
            elif resolver_key == 'travel_desk':
                # Specific travel desk user if assigned, otherwise all Travel Desk role users
                if payload.get('travel_desk_id'):
                    users = list(User.objects.filter(id=payload.get('travel_desk_id')))
                else:
                    # Get all users with Travel Desk role
                    from apps.authentication.models import Role
                    travel_desk_role = Role.objects.filter(name='Travel Desk').first()
                    if travel_desk_role:
                        users = list(User.objects.filter(userrole__role=travel_desk_role, userrole__is_active=True))
            
            elif resolver_key == 'default_resolver':
                # payload['recipients'] can be list of user ids, or list of contact dicts
                recs = payload.get('recipients', [])
                ids = [r for r in recs if isinstance(r, int)]
                users = list(User.objects.filter(id__in=ids))
                # also keep non-user dicts
                others = [r for r in recs if isinstance(r, dict)]
                users.extend(others)
        except Exception as e:
            logger.exception("Error resolving recipients for %s: %s", resolver_key, e)
        return users

    @staticmethod
    def _get_contact_for_channel(recipient, channel):
        """Return the contact string (email or phone) for recipient and channel."""
        if isinstance(recipient, User):
            if channel == 'email':
                return recipient.email
            if channel == 'sms':
                return getattr(recipient, 'phone_number', None)
            if channel == 'in_app':
                # in_app will use user id to create notification row
                return recipient.id
        elif isinstance(recipient, dict):
            # dict contact like {'email': 'a@b.com'}
            return recipient.get('email') if channel == 'email' else recipient.get('phone')
        return None
