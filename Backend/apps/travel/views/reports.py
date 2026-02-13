from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.http import HttpResponse
from apps.travel.models import TravelApplication
from apps.authentication.decorators import require_role
from apps.travel.tasks import generate_report_task
from django_ratelimit.decorators import ratelimit
from django.utils.decorators import method_decorator
import logging

logger = logging.getLogger(__name__)

class TravelApplicationReportView(APIView):
    """
    API View to download Travel Application Details Report (PDF).
    Uses Celery for generation and enforces rate limits.
    """
    permission_classes = [IsAuthenticated]

    @method_decorator(ratelimit(key='user', rate='5/m', method='GET', block=True))
    def get(self, request, pk):
        try:
            # Report Class Path
            report_class = 'apps.travel.reports.travel_details_report.TravelDetailsReport'
            
            # Trigger Celery Task
            # We wait for the result (synchronous for the client, async for the worker)
            # Timeout set to 30 seconds to prevent hanging
            task = generate_report_task.delay(report_class, pk)
            
            try:
                pdf_bytes = task.get(timeout=30)
            except Exception as e:
                logger.error(f"Task processing timed out or failed: {e}")
                return Response({'error': 'Report generation timed out or failed. Please try again.'}, status=504)
            
            if not pdf_bytes:
                 return Response({'error': 'Report generation returned no data.'}, status=500)

            # Serve the PDF
            filename = f"Travel_Request_{pk}.pdf"
            response = HttpResponse(pdf_bytes, content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            return response

        except Exception as e:
            logger.error(f"Error serving report for app {pk}: {str(e)}", exc_info=True)
            return Response({'error': 'An unexpected error occurred.'}, status=500)

class AdvanceRequestReportView(APIView):
    """
    API View to download Advance Request Report (PDF).
    Uses Celery for generation and enforces rate limits.
    """
    permission_classes = [IsAuthenticated]

    @method_decorator(ratelimit(key='user', rate='5/m', method='GET', block=True))
    def get(self, request, pk):
        try:
            # Report Class Path
            report_class = 'apps.travel.reports.advance_request_report.AdvanceRequestReport'
            
            # Trigger Celery Task
            task = generate_report_task.delay(report_class, pk)
            
            try:
                pdf_bytes = task.get(timeout=30)
            except Exception as e:
                logger.error(f"Task processing timed out or failed: {e}")
                return Response({'error': 'Report generation timed out or failed. Please try again.'}, status=504)
            
            if not pdf_bytes:
                 return Response({'error': 'Report generation returned no data.'}, status=500)

            # Serve the PDF
            filename = f"Advance_Request_{pk}.pdf"
            response = HttpResponse(pdf_bytes, content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            return response

        except Exception as e:
            logger.error(f"Error serving report for app {pk}: {str(e)}", exc_info=True)
            return Response({'error': 'An unexpected error occurred.'}, status=500)
