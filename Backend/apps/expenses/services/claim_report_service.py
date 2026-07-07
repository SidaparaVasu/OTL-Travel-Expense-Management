"""
Claim Report Service

Centralises queryset building, filtering, row serialisation, and Excel row
mapping for the Finance Claim Report feature.
"""
from __future__ import annotations

from datetime import date, datetime, time as dtime
from typing import Optional

from django.db.models import Q
from django.utils import timezone

from apps.expenses.models import ExpenseClaim

# ---------------------------------------------------------------------------
# Excel export column headers (order matters — must match claim_row_to_excel)
# ---------------------------------------------------------------------------
CLAIM_REPORT_EXPORT_HEADERS = [
    "Travel Request ID",
    "Travel Purpose",
    "Claim ID",
    "Employee Name",
    "Employee ID",
    "Employee Email ID",
    "Unit Location",
    "Department",
    "Trip Start Date & Time",
    "Origin Location",
    "Trip End Date & Time",
    "Destination Location",
    "Total DA (₹)",
    "Total Incidentals (₹)",
    "Total Booking Expenses (₹)",
    "Total Additional Expenses (₹)",
    "Advance Received (₹)",
    "Final Amount Payable (₹)",
    "Claim Status",
    "Claim Created On",
    "Claim Processed Date",
    "Processed By",
]


# ---------------------------------------------------------------------------
# Base queryset
# ---------------------------------------------------------------------------

def get_claim_report_base_queryset():
    """Return all claims with required related objects pre-fetched."""
    return (
        ExpenseClaim.objects.select_related(
            "employee",
            "employee__organizational_profile",
            "employee__organizational_profile__base_location",
            "employee__organizational_profile__department",
            "status",
            "travel_application",
        )
        .prefetch_related(
            "travel_application__trip_details__from_location",
            "travel_application__trip_details__to_location",
            "da_breakdown",
            "items",
            "finance_action_logs",
            "finance_action_logs__action_by",
        )
        .order_by("-created_on")
    )


# ---------------------------------------------------------------------------
# Filter helper
# ---------------------------------------------------------------------------

def apply_claim_report_filters(
    queryset,
    *,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    status_code: Optional[str] = None,
    location_id: Optional[int] = None,
    search: Optional[str] = None,
):
    """Apply Finance Claim Report filters to an existing queryset."""

    # Date range — filter by claim created_on date (finance reporting basis)
    if start_date:
        queryset = queryset.filter(created_on__date__gte=start_date)
    if end_date:
        queryset = queryset.filter(created_on__date__lte=end_date)

    # Claim status
    if status_code and status_code != "all":
        queryset = queryset.filter(status__code=status_code)

    # Unit / branch location
    if location_id:
        queryset = queryset.filter(
            employee__organizational_profile__base_location__location_id=location_id
        )

    # Full-text search
    if search:
        search = str(search).strip()
        if search:
            q = (
                Q(employee__first_name__icontains=search)
                | Q(employee__last_name__icontains=search)
                | Q(employee__username__icontains=search)
                | Q(employee__email__icontains=search)
            )
            if search.isdigit():
                q |= Q(id=int(search))
            else:
                # try to match travel_request_id pattern (TR-XXXX-YYYYNNNN)
                q |= Q(travel_application__travel_request_number__icontains=search)
            queryset = queryset.filter(q)

    return queryset


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _format_date(value) -> str:
    if not value:
        return ""
    if isinstance(value, str):
        return value
    return value.strftime("%d-%b-%Y")


def _format_datetime(dt_value: Optional[datetime]) -> str:
    if not dt_value:
        return ""
    if timezone.is_aware(dt_value):
        dt_value = timezone.localtime(dt_value)
    return dt_value.strftime("%d-%b-%Y %H:%M")


def _combine_datetime_str(date_val, time_val) -> str:
    """Return a formatted datetime string from separate date and time values."""
    if not date_val:
        return ""
    if time_val:
        dt = datetime.combine(date_val, time_val)
    else:
        dt = datetime.combine(date_val, dtime(0, 0))
    return dt.strftime("%d-%b-%Y %H:%M")


# ---------------------------------------------------------------------------
# Row serialisation
# ---------------------------------------------------------------------------

