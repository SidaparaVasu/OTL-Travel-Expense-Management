from django.test import TestCase
from django.db import models
from ..services import BulkImportService
import io
import csv

# Define a dummy model for testing
# Note: Django TestCases usually require models to be in an app.
# If we can't define models dynamically, we will use a Mock or a real simple model if available.
# Recommendation: Use a Mock Model or 'SimpleModel' if one exists, or define one in test app if possible.
# Since we can't easily add a model to installed_apps on the fly without setup, 
# we will mock the model behavior or use `django.contrib.auth.models.User` or `Group` as a target.

from django.contrib.auth.models import Group

class BulkServiceTestCase(TestCase):
    def setUp(self):
        # We use Group model: fields 'name' (unique, required)
        self.model = Group
        self.service = BulkImportService(model=self.model, unique_fields=['name'])

    def create_csv(self, data):
        f = io.StringIO()
        writer = csv.DictWriter(f, fieldnames=data[0].keys())
        writer.writeheader()
        writer.writerows(data)
        f.seek(0)
        return f

    def test_dry_run_success(self):
        data = [{'name': 'Group A'}, {'name': 'Group B'}]
        file = self.create_csv(data)
        
        result = self.service.handle_import(file, 'csv', dry_run=True)
        
        self.assertTrue(result['summary']['dry_run'])
        self.assertEqual(result['summary']['valid_rows'], 2)
        self.assertEqual(result['summary']['created_count'], 2)
        # Ensure nothing created
        self.assertEqual(Group.objects.count(), 0)

    def test_commit_success(self):
        data = [{'name': 'Group A'}, {'name': 'Group B'}]
        file = self.create_csv(data)
        
        result = self.service.handle_import(file, 'csv', dry_run=False)
        
        self.assertFalse(result['summary']['dry_run'])
        self.assertEqual(result['summary']['valid_rows'], 2)
        self.assertEqual(result['summary']['created_count'], 2)
        # Ensure created
        self.assertEqual(Group.objects.count(), 2)
        self.assertTrue(Group.objects.filter(name='Group A').exists())

    def test_duplicate_update(self):
        # Create initial
        Group.objects.create(name='Existing Group')
        
        data = [{'name': 'Existing Group'}, {'name': 'New Group'}]
        file = self.create_csv(data)
        
        service_update = BulkImportService(model=self.model, unique_fields=['name'])
        result = service_update.handle_import(file, 'csv', dry_run=False)
        
        self.assertEqual(result['summary']['total_rows'], 2)
        self.assertEqual(result['summary']['updated_count'], 1)
        self.assertEqual(result['summary']['created_count'], 1)
        
        rows = result['rows']
        self.assertEqual(rows[0]['action'], 'update')
        self.assertEqual(rows[1]['action'], 'create')

    def test_validation_error_missing_column(self):
        # 'name' is required for Group
        data = [{'other_field': 'Value'}]
        file = self.create_csv(data)
        
        result = self.service.handle_import(file, 'csv')
        self.assertIn('error', result)
        self.assertIn('Missing required columns', result['error'])

    def test_row_validation_error(self):
        # Group name max_length is 150. Let's send a huge string if we wanted to test validation,
        # but easier to test a different constraint. Group name must be unique. 
        # But generic validation handles uniqueness? No, generic validator logic might not catch DB uniqueness unless checked.
        # However, `DynamicModelSerializer` does validation.
        # Let's try sending an empty name if we can.
        
        # Actually, let's look at `_process_row`.
        # `SerializerClass(data=mapped_data)`
        # If we send empty name, serializer should fail validaton (required).
        
        data = [{'name': ''}] # Empty
        file = self.create_csv(data)
        
        result = self.service.handle_import(file, 'csv', dry_run=True)
        self.assertEqual(result['summary']['invalid_rows'], 1)
        self.assertEqual(result['rows'][0]['status'], 'failed')
        self.assertIn('name', str(result['rows'][0]['errors']))
