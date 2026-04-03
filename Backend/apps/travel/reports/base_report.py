
import logging
import time
from abc import ABC, abstractmethod
from typing import Any, Dict
from django.conf import settings
from django.template.loader import render_to_string
from apps.travel.utils.pdf_service import PDFService
from utils.age_convert import calculate_age
import asyncio

logger = logging.getLogger(__name__)

class BaseReport(ABC):
    """
    Abstract Base Class for all Reports.
    Enforces a standard structure: Data -> Context -> HTML -> PDF.
    """

    def __init__(self, *args, **kwargs):
        self.args = args
        self.kwargs = kwargs
        self.context = {}

    @abstractmethod
    def get_template_name(self) -> str:
        """
        Returns the path to the Django template.
        Example: 'travel/reports/travel_details_report.html'
        """
        pass

    @abstractmethod
    def get_context_data(self) -> Dict[str, Any]:
        """
        Fetches data and returns the context dictionary for the template.
        """
        pass

    def render_html(self) -> str:
        """
        Renders the HTML content using Django's template engine.
        """
        template_name = self.get_template_name()
        context = self.get_context_data()
        return render_to_string(template_name, context)


    def generate_pdf(self) -> bytes:
        """
        Generates the PDF bytes using the PDFService.
        """
        html_content = self.render_html()
        service = PDFService() # Singleton instance

        logger.info("PERFORMANCE LOG: Before Playwright")
        start_time = time.time()
        
        # You can customize options by overriding a method or passing args in init
        pdf_bytes = service.generate_pdf_from_html(html_content)
        
        logger.info(f"PERFORMANCE LOG: After Playwright (Took {time.time() - start_time:.4f}s)")
        return pdf_bytes

    def generate(self) -> bytes:
        """
        Synchronous wrapper to generate the PDF.
        """
        return self.generate_pdf()


class TravelReportMixin:
    """
    Mixin providing common context helpers for Travel Reports.
    """
    
    def _get_header_context(self, application, serialized_data):
        from datetime import datetime
        return {
            "travel_request_id": serialized_data['application']['travel_request_id'],
            "status": serialized_data['application']['status_label'],
            "submitted_date": serialized_data['timestamps']['submitted_at'],
            "generated_on": datetime.now().strftime("%d/%m/%Y %I:%M %p")
        }

    def _get_employee_context(self, application, serialized_data):
        employee = application.employee
        return {
            "name": employee.get_full_name(),
            "email": employee.email,
            "mobile": getattr(employee, 'mobile_number', 'N/A'),
            "gender": getattr(employee, 'gender', 'N/A'),
            "department": serialized_data['application']['department'],
            "designation": serialized_data['application']['designation'],
            "grade": serialized_data['application']['grade'],
            "branch_location": getattr(employee, 'location', 'N/A'),
            "age": calculate_age(getattr(employee, 'date_of_birth', 'N/A')),
        }

    def _get_approval_context(self, serialized_data):
        formatted = []
        approvals = serialized_data.get('approval_workflow', [])
        for app in approvals:
            formatted.append({
                "level": app.get('level', '').replace('_', ' ').title(),
                "sequence": app.get('sequence', ''),
                "approver": app.get('approver', ''),
                "status": app.get('status', '').title(),
                "approved_at": app.get('approved_at', ''),
                "notes": app.get('notes', '')
            })
        return formatted

    def _extract_time(self, datetime_str):
        if not datetime_str: return ""
        try:
            parts = datetime_str.split(' ')
            if len(parts) >= 3:
                return f"{parts[1]} {parts[2]}"
            return ""
        except:
            return ""
