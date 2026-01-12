from django.test import TestCase
from django.urls import path, reverse
from django.contrib.auth.models import Group
from rest_framework.test import APIClient
from ..views import BaseBulkImportView
from django.core.files.uploadedfile import SimpleUploadedFile

# Define a concrete view for testing
class GroupBulkImportView(BaseBulkImportView):
    model_class = Group
    field_mapping = {'Group Name': 'name'}
    unique_fields = ['name']

# URL patterns for testing
urlpatterns = [
    path('test-bulk-import/', GroupBulkImportView.as_view(), name='test_bulk_import'),
]

from django.test import override_settings

@override_settings(ROOT_URLCONF=__name__)
class BaseBulkImportViewTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = reverse('test_bulk_import')

    def test_get_csv_template(self):
        response = self.client.get(self.url, {'template': 'csv'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'text/csv')
        self.assertIn('Group Name', response.content.decode())

    def test_get_xlsx_template(self):
        response = self.client.get(self.url, {'template': 'xlsx'})
        self.assertEqual(response.status_code, 200)
        self.assertIn('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', response['Content-Type'])

    def test_post_import_success(self):
        csv_content = b"Group Name\nTest Group 1\nTest Group 2"
        file = SimpleUploadedFile("groups.csv", csv_content, content_type="text/csv")
        
        data = {
            'file': file,
            'dry_run': 'false'
        }
        
        response = self.client.post(self.url, data, format='multipart')
        self.assertEqual(response.status_code, 200)
        
        response_data = response.json()
        self.assertFalse(response_data['summary']['dry_run'])
        self.assertEqual(response_data['summary']['created_count'], 2)
        
        self.assertTrue(Group.objects.filter(name='Test Group 1').exists())

    def test_post_import_dry_run_default(self):
        csv_content = b"Group Name\nTest Dry Run"
        file = SimpleUploadedFile("groups.csv", csv_content, content_type="text/csv")
        
        data = {
            'file': file,
            # No dry_run param, should default to True
        }
        
        response = self.client.post(self.url, data, format='multipart')
        self.assertEqual(response.status_code, 200)
        
        response_data = response.json()
        self.assertTrue(response_data['summary']['dry_run'])
        self.assertEqual(response_data['summary']['valid_rows'], 1)
        
        self.assertFalse(Group.objects.filter(name='Test Dry Run').exists())
