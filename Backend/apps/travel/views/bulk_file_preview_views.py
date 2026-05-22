import os

from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.travel.models import Booking, TravelApplication
from apps.travel.services.bulk_file_access import (
    user_can_preview_booking_bulk,
    user_can_view_travel_application,
)
from apps.travel.services.bulk_file_preview import preview_uploaded_file
from utils.response_formatter import error_response, success_response


class BookingBulkFilePreviewView(APIView):
    """
    GET /travel/bookings/<booking_id>/bulk-file/preview/

    Read applicant bulk guest data from Booking.bulk_booking_file only.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, booking_id):
        booking = (
            Booking.objects.select_related(
                "trip_details__travel_application__employee",
                "assignment",
            )
            .filter(pk=booking_id)
            .first()
        )
        if not booking:
            return error_response(
                message="Booking not found",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        if not user_can_preview_booking_bulk(request.user, booking):
            return error_response(
                message="You do not have permission to view this bulk file",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        if not booking.bulk_booking_file:
            return error_response(
                message="No bulk guest data file attached to this booking",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        file_url = request.build_absolute_uri(booking.bulk_booking_file.url)

        try:
            preview = preview_uploaded_file(
                booking.bulk_booking_file,
                source="booking",
                booking_id=booking.id,
            )
        except ValidationError as exc:
            detail = exc.detail
            message = detail[0] if isinstance(detail, list) else str(detail)
            return error_response(
                message=message,
                status_code=status.HTTP_400_BAD_REQUEST,
                data={"file_url": file_url, "file_name": os.path.basename(booking.bulk_booking_file.name)},
            )

        preview["file_url"] = file_url
        return success_response(
            data=preview,
            message="Bulk file preview loaded",
        )


class ApplicationBulkFilePreviewView(APIView):
    """
    GET /travel/applications/<pk>/bulk-file/preview/

    Legacy application-level bulk file (TravelApplication.bulk_upload_file).
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        application = (
            TravelApplication.objects.select_related("employee")
            .filter(pk=pk)
            .first()
        )
        if not application:
            return error_response(
                message="Travel application not found",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        if not user_can_view_travel_application(request.user, application):
            return error_response(
                message="You do not have permission to view this bulk file",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        if not application.bulk_upload_file:
            return error_response(
                message="No bulk upload file attached to this application",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        file_url = request.build_absolute_uri(application.bulk_upload_file.url)

        try:
            preview = preview_uploaded_file(
                application.bulk_upload_file,
                source="application",
                application_id=application.id,
            )
        except ValidationError as exc:
            detail = exc.detail
            message = detail[0] if isinstance(detail, list) else str(detail)
            return error_response(
                message=message,
                status_code=status.HTTP_400_BAD_REQUEST,
                data={
                    "file_url": file_url,
                    "file_name": os.path.basename(application.bulk_upload_file.name),
                },
            )

        preview["file_url"] = file_url
        return success_response(
            data=preview,
            message="Bulk file preview loaded",
        )
