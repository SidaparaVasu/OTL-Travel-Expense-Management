
from celery import shared_task
from django.utils.module_loading import import_string
import logging
from apps.travel.utils.pdf_service import PDFService
import asyncio

logger = logging.getLogger(__name__)

@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={'max_retries': 3})
def generate_report_task(self, report_class_path: str, *args, **kwargs) -> bytes:
    """
    Generic Celery task to generate any report.
    
    Args:
        report_class_path (str): Dotted path to the Report class (e.g., 'apps.travel.reports.travel_details_report.TravelDetailsReport').
        *args: Positional arguments for the Report class constructor.
        **kwargs: Keyword arguments for the Report class constructor.
        
    Returns:
        bytes: Generated PDF content.
    """
    # Allow ORM access even if Django thinks we are in an async context
    # This is necessary because Playwright (even sync) might trigger Django's async detection
    import os
    os.environ["DJANGO_ALLOW_ASYNC_UNSAFE"] = "true"

    logger.info(f"Starting report generation task for: {report_class_path}")
    
    try:
        # Dynamically import the Report class
        ReportClass = import_string(report_class_path)
        
        # Instantiate the report
        report_instance = ReportClass(*args, **kwargs)
        
        # Generate HTML content (sync part)
        html_content = report_instance.render_html()
        
        # Generate PDF using SYNC Playwright service
        # No more asyncio.run() complexity inside Celery
        pdf_bytes = PDFService().generate_pdf_from_html(html_content)
        
        logger.info(f"Report generation successful for: {report_class_path}")
        return pdf_bytes
        
    except ImportError as e:
        logger.error(f"Failed to import report class {report_class_path}: {e}")
        raise e
    except Exception as e:
        logger.error(f"Report generation failed: {e}")
        raise e
