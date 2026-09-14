"""
Travel Application Export View
Generates an Excel file of travel applications filtered by trip start date range.
Accessible by Admin users only.
"""

import io
import logging
from datetime import datetime

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from apps.authentication.permissions import IsAdminUser
from apps.travel.models.application import TravelApplication, TripDetails
from utils.response_formatter import error_response

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_date(value: str, param_name: str):
    """Parse a YYYY-MM-DD string; raise ValueError with a clear message on failure."""
    try:
        return datetime.strptime(value.strip(), "%Y-%m-%d").date()
    except (ValueError, AttributeError):
        raise ValueError(f"'{param_name}' must be a valid date in YYYY-MM-DD format.")


def _format_time(t):
    """Return HH:MM string or empty string for None."""
    if t is None:
        return ""
    return t.strftime("%H:%M")


def _format_date(d):
    """Return DD-Mon-YYYY string or empty string for None."""
    if d is None:
        return ""
    return d.strftime("%d-%b-%Y")


def _get_travel_request_id(app: TravelApplication) -> str:
    return f"TR/TSF/{app.created_at.year}/{app.id:07d}"


def _build_row(app: TravelApplication, first_trip, last_trip) -> list:
    """Build a single data row for the Excel sheet."""
    employee = app.employee
    full_name = f"{employee.first_name} {employee.last_name}".strip() or employee.username

    origin = (
        first_trip.from_location.city_name
        if first_trip and first_trip.from_location
        else ""
    )
    destination = (
        last_trip.to_location.city_name
        if last_trip and last_trip.to_location
        else ""
    )

    return [
        _get_travel_request_id(app),
        app.get_travel_for_display(),          # Travel For (Self / Guest / Self + Guest)
        employee.username,                      # Username
        full_name,                              # Employee Full Name
        app.purpose or "",
        app.get_status_display(),
        origin,
        destination,
        _format_date(first_trip.departure_date if first_trip else None),
        _format_time(first_trip.start_time if first_trip else None),
        _format_date(last_trip.return_date if last_trip else None),
        _format_time(last_trip.end_time if last_trip else None),
    ]


def _build_preview_item(app: TravelApplication, first_trip, last_trip) -> dict:
    """Build a lightweight dict for the JSON preview response."""
    employee = app.employee
    full_name = f"{employee.first_name} {employee.last_name}".strip() or employee.username

    return {
        "travel_request_id": _get_travel_request_id(app),
        "travel_for": app.get_travel_for_display(),     # Self / Guest / Self + Guest
        "username": employee.username,
        "employee_name": full_name,
        "purpose": app.purpose or "",
        "status": app.get_status_display(),
        "origin": (
            first_trip.from_location.city_name
            if first_trip and first_trip.from_location
            else ""
        ),
        "destination": (
            last_trip.to_location.city_name
            if last_trip and last_trip.to_location
            else ""
        ),
        "trip_start_date": _format_date(first_trip.departure_date if first_trip else None),
        "trip_start_time": _format_time(first_trip.start_time if first_trip else None),
        "trip_end_date": _format_date(last_trip.return_date if last_trip else None),
        "trip_end_time": _format_time(last_trip.end_time if last_trip else None),
    }


def _fetch_applications(start_date, end_date, travel_for: str = None):
    """
    Return a list of tuples:
        (TravelApplication, first_trip_or_None, last_trip_or_None)

    Only includes applications whose EARLIEST trip departure_date (trip start date)
    falls within [start_date, end_date].

    Optional travel_for filter: 'self' or 'guest' (case-insensitive).
    'self_guest' is intentionally excluded from filtering options.
    """
    from django.db.models import Min

    app_ids = (
        TripDetails.objects
        .values("travel_application_id")
        .annotate(earliest_start=Min("departure_date"))
        .filter(earliest_start__range=(start_date, end_date))
        .values_list("travel_application_id", flat=True)
    )

    qs = (
        TravelApplication.objects
        .filter(id__in=app_ids)
        .select_related("employee", "general_ledger")
        .prefetch_related(
            "trip_details__from_location", 
            "trip_details__to_location",
            "trip_details__bookings",
            "display_travelers__guest",
            "trip_details__bookings__booking_type",
            "trip_details__bookings__sub_option",
            "trip_details__bookings__assignment__assigned_to"
        )
        .order_by("id")
    )

    if travel_for in ("self", "guest"):
        qs = qs.filter(travel_for=travel_for)

    result = []
    for app in qs:
        trips = list(app.trip_details.order_by("departure_date", "id"))
        first_trip = trips[0] if trips else None
        last_trip = (
            sorted(trips, key=lambda t: (t.return_date or t.departure_date, t.id))[-1]
            if trips else None
        )
        result.append((app, first_trip, last_trip))

    return result


