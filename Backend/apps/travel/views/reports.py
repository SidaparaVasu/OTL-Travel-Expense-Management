from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from django.http import FileResponse
from apps.travel.models import TravelApplication
from apps.authentication.decorators import require_role
from apps.travel.reports.travel_details_report import generate_travel_details_report
import os

class TravelApplicationReportView(APIView):
    """
    API View to download Travel Application Details Report (PDF)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            # Generate the report
            # The generate function handles fetching and validation
            pdf_path = generate_travel_details_report(pk)
            
            if not os.path.exists(pdf_path):
                from rest_framework.response import Response
                return Response({'error': 'Report generation failed - file not found'}, status=500)

            # Serve the file
            filename = os.path.basename(pdf_path)
            return FileResponse(
                open(pdf_path, 'rb'), 
                as_attachment=True, 
                filename=filename,
                content_type='application/pdf'
            )
        except Exception as e:
            from rest_framework.response import Response
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error generating report for app {pk}: {str(e)}", exc_info=True)
            return Response({'error': str(e)}, status=500)
