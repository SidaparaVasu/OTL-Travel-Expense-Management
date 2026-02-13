import os
import logging
from datetime import datetime
from django.conf import settings
from django.shortcuts import get_object_or_404
from apps.travel.models import TravelApplication
from apps.travel.serializers.travel_application_details_serializer import TravelApplicationDetailsSerializer

logger = logging.getLogger(__name__)

def generate_travel_details_report(application_id):
    """
    Generates a PDF report for a specific travel application.
    
    Args:
        application_id (int): ID of the TravelApplication
        
    Returns:
        str: Absolute path to the generated PDF file
    """
    try:
        from django.template import Template, Context
        from playwright.sync_api import sync_playwright
        from pathlib import Path
    except ImportError:
        logger.error("Required library 'playwright' not installed.")
        raise ImportError("Please install 'playwright' to generate reports.")

    # 1. Fetch Data
    application = get_object_or_404(TravelApplication, pk=application_id)
    serializer = TravelApplicationDetailsSerializer(application)
    data = serializer.data
    
    # 2. Prepare Context
    context_dict = _prepare_report_context(application, data)
    
    # 3. Render HTML
    template_name = 'travel_details_report.html'
    template_path = os.path.join(settings.BASE_DIR, 'apps', 'travel', 'reports', template_name)
    
    if not os.path.exists(template_path):
        raise FileNotFoundError(f"Report template not found at: {template_path}")

    with open(template_path, 'r', encoding='utf-8') as f:
        html_content = f.read()

    template = Template(html_content)
    html_string = template.render(Context(context_dict))
    
    # 4. Generate PDF
    # Create a unique filename based on ID and timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"Travel_Request_{application.id}_{timestamp}"
    
    # Ensure temporary output directory exists
    output_dir = os.path.join(settings.BASE_DIR, 'media', 'reports', 'temp')
    os.makedirs(output_dir, exist_ok=True)
    
    # Save HTML to a temporary file
    temp_html_path = os.path.join(output_dir, f"{filename}.html")
    with open(temp_html_path, 'w', encoding='utf-8') as f:
        f.write(html_string)
        
    pdf_output_path = os.path.join(output_dir, f"{filename}.pdf")
    
    try:
        html_path = Path(temp_html_path).resolve()
        
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()

            # IMPORTANT: Use absolute file URI
            page.goto(html_path.as_uri(), wait_until="networkidle")

            page.pdf(
                path=pdf_output_path,
                format="A4",
                print_background=True,
                margin={
                    "top": "5mm",
                    "bottom": "5mm",
                    "left": "5mm",
                    "right": "5mm",
                }
            )

            browser.close()
            
        # Optional: Remove temp HTML file
        # os.remove(temp_html_path)
        
    except Exception as e:
        logger.error(f"Playwright PDF generation failed: {str(e)}")
        raise Exception(f"PDF generation failed: {str(e)}")
        
    return pdf_output_path

def _prepare_report_context(application, serialized_data):
    """
    Maps serialized data and model instance to the flat context structure 
    expected by the DOCX template.
    """
    employee = application.employee
    # Fetch additional employee details not in serializer
    # Check if profile exists usually, but here accessing user fields directly
    
    context = {
        "header": {
            "travel_request_id": serialized_data['application']['travel_request_id'],
            "status": serialized_data['application']['status_label'],
            "submitted_date": serialized_data['timestamps']['submitted_at'],
            "generated_on": datetime.now().strftime("%d/%m/%Y %I:%M %p")
        },
        "employee": {
            "name": employee.get_full_name(),
            "email": employee.email,
            "mobile": getattr(employee, 'mobile_number', 'N/A'),
            "gender": getattr(employee, 'gender', 'N/A'),
            "department": serialized_data['application']['department'],
            "designation": serialized_data['application']['designation'],
            "grade": serialized_data['application']['grade'],
            "branch_location": getattr(employee, 'location', 'N/A')
        },
        "overview": {
            "purpose": serialized_data['application']['purpose'],
            "travel_type": application.get_travel_for_display(), # 'Self' / 'Guest' etc
            "internal_order": serialized_data['travel_details']['internal_order'],
            "cost_center_gl": serialized_data['travel_details']['gl_code'],
            "sanction_number": serialized_data['travel_details']['sanction_number'],
            "total_advance": f"₹{application.advance_amount:,.2f}" if application.advance_amount else "₹0.00"
        },
        "itinerary": {
            "locations": f"{serialized_data['travel_details']['trip_origin']} to {serialized_data['travel_details']['trip_destination']}",
            "dates": f"{serialized_data['travel_details']['start_datetime']} - {serialized_data['travel_details']['end_datetime']}",
            "times": f"{_extract_time(serialized_data['travel_details']['start_datetime'])} - {_extract_time(serialized_data['travel_details']['end_datetime'])}",
            "duration": f"{application.get_travel_duration_days()} Days"
        },
        # Lists for looping in template
        "transportation": _format_transportation_list(serialized_data['ticketing_bookings']),
        "accommodation": _format_accommodation_list(serialized_data['accommodation_bookings']),
        "conveyance": _format_conveyance_list(serialized_data['conveyance_bookings']),
        "approvals": _format_approval_list(serialized_data.get('approval_workflow', []))
    }
    
    return context

def _extract_time(datetime_str):
    """Extracts time part from 'DD/MM/YYYY HH:MM AM/PM' string"""
    if not datetime_str: return ""
    try:
        parts = datetime_str.split(' ')
        if len(parts) >= 3:
            return f"{parts[1]} {parts[2]}" # HH:MM AM/PM
        return ""
    except:
        return ""

def _format_transportation_list(bookings):
    """Formats ticketing bookings for template table"""
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

def _format_accommodation_list(bookings):
    """Formats accommodation bookings for template table"""
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

def _format_conveyance_list(bookings):
    """Formats conveyance bookings for template table"""
    formatted = []
    for b in bookings:
        # Determine route or type based on available fields
        formatted.append({
            "type": b.get('vehicle_type', ''),
            "sub_type": b.get('vehicle_subtype', ''),
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

def _format_approval_list(approvals):
    """Formats approval workflow for template table"""
    formatted = []
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
