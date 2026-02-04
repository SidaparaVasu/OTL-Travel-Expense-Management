from celery import shared_task
from django.utils import timezone
from apps.travel.models import TravelApplication
from .models import NotificationLog, NotificationEvent
from .providers import EmailProviderFactory
from .center import NotificationCenter
from django_celery_beat.models import ClockedSchedule, PeriodicTask
from django.utils import timezone
import json
import datetime
import logging

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_notification_task(self, log_id, channel, subject, body_text, body_html, payload):
    log = NotificationLog.objects.filter(id=log_id).first()
    if not log:
        logger.error('NotificationLog not found: %s', log_id)
        return

    try:
        if channel == 'email':
            provider = EmailProviderFactory()
            to_emails = [log.recipient] if isinstance(log.recipient, str) else log.recipient
            
            attachments = []
            
            attachments = []
            if payload.get('attach_duty_slip'):
                try:
                    from apps.travel.models import Booking
                    from apps.travel.utils.pdf_generator import generate_duty_slip_pdf
                    
                    booking_id = payload.get('booking_id')
                    if booking_id:
                        booking = Booking.objects.filter(id=booking_id).first()
                        if booking:
                            pdf_buffer = generate_duty_slip_pdf(booking)
                            pdf_content = pdf_buffer.getvalue()
                            
                            attachments.append({
                                'name': f"DutySlip_{booking.id}.pdf",
                                'content': pdf_content,
                                'mimetype': 'application/pdf'
                            })
                except Exception as e:
                    logger.error(f"Error generating duty slip attachment for log {log_id}: {str(e)}")

            # General: Check for booking_file attachment (e.g. Bulk Upload Excel)
            booking_id = payload.get('booking_id')
            if booking_id:
                try:
                    from apps.travel.models import Booking
                    import mimetypes
                    import os
                    
                    # optimized query if not already fetched
                    booking = Booking.objects.filter(id=booking_id).first()
                    
                    if booking and booking.booking_file:
                        try:
                            # Open file if not already open
                            if booking.booking_file.closed:
                                booking.booking_file.open('rb')
                            
                            file_content = booking.booking_file.read()
                            file_name = os.path.basename(booking.booking_file.name)
                            content_type, _ = mimetypes.guess_type(file_name)
                            
                            attachments.append({
                                'name': file_name,
                                'content': file_content,
                                'mimetype': content_type or 'application/octet-stream'
                            })
                        except Exception as file_error:
                             logger.error(f"Error reading booking file for log {log_id}: {str(file_error)}")
                except Exception as e:
                    logger.error(f"Error attaching booking file for log {log_id}: {str(e)}")

            provider.send(subject=subject, body_text=body_text, body_html=body_html, to_emails=to_emails, attachments=attachments)
        elif channel == 'in_app':
            # create an in-app notification record or push through websocket
            # from .in_app import create_in_app_notification
            # create_in_app_notification(payload=payload, recipient=log.recipient, title=subject, body=body_text)
            logger.warning('In app notifications are pending as of now.')
            pass
        else:
            # SMS / other channels placeholder
            logger.warning('Channel %s not implemented yet', channel)

        log.mark_sent()
        logger.info('Notification sent log=%s', log.id)
    except Exception as exc:
        log.mark_failed(str(exc))
        logger.exception('Failed to send notification log=%s', log_id)
        try:
            self.retry(exc=exc)
        except self.MaxRetriesExceededError:
            logger.error('Max retries exceeded for log %s', log_id)


@shared_task
def mark_travel_as_completed(travel_id):
    try:
        travel = TravelApplication.objects.get(id=travel_id)

        if travel.status in ["completed", "cancelled"]:
            return

        end_date = travel.get_travel_end_date()
        if not end_date:
            return

        if timezone.now().date() >= end_date:
            travel.status = "completed"
            travel.is_claimable = True  # if this field exists
            travel.save(update_fields=["status", "is_claimable"])

            NotificationCenter.notify(
                "travel.settlement.reminder",
                {"type": "TravelRequest", "id": travel.id},
                {
                    "employee_id": travel.employee.id,
                    "employee_name": travel.employee.get_full_name(),
                    "request_id": travel.get_travel_request_id(),
                    "settlement_due_date": travel.settlement_due_date,
                }
            )

    except TravelApplication.DoesNotExist:
        logger.warning("TravelApplication not found for id=%s", travel_id)


def schedule_travel_completion(travel_app):
    end_date = travel_app.get_travel_end_date()

    if not end_date:
        logger.warning(
            "Cannot schedule completion: no trip dates for travel_app=%s",
            travel_app.id
        )
        return

    run_datetime = timezone.make_aware(
        datetime.datetime.combine(end_date, datetime.time(hour=1))
    )

    clocked, _ = ClockedSchedule.objects.get_or_create(
        clocked_time=run_datetime
    )

    PeriodicTask.objects.update_or_create(
        name=f"travel_complete_{travel_app.id}",
        task="notifications.tasks.mark_travel_as_completed",
        one_off=True,
        clocked=clocked,
        args=json.dumps([travel_app.id])
    )