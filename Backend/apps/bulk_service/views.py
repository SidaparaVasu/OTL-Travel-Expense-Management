from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser
from rest_framework import status
from django.core.exceptions import ImproperlyConfigured
from .services import BulkImportService, BulkExportService
from .serializers import BulkImportResultSerializer
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiTypes

class BaseBulkImportView(APIView):
    """
    Base view for handling bulk import and template export.
    Subclasses must define `model_class`.
    """
    model_class = None
    parser_classes = [MultiPartParser]
    
    # Optional configurations
    field_mapping = None # {file_header: model_field}
    unique_fields = None # [field1, field2]
    
    def get_model(self):
        if self.model_class is None:
            raise ImproperlyConfigured("BaseBulkImportView requires a definition of 'model_class'")
        return self.model_class

    def get_mapping(self):
        return self.field_mapping

    def get_unique_fields(self):
        return self.unique_fields
        
    @extend_schema(
        parameters=[
            OpenApiParameter("template", OpenApiTypes.STR, enum=["csv", "xlsx"], description="Download template format"),
        ],
        responses={200: OpenApiTypes.BINARY},
        summary="Download Import Template"
    )
    def get(self, request, *args, **kwargs):
        """
        Download a template for bulk import.
        Query Param: `template=csv` or `template=xlsx`
        """
        template_format = request.query_params.get('template', 'csv')
        service = BulkExportService(self.get_model(), mapping=self.get_mapping())
        
        try:
            content = service.generate_template(template_format)
        except Exception as e:
             return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        if template_format == 'csv':
            content_type = 'text/csv'
            filename = 'import_template.csv'
        else:
            content_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            filename = 'import_template.xlsx'
            
        response = HttpResponse(content, content_type=content_type)
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response

    @extend_schema(
        request={
            'multipart/form-data': {
                'type': 'object',
                'properties': {
                    'file': {
                        'type': 'string',
                        'format': 'binary'
                    },
                    'dry_run': {
                        'type': 'boolean',
                        'default': True
                    }
                }
            }
        },
        responses={200: BulkImportResultSerializer},
        summary="Bulk Import Data"
    )
    def post(self, request, *args, **kwargs):
        """
        Handle bulk import.
        Form Data:
        - `file`: The file to upload (CSV/XLSX).
        - `dry_run`: boolean (default=true).
        """
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({"error": "No file uploaded."}, status=status.HTTP_400_BAD_REQUEST)
        
        dry_run_raw = request.data.get('dry_run', 'true')
        if isinstance(dry_run_raw, str):
            dry_run = dry_run_raw.lower() in ['true', '1', 'yes']
        if isinstance(dry_run_raw, str):
            dry_run = dry_run_raw.lower() in ['true', '1', 'yes']
        else:
            dry_run = bool(dry_run_raw)


        # Get extension
        filename = file_obj.name
        ext = filename.split('.')[-1] if '.' in filename else ''
        
        service = BulkImportService(
            model=self.get_model(), 
            mapping=self.get_mapping(),
            unique_fields=self.get_unique_fields()
        )
        
        result = service.handle_import(file_obj, ext, dry_run=dry_run)
        
        # Serialize response
        serializer = BulkImportResultSerializer(result)
        return Response(serializer.data, status=status.HTTP_200_OK)