def serialize_claim_report_row(claim: ExpenseClaim) -> dict:
    """Return a flat dict representing one claim row for UI preview and export."""
    employee = claim.employee
    profile = getattr(employee, "organizational_profile", None)
    base_loc = profile.base_location if profile else None
    dept = profile.department if profile and profile.department_id else None

    employee_id = (
        getattr(profile, "employee_id", None)
        or getattr(profile, "employee_code", None)
        or employee.username
    )
    unit_location = base_loc.location_name if base_loc else None
    department_name = dept.dept_name if dept else None

    tr = claim.travel_application

    # ---- Trip dates: actual (if provided) else approved schedule ----
    if claim.actual_travel_start_date:
        trip_start_str = _combine_datetime_str(
            claim.actual_travel_start_date, claim.actual_travel_start_time
        )
        trip_end_str = _combine_datetime_str(
            claim.actual_travel_end_date, claim.actual_travel_end_time
        )
    elif tr:
        first_trip = tr.trip_details.order_by("departure_date").first()
        last_trip = tr.trip_details.order_by("-return_date").first()
        trip_start_str = (
            _combine_datetime_str(first_trip.departure_date, getattr(first_trip, "start_time", None))
            if first_trip
            else ""
        )
        trip_end_str = (
            _combine_datetime_str(last_trip.return_date, getattr(last_trip, "end_time", None))
            if last_trip
            else ""
        )
    else:
        trip_start_str = ""
        trip_end_str = ""

    # ---- Origin / Destination ----
    if tr:
        first_trip = tr.trip_details.order_by("departure_date").first()
        last_trip = tr.trip_details.order_by("-return_date").first()
        origin = (
            getattr(first_trip.from_location, "city_name", None)
            or str(first_trip.from_location)
            if first_trip and first_trip.from_location
            else None
        )
        destination = (
            getattr(last_trip.to_location, "city_name", None)
            or str(last_trip.to_location)
            if last_trip and last_trip.to_location
            else None
        )
    else:
        origin = None
        destination = None

    # ---- Expense breakdown ----
    booking_total = sum(
        float(i.amount) for i in claim.items.all() if i.is_booking_expense
    )
    additional_total = sum(
        float(i.amount) for i in claim.items.all() if not i.is_booking_expense
    )

    # ---- DA Breakdown ----
    da_breakdown = [
        {
            "date": _format_date(entry.date),
            "hours": float(entry.hours),
            "da": float(entry.eligible_da),
            "incidental": float(entry.eligible_incidental),
        }
        for entry in claim.da_breakdown.order_by("date")
    ]

    # ---- Processed details ----
    processed_date_str = ""
    processed_by_name = ""
    if claim.status and claim.status.code == "paid":
        processed_date_str = _format_datetime(claim.paid_on)
        # Scan prefetched action logs to avoid database hit
        paid_log = None
        for log in claim.finance_action_logs.all():
            if log.new_status_code == "paid":
                paid_log = log
                break
        if paid_log:
            processed_by_name = paid_log.action_by.get_full_name() or paid_log.action_by.username

    return {
        "claim_id": claim.id,
        "travel_request_id": tr.get_travel_request_id() if tr else None,
        "travel_purpose": tr.purpose if tr else "",
        "employee_name": employee.get_full_name() or employee.username,
        "employee_id": employee_id,
        "employee_email": employee.email,
        "unit_location": unit_location,
        "department": department_name,
        "trip_start": trip_start_str,
        "origin": origin,
        "trip_end": trip_end_str,
        "destination": destination,
        "total_da": float(claim.total_da or 0),
        "total_incidental": float(claim.total_incidental or 0),
        "total_booking_expenses": booking_total,
        "total_additional_expenses": additional_total,
        "total_expenses": float(claim.total_expenses or 0),
        "advance_received": float(claim.advance_received or 0),
        "final_amount_payable": float(claim.final_amount_payable or 0),
        "status_code": claim.status.code if claim.status else None,
        "status_label": "Processed" if claim.status and claim.status.code == "paid" else (claim.status.label if claim.status else None),
        "created_on": _format_datetime(claim.created_on),
        "da_breakdown": da_breakdown,
        "processed_date": processed_date_str,
        "processed_by": processed_by_name,
    }


# ---------------------------------------------------------------------------
# Excel row mapper
# ---------------------------------------------------------------------------

def claim_row_to_excel(row: dict) -> list:
    """Return an ordered list of values matching CLAIM_REPORT_EXPORT_HEADERS."""
    return [
        row.get("travel_request_id") or "",
        row.get("travel_purpose") or "",
        row.get("claim_id") or "",
        row.get("employee_name") or "",
        row.get("employee_id") or "",
        row.get("employee_email") or "",
        row.get("unit_location") or "",
        row.get("department") or "",
        row.get("trip_start") or "",
        row.get("origin") or "",
        row.get("trip_end") or "",
        row.get("destination") or "",
        row.get("total_da", 0),
        row.get("total_incidental", 0),
        row.get("total_booking_expenses", 0),
        row.get("total_additional_expenses", 0),
        row.get("advance_received", 0),
        row.get("final_amount_payable", 0),
        row.get("status_label") or "",
        row.get("created_on") or "",
        row.get("processed_date") or "",
        row.get("processed_by") or "",
    ]
