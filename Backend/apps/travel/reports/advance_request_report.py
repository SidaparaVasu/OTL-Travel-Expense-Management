import logging
from datetime import datetime
from django.shortcuts import get_object_or_404
from apps.travel.models import TravelApplication, AdvanceProcessing
from apps.travel.serializers.travel_application_details_serializer import TravelApplicationDetailsSerializer
from apps.travel.reports.base_report import BaseReport, TravelReportMixin

logger = logging.getLogger(__name__)

class AdvanceRequestReport(TravelReportMixin, BaseReport):
    """
    Report class for generating Advance Request PDF.
    """
    
    def __init__(self, application_id):
        self.application_id = application_id
        super().__init__()

    def get_template_name(self) -> str:
        return 'travel/reports/advance_request_report.html'

    def get_context_data(self):
        application = get_object_or_404(TravelApplication, pk=self.application_id)
        serializer = TravelApplicationDetailsSerializer(application)
        data = serializer.data
        
        # Prepare context
        context = {
            "header": self._get_header_context(application, data),
            "employee": self._get_employee_context(application, data),
            "approvals": self._get_approval_context(data),
            "trip_details": self._get_trip_details_context(application, data),
            "advance_breakdown": self._get_advance_breakdown(application),
            "finance_action": self._get_finance_action_context(application)
        }
        return context

    def _get_trip_details_context(self, application, serialized_data):
        return {
            "travel_request_id": serialized_data['application']['travel_request_id'],
            "purpose": serialized_data['application']['purpose'],
            "start_date": serialized_data['travel_details']['start_datetime'],
            "end_date": serialized_data['travel_details']['end_datetime'],
            "internal_order": serialized_data['travel_details']['internal_order'],
            "gl_code": serialized_data['travel_details']['gl_code'],
            "sanction_number": serialized_data['travel_details']['sanction_number']
        }

    def _get_advance_breakdown(self, application):
        breakdown = []
        total_requested = 0
        
        for trip in application.trip_details.all():
            for booking in trip.bookings.all():
                if booking.estimated_cost and booking.estimated_cost > 0:
                    cost = booking.estimated_cost
                    total_requested += cost
                    
                    # Format sub-option nicely
                    sub_option = ""
                    if booking.sub_option:
                        sub_option = booking.sub_option.name
                    
                    breakdown.append({
                        "mode": booking.booking_type.name,
                        "sub_option": sub_option,
                        "amount": f"₹{cost:,.2f}"
                    })
        
        return {
            "items": breakdown,
            "total": f"₹{total_requested:,.2f}"
        }

    def _get_finance_action_context(self, application):
        try:
            advance = application.advance_processing
            return {
                "processed_amount": f"₹{advance.processed_amount:,.2f}" if advance.processed_amount else "-",
                "payment_mode": advance.get_payment_mode_display() if advance.payment_mode else "-",
                "reference_number": advance.reference_number or "-",
                "remarks": advance.remarks or "-",
                "status": advance.get_status_display()
            }
        except AdvanceProcessing.DoesNotExist:
            return {
                "processed_amount": "-",
                "payment_mode": "-",
                "reference_number": "-",
                "remarks": "-",
                "status": "Pending"
            }