def _build_consolidated_row(app: TravelApplication, first_trip, last_trip, city_map: dict) -> list:
    """Build a consolidated row with detailed bookings for the Excel sheet."""
    employee = app.employee
    full_name = f"{employee.first_name} {employee.last_name}".strip() or employee.username
    
    origin = first_trip.from_location.city_name if first_trip and first_trip.from_location else "N/A"
    destination = last_trip.to_location.city_name if last_trip and last_trip.to_location else "N/A"

    # Gather genders and guests
    genders = []
    guests = []
    if app.travel_for in ['self', 'self_guest']:
        emp_gender = employee.get_gender_display() if hasattr(employee, 'get_gender_display') else getattr(employee, 'gender', 'N/A')
        if not emp_gender: emp_gender = 'N/A'
        genders.append(emp_gender)
        
    for traveler in app.display_travelers.all():
        if traveler.guest:
            g_name = f"{traveler.guest.first_name} {traveler.guest.last_name}".strip()
            if g_name: guests.append(g_name)
            
            g_gender = traveler.guest.get_gender_display() or getattr(traveler.guest, 'gender', 'N/A')
            if not g_gender: g_gender = 'N/A'
            genders.append(g_gender)
            
    guest_name_str = "\n".join(guests) if guests else "N/A"
    gender_str = "\n".join(genders) if genders else "N/A"

    def get_city(loc_id):
        if not loc_id: return "N/A"
        res = city_map.get(loc_id)
        if not res and str(loc_id).isdigit():
            res = city_map.get(int(loc_id))
        if not res:
            res = city_map.get(str(loc_id))
        return res if res else str(loc_id)

    tickets = []
    accommodations = []
    conveyances = []

    for trip in app.trip_details.all():
        for booking in trip.bookings.all():
            b_type_name = booking.booking_type.name if booking.booking_type else ""
            cat = getattr(booking.booking_type, 'booking_category', "")
            if not cat:
                cat = "ticketing" if b_type_name in ["Flight", "Train"] else \
                      "accommodation" if b_type_name == "Accommodation" else "conveyance"

            b_details = booking.booking_details or {}
            vendor = booking.vendor_reference
            if not vendor and hasattr(booking, 'assignment') and booking.assignment and booking.assignment.assigned_to:
                vendor = booking.assignment.assigned_to.get_full_name() or booking.assignment.assigned_to.username
            if not vendor: vendor = "N/A"

            # Advance amount logic (using estimated_cost if not taken)
            adv = str(booking.estimated_cost) if booking.estimated_cost else "Not Taken"
            if adv == "0" or adv == "0.00": adv = "Not Taken"

            remarks = booking.special_instruction or "N/A"

            if cat == "ticketing" or b_type_name in ["Flight", "Train"]:
                sub_opt = booking.sub_option.name if booking.sub_option else "N/A"
                self_arr = "Yes" if b_details.get("is_self_arranged") else "No"
                loc = f"{b_details.get('from_location_name', 'N/A')} - {b_details.get('to_location_name', 'N/A')}"
                dep_dt = f"{b_details.get('departure_date', 'N/A')} {b_details.get('departure_time', '')}".strip()
                arr_dt = f"{b_details.get('arrival_date', 'N/A')} {b_details.get('arrival_time', '')}".strip()
                
                tickets.append(
                    f"Type of Ticket: {b_type_name} - {sub_opt}\n"
                    f"Train / Flight No.: {b_details.get('ticket_number', 'N/A')}\n"
                    f"Self-Arranged?: {self_arr}\n"
                    f"From Location - To Location: {loc}\n"
                    f"Departure Date & Time: {dep_dt}\n"
                    f"Arrival Date & Time: {arr_dt}\n"
                    f"Advance Amount: {adv}\n"
                    f"Special remarks: {remarks}\n"
                    f"Vendor Name: {vendor}"
                )
                
            elif cat == "accommodation" or b_type_name == "Accommodation":
                nights = "0"
                cin = b_details.get('check_in_date')
                cout = b_details.get('check_out_date')
                if cin and cout:
                    try:
                        from datetime import datetime
                        d1 = datetime.strptime(cin, "%Y-%m-%d")
                        d2 = datetime.strptime(cout, "%Y-%m-%d")
                        nights = str((d2 - d1).days)
                    except:
                        pass
                
                place_id = b_details.get('place')
                place_name = get_city(place_id)
                if place_name == str(place_id) and b_details.get('arc_hotel_preferences'):
                    prefs = b_details.get('arc_hotel_preferences', [])
                    if prefs and isinstance(prefs, list):
                        place_name = ", ".join([str(p.get('city_name', '')) for p in prefs if isinstance(p, dict)]) or str(place_id)
                if place_name == str(place_id):
                    place_name = "N/A" # Final fallback if it's just an ID and we couldn't resolve it, better to show N/A or keep ID? Usually keeping ID is confusing.
                    # User said "1923 location name is not showing, id is showing", so we just keep the resolved name. But wait, if it fails to resolve, let's just return what get_city returns which is the string representation. Wait, user wants the name. Let's keep it as `get_city` result.
                    # Wait, if get_city returns "1923", the user complained about that. But if our city_map fix works, it will resolve. If it doesn't, it means 1923 is not in CityMaster. Let's just leave it as get_city result.
                    pass

                cin_dt = f"{cin or 'N/A'} {b_details.get('check_in_time', '')}".strip()
                cout_dt = f"{cout or 'N/A'} {b_details.get('check_out_time', '')}".strip()
                
                sub_opt = booking.sub_option.name if booking.sub_option else "N/A"
                accommodations.append(
                    f"Accommodation/Hotel Type: {sub_opt}\n"
                    f"Place of Accommodation: {place_name}\n"
                    f"Check-in date and time: {cin_dt}\n"
                    f"Check-out date and time: {cout_dt}\n"
                    f"Number of Room Nights: {nights}\n"
                    f"Advance Amount: {adv}\n"
                    f"Special remarks: {remarks}\n"
                    f"Vendor Name: {vendor}"
                )
                
            elif cat == "conveyance" or b_type_name not in ["Bulk Booking"]:
                sub_opt = booking.sub_option.name if booking.sub_option else "N/A"
                
                # Fetch locations
                from_loc = get_city(b_details.get('from_location') or b_details.get('from_location_name'))
                to_loc = get_city(b_details.get('to_location') or b_details.get('to_location_name'))
                
                report = b_details.get('report_at', 'N/A')
                drop = b_details.get('drop_location', 'N/A')
                start_dt = f"{b_details.get('start_date', 'N/A')} {b_details.get('start_time', '')}".strip()
                end_dt = f"{b_details.get('end_date', 'N/A')} {b_details.get('end_time', '')}".strip()
                travellers = b_details.get('passenger_count') or len(b_details.get('guests', [])) or "1"
                
                conveyances.append(
                    f"Vehicle Type/Name: {b_type_name} - {sub_opt}\n"
                    f"Place: {from_loc} - {to_loc}\n"
                    f"Report At & Drop Location: {report} - {drop}\n"
                    f"Start Date & Time: {start_dt}\n"
                    f"End Date & Time: {end_dt}\n"
                    f"Approx. K.M. (Two-way distance): {b_details.get('distance_km', 'N/A')}\n"
                    f"No. of travellers: {travellers}\n"
                    f"Advance Amount: {adv}\n"
                    f"Special remarks (if mentioned): {remarks}\n"
                    f"Vendor Name: {vendor}"
                )

    vertical = app.general_ledger.vertical_name if app.general_ledger else "N/A"
    gl_code = app.general_ledger.gl_code if app.general_ledger else "N/A"
    io_number = app.internal_order or "N/A"
    sanc_number = app.sanction_number or "N/A"
    
    adv_amt_opted = "Not Taken"
    if app.advance_amount:
        try:
            if float(app.advance_amount) > 0:
                adv_amt_opted = str(app.advance_amount)
        except:
            adv_amt_opted = str(app.advance_amount)

    def join_with_hint(lst):
        if not lst: return "-"
        res = "\n\n---\n\n".join(lst)
        return "(Click to see full details)\n\n" + res

    return [
        _get_travel_request_id(app),
        vertical,
        io_number,
        gl_code,
        sanc_number,
        app.get_travel_for_display(),
        employee.username,
        full_name,
        gender_str,
        app.purpose or "N/A",
        app.get_status_display() or "N/A",
        origin,
        destination,
        _format_date(first_trip.departure_date if first_trip else None) or "N/A",
        _format_date(last_trip.return_date if last_trip else None) or "N/A",
        _format_time(first_trip.start_time if first_trip else None) or "N/A",
        _format_time(last_trip.end_time if last_trip else None) or "N/A",
        adv_amt_opted,
        join_with_hint(tickets),
        join_with_hint(accommodations),
        join_with_hint(conveyances),
    ]


