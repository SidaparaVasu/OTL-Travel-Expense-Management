import os
import logging
import time
from datetime import datetime
from django.conf import settings
from django.shortcuts import get_object_or_404
from apps.travel.models import TravelApplication
from apps.travel.serializers.travel_application_details_serializer import TravelApplicationDetailsSerializer
from apps.travel.reports.base_report import BaseReport, TravelReportMixin
from django.utils.asyncio import async_unsafe

logger = logging.getLogger(__name__)

class TravelDetailsReport(TravelReportMixin, BaseReport):
    """
    Report class for generating Travel Application Details PDF.
    """
    
    def __init__(self, application_id):
        self.application_id = application_id
        super().__init__()

    def get_template_name(self) -> str:
        return 'travel/reports/travel_details_report.html'

    @async_unsafe
    def get_context_data(self):
        logger.info(f"[{self.application_id}] PERFORMANCE LOG: Before DB fetch")
        start_time = time.time()
        
        application = get_object_or_404(TravelApplication, pk=self.application_id)
        logger.info(f"[{self.application_id}] PERFORMANCE LOG: DB fetch took {time.time() - start_time:.4f}s")

        serializer = TravelApplicationDetailsSerializer(application)
        data = serializer.data
        
        logger.info(f"[{self.application_id}] PERFORMANCE LOG: After serializer (Total context prep took {time.time() - start_time:.4f}s)")
        return self._prepare_report_context(application, data)

    def _prepare_report_context(self, application, serialized_data):
        """
        Maps serialized data and model instance to the flat context structure.
        """
        context = {
            "header": self._get_header_context(application, serialized_data),
            "employee": self._get_employee_context(application, serialized_data),
            "overview": {
                "purpose": serialized_data['application']['purpose'],
                "travel_type": application.get_travel_for_display(),
                "internal_order": serialized_data['travel_details']['internal_order'],
                "cost_center_gl": serialized_data['travel_details']['gl_code'],
                "sanction_number": serialized_data['travel_details']['sanction_number'],
                "total_advance": f"₹{application.advance_amount:,.2f}" if application.advance_amount else "₹0.00"
            },
            "itinerary": {
                "locations": f"{serialized_data['travel_details']['trip_origin']} to {serialized_data['travel_details']['trip_destination']}",
                "dates": f"{serialized_data['travel_details']['start_datetime']} - {serialized_data['travel_details']['end_datetime']}",
                "times": f"{self._extract_time(serialized_data['travel_details']['start_datetime'])} - {self._extract_time(serialized_data['travel_details']['end_datetime'])}",
                "duration": f"{application.get_travel_duration_days()} Days"
            },
            "transportation": self._format_transportation_list(serialized_data['ticketing_bookings']),
            "accommodation": self._format_accommodation_list(serialized_data['accommodation_bookings']),
            "conveyance": self._format_conveyance_list(serialized_data['conveyance_bookings']),
            "booking_references": self._build_booking_references(serialized_data),
            "travelers": serialized_data['application'].get('travelers', []),
            "approvals": self._get_approval_context(serialized_data)
        }
        return context

    def _desk_agent_fields(self, booking):
        td = booking.get("travel_desk") or {}
        assignments = booking.get("assignments") or []
        agent = assignments[0] if assignments else {}
        category = (
            booking.get("booking_type")
            or booking.get("accommodation_type")
            or ""
        ).lower()
        is_auto_ticketing = "flight" in category or "train" in category
        desk_user = ""
        if not is_auto_ticketing:
            desk_user = td.get("user") or ""
            if not desk_user and td.get("desk_status"):
                desk_user = td.get("desk_status")
        return {
            "desk_user": desk_user or "—",
            "desk_email": td.get("user_email") or "—",
            "desk_contact": td.get("user_contact") or "—",
            "forwarded_to_desk": td.get("forwarded_to_desk_at")
            or td.get("forwarded_at")
            or "—",
            "booking_agent": agent.get("assigned_to") or "—",
            "agent_assigned_at": agent.get("assigned_at") or "—",
            "agent_accepted_at": agent.get("accepted_at") or "—",
            "agent_confirmed_cancelled_at": agent.get("completed_at") or "—",
            "requested_vehicle_type": booking.get("requested_vehicle_model")
            or "—",
        }

    def _build_booking_references(self, serialized_data):
        rows = []
        for b in serialized_data.get("ticketing_bookings", []):
            row = {
                "booking_id": b.get("id"),
                "category": b.get("booking_type") or "Ticketing",
                "status": (b.get("status") or "").title(),
            }
            row.update(self._desk_agent_fields(b))
            rows.append(row)
        for b in serialized_data.get("accommodation_bookings", []):
            row = {
                "booking_id": b.get("id"),
                "category": b.get("accommodation_type") or "Accommodation",
                "status": (b.get("status") or "").title(),
            }
            row.update(self._desk_agent_fields(b))
            rows.append(row)
        for b in serialized_data.get("conveyance_bookings", []):
            row = {
                "booking_id": b.get("id"),
                "category": b.get("vehicle_type") or "Conveyance",
                "status": (b.get("status") or "").title(),
            }
            row.update(self._desk_agent_fields(b))
            rows.append(row)
        return rows

    def _format_transportation_list(self, bookings):
        formatted = []
        for b in bookings:
            formatted.append({
                "mode": b.get('booking_type', ''),
                "class": b.get('class_field', ''),
                "travel_datetime": b.get('departure_datetime', ''),
                "route": f"{b.get('from_location', '')} -> {b.get('to_location', '')}",
                "ticket_no": b.get('ticket_number', ''),
                "status": b.get('status', '').title(),
                "advance_req": b.get('advance_taken', ''),
                "self_arranged": "Yes" if b.get('is_self_arranged') else "No",
                "special_instruction": b.get('special_instructions', '')
            })
        return formatted

    def _format_accommodation_list(self, bookings):
        formatted = []
        for b in bookings:
            formatted.append({
                "type": b.get('accommodation_type', ''),
                "location": b.get('location', ''),
                "hotel_name": b.get('allocated_hotel', '') or b.get('allocated_guesthouse', ''),
                "checkin_dates": b.get('check_in_datetime', ''),
                "checkout_dates": b.get('check_out_datetime', ''),
                "status": b.get('status', '').title(),
                "advance_req": b.get('advance_taken', ''),
                "self_arranged": "Yes" if b.get('is_self_arranged') else "No",
                "special_instruction": b.get('special_instructions', '')
            })
        return formatted

    def _format_conveyance_list(self, bookings):
        formatted = []
        for b in bookings:
            formatted.append({
                "type": b.get('vehicle_type', ''),
                "sub_type": b.get('vehicle_subtype', ''),
                "requested_vehicle_model": b.get('requested_vehicle_model', ''),
                "route": f"{b.get('from_location', '')} -> {b.get('to_location', '')}",
                "reporting": f"{b.get('report_at', '')} {b.get('start_datetime', '')}",
                "passengers": b.get('passengers', '1'),
                "approx_km": b.get('distance_km', ''),
                "status": b.get('status', '').title(),
                "advance_req": b.get('advance_taken', ''),
                "self_arranged": "Yes" if b.get('is_self_arranged') else "No",
                "special_instruction": b.get('special_instructions', '')
            })
        return formatted

def generate_travel_details_report(application_id):
    """
    Legacy wrapper for backward compatibility or direct calls.
    Now uses the TravelDetailsReport class.
    """
    report = TravelDetailsReport(application_id)
    return report.generate()

