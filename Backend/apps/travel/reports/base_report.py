
import logging
from abc import ABC, abstractmethod
from typing import Any, Dict
from django.conf import settings
from django.template.loader import render_to_string
from apps.travel.utils.pdf_service import PDFService
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
        # You can customize options by overriding a method or passing args in init
        pdf_bytes = service.generate_pdf_from_html(html_content)
        return pdf_bytes

    def generate(self) -> bytes:
        """
        Synchronous wrapper to generate the PDF.
        """
        return self.generate_pdf()