def _generate_excel(rows: list, start_date, end_date, headers: list, column_widths: list) -> bytes:
    """Build and return the Excel workbook as bytes."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Travel Applications"

    # ---- Styles ----
    header_font = Font(bold=True, color="FFFFFF", size=11)
    header_fill = PatternFill(start_color="1F4E79", end_color="1F4E79", fill_type="solid")
    header_alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

    meta_font = Font(bold=True, size=10)
    meta_fill = PatternFill(start_color="D9E1F2", end_color="D9E1F2", fill_type="solid")

    thin_border = Border(
        left=Side(style="thin"),
        right=Side(style="thin"),
        top=Side(style="thin"),
        bottom=Side(style="thin"),
    )

    alt_fill = PatternFill(start_color="EBF3FB", end_color="EBF3FB", fill_type="solid")

    # ---- Title / Meta rows ----
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=len(headers))
    title_cell = ws["A1"]
    title_cell.value = "Travel Applications Report"
    title_cell.font = Font(bold=True, size=14, color="1F4E79")
    title_cell.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[1].height = 28

    ws.merge_cells(start_row=2, start_column=1, end_row=2, end_column=len(headers))
    range_cell = ws["A2"]
    range_cell.value = (
        f"Date Range: {_format_date(start_date)}  →  {_format_date(end_date)}"
        f"     |     Total Records: {len(rows)}"
    )
    range_cell.font = meta_font
    range_cell.fill = meta_fill
    range_cell.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[2].height = 20

    # ---- Column headers ----
    header_row = 3
    for col_idx, (header, width) in enumerate(zip(headers, column_widths), start=1):
        cell = ws.cell(row=header_row, column=col_idx, value=header)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_alignment
        cell.border = thin_border
        ws.column_dimensions[get_column_letter(col_idx)].width = width

    ws.row_dimensions[header_row].height = 30

    # ---- Data rows ----
    for row_idx, row_data in enumerate(rows, start=header_row + 1):
        fill = alt_fill if row_idx % 2 == 0 else None
        for col_idx, value in enumerate(row_data, start=1):
            cell = ws.cell(row=row_idx, column=col_idx, value=value)
            cell.border = thin_border
            cell.alignment = Alignment(vertical="top", wrap_text=True)
            if fill:
                cell.fill = fill
        ws.row_dimensions[row_idx].height = 18

    # ---- Freeze panes below header ----
    ws.freeze_panes = ws.cell(row=header_row + 1, column=1)

    # ---- Write to bytes ----
    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer.read()


# ---------------------------------------------------------------------------
# Views
# ---------------------------------------------------------------------------

class TravelApplicationExportPreviewView(APIView):
    """
    GET /api/travel/admin/export/preview/?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD

    Returns a JSON preview of the records that will be exported.
    Used by the frontend to show a summary table before downloading.
    """

    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        start_date_str = request.query_params.get("start_date", "").strip()
        end_date_str = request.query_params.get("end_date", "").strip()
        travel_for = request.query_params.get("travel_for", "").strip().lower() or None

        # --- Validate inputs ---
        if not start_date_str or not end_date_str:
            return error_response(
                message="Both 'start_date' and 'end_date' query parameters are required.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        if travel_for and travel_for not in ("self", "guest"):
            return error_response(
                message="'travel_for' must be 'self' or 'guest'.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            start_date = _parse_date(start_date_str, "start_date")
            end_date = _parse_date(end_date_str, "end_date")
        except ValueError as exc:
            return error_response(message=str(exc), status_code=status.HTTP_400_BAD_REQUEST)

        if start_date > end_date:
            return error_response(
                message="'start_date' cannot be after 'end_date'.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            data = _fetch_applications(start_date, end_date, travel_for=travel_for)
        except Exception as exc:
            logger.error("Error fetching travel applications for preview: %s", exc, exc_info=True)
            return error_response(
                message="An unexpected error occurred while fetching data.",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        preview_items = [_build_preview_item(app, ft, lt) for app, ft, lt in data]

        # Status breakdown summary
        status_counts: dict = {}
        for app, _, _ in data:
            label = app.get_status_display()
            status_counts[label] = status_counts.get(label, 0) + 1

        return Response(
            {
                "success": True,
                "message": "Preview data fetched successfully.",
                "data": {
                    "total": len(preview_items),
                    "start_date": str(start_date),
                    "end_date": str(end_date),
                    "travel_for": travel_for,
                    "status_summary": status_counts,
                    "records": preview_items,
                },
            },
            status=status.HTTP_200_OK,
        )


class TravelApplicationExportView(APIView):
    """
    GET /api/travel/admin/export/?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD

    Streams an Excel (.xlsx) file containing travel applications
    whose earliest trip departure date falls within the given range.
    """

    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        start_date_str = request.query_params.get("start_date", "").strip()
        end_date_str = request.query_params.get("end_date", "").strip()
        travel_for = request.query_params.get("travel_for", "").strip().lower() or None
        is_consolidated = request.query_params.get("is_consolidated", "").lower() == "true"

        # --- Validate inputs ---
        if not start_date_str or not end_date_str:
            return error_response(
                message="Both 'start_date' and 'end_date' query parameters are required.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        if travel_for and travel_for not in ("self", "guest"):
            return error_response(
                message="'travel_for' must be 'self' or 'guest'.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            start_date = _parse_date(start_date_str, "start_date")
            end_date = _parse_date(end_date_str, "end_date")
        except ValueError as exc:
            return error_response(message=str(exc), status_code=status.HTTP_400_BAD_REQUEST)

        if start_date > end_date:
            return error_response(
                message="'start_date' cannot be after 'end_date'.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            data = _fetch_applications(start_date, end_date, travel_for=travel_for)
        except Exception as exc:
            logger.error("Error fetching travel applications for export: %s", exc, exc_info=True)
            return error_response(
                message="An unexpected error occurred while fetching data.",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        try:
            if is_consolidated:
                try:
                    from apps.master_data.models.geography import CityMaster
                    city_map = {c.id: c.city_name for c in CityMaster.objects.all()}
                except Exception:
                    city_map = {}
                rows = [_build_consolidated_row(app, ft, lt, city_map) for app, ft, lt in data]
                headers = [
                    "Travel Request ID", "Vertical", "IO Number", "GL Code", "Sanction Number", 
                    "Travel For", "Username", "Employee Name", "Gender", "Purpose", "Application Status", 
                    "Trip Origin", "Trip Destination", "Trip Start Date", "Trip End Date", "Trip Start Time", 
                    "Trip End Time", "Advance Amount (if opted)", "Ticket Details", "Accommodation Details", 
                    "Conveyance Details"
                ]
                widths = [22, 20, 16, 16, 16, 16, 20, 24, 12, 40, 24, 22, 22, 18, 18, 16, 16, 24, 45, 45, 45]
            else:
                rows = [_build_row(app, ft, lt) for app, ft, lt in data]
                headers = [
                    "Travel Request ID", "Travel For", "Username", "Employee Name", "Purpose",
                    "Application Status", "Trip Origin", "Trip Destination",
                    "Trip Start Date", "Trip Start Time", "Trip End Date", "Trip End Time"
                ]
                widths = [22, 16, 20, 24, 40, 24, 22, 22, 18, 16, 18, 16]

            excel_bytes = _generate_excel(rows, start_date, end_date, headers, widths)
        except Exception as exc:
            logger.error("Error generating Excel file: %s", exc, exc_info=True)
            return error_response(
                message="Failed to generate Excel file.",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        travel_for_label = f"_{travel_for.capitalize()}" if travel_for else ""
        filename = (
            f"Travel_Applications{travel_for_label}"
            f"_{start_date.strftime('%d%b%Y')}"
            f"_to_{end_date.strftime('%d%b%Y')}.xlsx"
        )

        response = HttpResponse(
            excel_bytes,
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        response["Access-Control-Expose-Headers"] = "Content-Disposition"
        return response
