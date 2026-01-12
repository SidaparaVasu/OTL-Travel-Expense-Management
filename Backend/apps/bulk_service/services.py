import time
from typing import Type, List, Dict, Any, Optional, Callable
from django.db import models, transaction
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.serializers import ModelSerializer
from rest_framework.exceptions import ValidationError
from .parsers import get_parser
from .serializers import DynamicModelSerializer
import io
import csv
import openpyxl

class BulkExportService:
    """
    Service for generating import templates (CSV/XLSX) based on model fields.
    """
    def __init__(self, model: Type[models.Model], mapping: Optional[Dict[str, str]] = None):
        self.model = model
        self.mapping = mapping or {}

    def generate_template(self, file_format: str = 'csv') -> Any:
        # Generate headers based on model fields and optional mapping
        headers = self._get_template_headers()
        
        if file_format.lower() == 'csv':
             return self._generate_csv(headers)
        elif file_format.lower() in ['xlsx', 'xls']:
             return self._generate_xlsx(headers)
        else:
             raise ValidationError(f"Unsupported export format: {file_format}")

    def _get_template_headers(self) -> List[str]:
        # Invert mapping to correlate model fields to file headers
        model_to_file = {v: k for k, v in self.mapping.items()}
        
        headers = []
        for field in self.model._meta.fields:
             if field.name == 'id':
                 continue
             
             header_name = model_to_file.get(field.name, field.name)
             if not field.null and not field.blank and field.default == models.NOT_PROVIDED:
                 header_name += " (Required)"
             headers.append(header_name)
        return headers

    def _generate_csv(self, headers: List[str]):
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow(headers)
        return buffer.getvalue()

    def _generate_xlsx(self, headers: List[str]):
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.append(headers)
        
        # Stylistic touches: Bold headers
        for cell in ws[1]:
            cell.font = openpyxl.styles.Font(bold=True)
            
        buffer = io.BytesIO()
        wb.save(buffer)
        buffer.seek(0)
        return buffer.read()


