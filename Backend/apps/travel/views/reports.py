from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.http import HttpResponse
from apps.authentication.mixins import BranchFilterMixin
from apps.travel.models import TravelApplication, BookingAssignment
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

class TravelApplicationReportView(BranchFilterMixin, APIView):
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
        # 1. Fetch travel application
        from django.shortcuts import get_object_or_404
        from rest_framework.exceptions import PermissionDenied

        application = get_object_or_404(TravelApplication, pk=pk)

        # 2. Verify permissions
        user = request.user
        has_staff_role = (
            user.has_role('Admin') or 
            user.has_role('admin') or
            user.has_role('Travel Desk') or
            user.has_role('Finance')
        )

        has_permission = (
            # Employee who created the application
            application.employee == user or
            
            # Approvers in the workflow
            application.approval_flows.filter(approver=user).exists() or
            
            # Travel desk user assigned to this application
            application.travel_desk_user == user or

            # Branch-based access for staff roles
            (has_staff_role and self.check_branch_access(user, application.employee)) or

            # Any Travel Desk user gets read-only access for bill certification
            (user.has_role('Travel Desk') or user.has_role('Global Travel Desk')) or

            # Booking Agent assigned to any booking in this application
            # As per client requirement EasternTravel whose profile type is flight_train_booking agent is allowed to view travel report from 27-05-2026.
            # In case other booking agent will allow to access report modify profile type or add more profile types in query.
            BookingAssignment.objects.filter(
                assigned_to=user,
                booking__trip_details__travel_application=application,
                assigned_to__booking_agent_profile__services__profile_type__code='flight_train_agent',
                assigned_to__booking_agent_profile__services__is_active=True
            ).exists()
        )

        if not has_permission:
            raise PermissionDenied("You don't have permission to download this report")

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
