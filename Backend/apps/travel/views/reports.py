from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.http import HttpResponse
# from apps.travel.models import TravelApplication
# from apps.authentication.decorators import require_role
# from apps.travel.tasks import generate_report_task
from django_ratelimit.decorators import ratelimit
from django.utils.decorators import method_decorator

from asgiref.sync import sync_to_async

from apps.travel.reports.travel_details_report import TravelDetailsReport
from apps.travel.reports.advance_request_report import AdvanceRequestReport

from concurrent.futures import ThreadPoolExecutor
executor = ThreadPoolExecutor(max_workers=5)

import logging
logger = logging.getLogger(__name__)


# ============================================================
# Travel Application Details Report (PDF)
# ============================================================

class TravelApplicationReportView(APIView):
    """
    API View to download Travel Application Details Report (PDF).

    CURRENT ARCHITECTURE:
    - Async view (Django 5 async-compatible)
    - Sync ORM + Playwright execution isolated using sync_to_async
    - No Celery
    - No unsafe async overrides
    """

    permission_classes = [IsAuthenticated]

    @method_decorator(ratelimit(key='user', rate='5/m', method='GET', block=True))
    def get(self, request, pk):
        try:
            # --------------------------------------------------------
            # PREVIOUS VERSION (Celery-based implementation)
            #
            # report_class = 'apps.travel.reports.travel_details_report.TravelDetailsReport'
            # task = generate_report_task.delay(report_class, pk)
            #
            # try:
            #     pdf_bytes = task.get(timeout=30)
            # except Exception as e:
            #     logger.error(f"Task processing timed out or failed: {e}")
            #     return Response(
            #         {'error': 'Report generation timed out or failed. Please try again.'},
            #         status=504
            #     )
            # --------------------------------------------------------

            def generate():
                # Instantiate report class
                report = TravelDetailsReport(pk)
                return report.generate()

            pdf_bytes = executor.submit(generate).result()

            if not pdf_bytes:
                return Response(
                    {'error': 'Report generation returned no data.'},
                    status=500
                )

            filename = f"Travel_Request_{pk}.pdf"
            response = HttpResponse(pdf_bytes, content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            return response

        except Exception as e:
            logger.error(
                f"Error generating report for app {pk}: {str(e)}",
                exc_info=True
            )
            return Response(
                {'error': 'An unexpected error occurred.'},
                status=500
            )


# ============================================================
# Advance Request Report (PDF)
# ============================================================

class AdvanceRequestReportView(APIView):
    """
    API View to download Advance Request Report (PDF).

    CURRENT ARCHITECTURE:
    - Async view
    - Sync report generation isolated via sync_to_async
    - No Celery
    """

    permission_classes = [IsAuthenticated]

    @method_decorator(ratelimit(key='user', rate='5/m', method='GET', block=True))
    def get(self, request, pk):
        try:
            # --------------------------------------------------------
            # PREVIOUS VERSION (Celery-based implementation)
            #
            # report_class = 'apps.travel.reports.advance_request_report.AdvanceRequestReport'
            # task = generate_report_task.delay(report_class, pk)
            #
            # try:
            #     pdf_bytes = task.get(timeout=30)
            # except Exception as e:
            #     logger.error(f"Task processing timed out or failed: {e}")
            #     return Response(
            #         {'error': 'Report generation timed out or failed. Please try again.'},
            #         status=504
            #     )
            # --------------------------------------------------------

            def generate():
                report = AdvanceRequestReport(pk)
                return report.generate()

            pdf_bytes = executor.submit(generate).result()

            if not pdf_bytes:
                return Response(
                    {'error': 'Report generation returned no data.'},
                    status=500
                )

            filename = f"Advance_Request_{pk}.pdf"
            response = HttpResponse(pdf_bytes, content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            return response

        except Exception as e:
            logger.error(
                f"Error serving report for app {pk}: {str(e)}",
                exc_info=True
            )
            return Response(
                {'error': 'An unexpected error occurred.'},
                status=500
            )
