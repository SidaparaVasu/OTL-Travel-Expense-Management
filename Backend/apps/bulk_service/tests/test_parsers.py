import io
import unittest
from django.test import SimpleTestCase
from ..parsers import get_parser, CSVParser, XLSXParser
import openpyxl

class ParserTestCase(SimpleTestCase):
    def test_csv_parser(self):
        csv_content = "Name, Age\nJohn Isner, 35\n Novak Djokovic, 36"
        file = io.StringIO(csv_content)
        
        parser = CSVParser(file)
        headers = parser.get_headers()
        self.assertEqual(headers, ['Name', 'Age'])
        
        rows = list(parser.parse())
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]['Name'], 'John Isner')
        self.assertEqual(rows[0]['Age'], '35')
        self.assertEqual(rows[1]['Name'], 'Novak Djokovic')
        self.assertEqual(rows[1]['Age'], '36')

    def test_xlsx_parser(self):
        # Create a simple Excel file in memory
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.append(['Product', 'Price'])
        ws.append(['Laptop', '1000'])
        ws.append(['Mouse', '20'])
        
        file = io.BytesIO()
        wb.save(file)
        file.seek(0)
        
        parser = XLSXParser(file)
        headers = parser.get_headers()
        self.assertEqual(headers, ['Product', 'Price'])
        
        rows = list(parser.parse())
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]['Product'], 'Laptop')
        self.assertEqual(rows[0]['Price'], '1000')

    def test_get_parser_factory(self):
        file = io.StringIO("dummy")
        self.assertIsInstance(get_parser(file, 'csv'), CSVParser)
        
        file_bytes = io.BytesIO(b"dummy")
        self.assertIsInstance(get_parser(file_bytes, 'xlsx'), XLSXParser)
        
        with self.assertRaises(Exception): # ValidationError usually
            get_parser(file, 'txt')