class BulkImportService:
    """
    Service for handling bulk import of data into a Django model.
    Supports CSV and XLSX formats.
    """
    def __init__(self, model: Type[models.Model], mapping: Optional[Dict[str, str]] = None, unique_fields: Optional[List[str]] = None, batch_size: int = 100):
        """
        :param model: The Django model class to import into.
        :param mapping: Optional dictionary mapping file headers to model fields. {file_header: model_field}
        :param unique_fields: List of fields to check for uniqueness (duplicates).
        :param batch_size: Number of records to process in a single transaction.
        """
        self.model = model
        self.mapping = mapping or {}
        self.unique_fields = unique_fields or []
        self.batch_size = batch_size
        
        # Internal state
        self.rows_results = []
        self.summary = {
            'total_rows': 0,
            'valid_rows': 0,
            'invalid_rows': 0,
            'created_count': 0,
            'updated_count': 0,
            'skipped_count': 0,
            'dry_run': False,
            'execution_time': 0.0
        }
        self.required_model_fields = self._get_required_model_fields()

    def _get_required_model_fields(self) -> List[str]:
        """
        Identify required fields from the model (not null, not blank, no default).
        """
        required = []
        for field in self.model._meta.fields:
            if not field.null and not field.blank and field.default == models.NOT_PROVIDED and field.name != 'id':
                required.append(field.name)
        return required

    def handle_import(self, file_obj, file_extension: str, dry_run: bool = True) -> Dict[str, Any]:
        """
        Main entry point for handling the import process.
        """
        start_time = time.time()
        self.summary['dry_run'] = dry_run

        try:
            parser = get_parser(file_obj, file_extension)
            headers = parser.get_headers()
            self._validate_headers(headers)

            valid_rows_batch = []
            
            for i, row_data in enumerate(parser.parse(), start=1):
                self.summary['total_rows'] += 1
                row_result = self._process_row(i, row_data, dry_run)
                self.rows_results.append(row_result)
                
                if row_result['status'] == 'success':
                   valid_rows_batch.append(row_result)

                # Batch Commit Logic
                if not dry_run and len(valid_rows_batch) >= self.batch_size:
                    self._commit_batch(valid_rows_batch)
                    valid_rows_batch = []
            
            # Commit remaining rows
            if not dry_run and valid_rows_batch:
                self._commit_batch(valid_rows_batch)

            # Update summary stats from results
            self._update_summary_stats()
            pass # handled by _update_summary_stats
                    
        except ValidationError as e:
            # File-level validation error
            return {
                'summary': self.summary,
                'rows': [],
                'error': str(e.detail)
            }
        except Exception as e:
            return {
                'summary': self.summary,
                'rows': [],
                'error': f"Unexpected error: {str(e)}"
            }

        end_time = time.time()
        self.summary['execution_time'] = round(end_time - start_time, 2)
        
        return {
            'summary': self.summary,
            'rows': self.rows_results
        }

    def _validate_headers(self, headers: List[str]):
        """
        Validates that the file headers cover all required model fields (considering mapping).
        """
        if not headers:
            raise ValidationError("File contains no headers.")
            
        normalized_headers = {h.strip().lower() for h in headers}
        
        # Invert mapping to check if required model fields are covered
        # mapping: {file_header: model_field}
        mapped_to_model = {v: k for k, v in self.mapping.items()}
        
        missing_fields = []
        for field in self.required_model_fields:
            # Check if field is directly in headers or mapped
            is_present = False
            # 1. Direct match (case-insensitive usually preferred, but keeping strict for now unless normalized)
            if field.lower() in normalized_headers:
                is_present = True
            # 2. Mapped match
            elif field in mapped_to_model:
                file_header = mapped_to_model[field]
                if file_header.strip().lower() in normalized_headers:
                    is_present = True
            
            if not is_present:
                missing_fields.append(field)

        if missing_fields:
            raise ValidationError(f"Missing required columns: {', '.join(missing_fields)}")
            
        # Check for duplicate headers
        if len(headers) != len(set(headers)):
            raise ValidationError("Duplicate column headers found.")

    def _process_row(self, row_number: int, row_data: Dict[str, Any], dry_run: bool) -> Dict[str, Any]:
        """
        Validates and processes a single row.
        """
        errors = []
        warnings = []
        cleaned_data = {}
        action = 'none'
        
        # 1. Map Keys
        mapped_data = {}
        for file_key, value in row_data.items():
            model_key = self.mapping.get(file_key, file_key) # Use mapping or default to file key
            
            # Simple normalization of header to field name if no mapping
            if file_key not in self.mapping:
                model_key = file_key.lower().replace(' ', '_')
                
            mapped_data[model_key] = value

        # 2. Validation using dynamic serializer
        # Create a serializer class on the fly for this model
        SerializerClass = self._get_serializer_class()
        serializer = SerializerClass(data=mapped_data)
        
        if serializer.is_valid():
            cleaned_data = serializer.validated_data
            action = 'create' # Default action
            
            # Duplicate detection strategy
            if self.unique_fields:
                filters = {f: cleaned_data.get(f) for f in self.unique_fields if cleaned_data.get(f) is not None}
                if filters:
                    qs = self.model.objects.filter(**filters)
                    if qs.exists():
                        action = 'update'
                        warnings.append(f"Duplicate found for {filters}. Will update existing record.")
        else:
            # detailed errors
            for field, msgs in serializer.errors.items():
                for msg in msgs:
                    errors.append(f"{field}: {msg}")

        status = 'failed' if errors else 'success'

        return {
            'row_number': row_number,
            'status': status,
            'action': action if status == 'success' else 'none',
            'errors': errors,
            'warnings': warnings,
            'cleaned_payload': cleaned_data if status == 'success' else mapped_data
        }

    def _commit_batch(self, rows_results: List[Dict[str, Any]]):
        """
        Commits a batch of valid rows wrapped in a transaction.
        """
        try:
            with transaction.atomic():
                for row in rows_results:
                    if row['action'] == 'create':
                        self.model.objects.create(**row['cleaned_payload'])
                    elif row['action'] == 'update':
                        # perform update
                        filters = {f: row['cleaned_payload'].get(f) for f in self.unique_fields}
                        self.model.objects.filter(**filters).update(**row['cleaned_payload'])
        except Exception as e:
            # Rollback batch on error and mark all rows in the batch as failed
            error_msg = f"Batch transaction failed: {str(e)}"
            for row in rows_results:
                row['status'] = 'failed'
                row['errors'].append(error_msg)
                # Reset action to none to prevent stale stats
                row['action'] = 'none'

    def _update_summary_stats(self):
        """
        Recalculates summary stats from the rows_results.
        """
        self.summary['valid_rows'] = 0
        self.summary['invalid_rows'] = 0
        self.summary['created_count'] = 0
        self.summary['updated_count'] = 0
        self.summary['skipped_count'] = 0
        
        for row in self.rows_results:
            if row['status'] == 'success':
                self.summary['valid_rows'] += 1
                if row['action'] == 'create':
                    self.summary['created_count'] += 1
                elif row['action'] == 'update':
                    self.summary['updated_count'] += 1
            elif row['status'] == 'skipped':
                self.summary['skipped_count'] += 1
            else:
                self.summary['invalid_rows'] += 1

    def _get_serializer_class(self):
        """
        Returns a dynamically created ModelSerializer for validation.
        """
        class Meta:
            model = self.model
            fields = '__all__'
            
        return type(f"{self.model.__name__}ImportSerializer", (ModelSerializer,), {'Meta': Meta})
