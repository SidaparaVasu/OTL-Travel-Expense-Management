from datetime import date, datetime

from django.db.models import Max, Min, Q
from django.utils import timezone

from apps.travel.models.application import TravelApplication

SETTLEMENT_OVERDUE_EXPORT_HEADERS = [
    "Travel Request ID",
    "Employee Code",
    "Employee Name",
    "Employee Email",
    "Unit Location",
    "Department",
    "Designation",
    "Travel Purpose",
    "Travel Start Date",
    "Travel End Date",
    "Settlement Due Date",
    "Days Overdue",
    "Advance Amount",
    "Application Created At",
]


def get_settlement_overdue_base_queryset():
    """Completed travel with no claim and lapsed settlement window (excludes guest-only)."""
    today = timezone.now().date()
    return (
        TravelApplication.objects.filter(
            status="completed",
            settlement_due_date__isnull=False,
            settlement_due_date__lt=today,
            expense_claim__isnull=True,
        )
        .exclude(travel_for="guest")
        .select_related(
            "employee",
            "employee__organizational_profile",
            "employee__organizational_profile__department",
            "employee__organizational_profile__designation",
            "employee__organizational_profile__base_location",
        )
        .annotate(
            travel_start_date=Min("trip_details__departure_date"),
            travel_end_date=Max("trip_details__return_date"),
        )
        .order_by("-settlement_due_date", "-id")
    )


def apply_settlement_overdue_filters(queryset, *, location_id=None, search=None):
    if location_id:
        queryset = queryset.filter(
            employee__organizational_profile__base_location__location_id=location_id
        )

    if search:
        search = str(search).strip()
        if search:
            q = (
                Q(employee__first_name__icontains=search)
                | Q(employee__last_name__icontains=search)
                | Q(employee__username__icontains=search)
                | Q(employee__email__icontains=search)
                | Q(purpose__icontains=search)
            )
            if search.isdigit():
                q |= Q(id=int(search))
            queryset = queryset.filter(q)

    return queryset


def _format_date(value: date | None) -> str:
    if not value:
        return ""
    return value.strftime("%d-%b-%Y")


def _format_datetime(value: datetime | None) -> str:
    if not value:
        return ""
    if timezone.is_aware(value):
        value = timezone.localtime(value)
    return value.strftime("%d-%b-%Y %H:%M")


def serialize_settlement_overdue_row(app: TravelApplication, today: date | None = None) -> dict:
    today = today or timezone.now().date()
    employee = app.employee
    profile = getattr(employee, "organizational_profile", None)
    dept = profile.department if profile and profile.department_id else None
    designation = profile.designation if profile and profile.designation_id else None
    base_loc = profile.base_location if profile else None

    days_overdue = (
        (today - app.settlement_due_date).days if app.settlement_due_date else None
    )

    unit_location = base_loc.location_name if base_loc else None

    return {
        "travel_application_id": app.id,
        "travel_request_id": app.get_travel_request_id(),
        "employee_name": f"{employee.first_name} {employee.last_name}".strip()
        or employee.username,
        "employee_email": employee.email,
        "employee_code": profile.employee_code if profile else None,
        "department": dept.dept_name if dept else None,
        "designation": designation.designation_name if designation else None,
        "unit_location": unit_location,
        "branch_location": unit_location,
        "travel_purpose": app.purpose,
        "travel_start_date": _format_date(getattr(app, "travel_start_date", None)),
        "travel_end_date": _format_date(getattr(app, "travel_end_date", None)),
        "settlement_due_date": _format_date(app.settlement_due_date),
        "days_overdue": days_overdue,
        "advance_amount": float(app.advance_amount or 0),
        "application_created_at": _format_datetime(app.created_at),
    }


def settlement_overdue_row_to_excel(row: dict) -> list:
    return [
        row["travel_request_id"],
        row["employee_code"] or "",
        row["employee_name"],
        row["employee_email"] or "",
        row["unit_location"] or "",
        row["department"] or "",
        row["designation"] or "",
        row["travel_purpose"] or "",
        row["travel_start_date"] or "",
        row["travel_end_date"] or "",
        row["settlement_due_date"] or "",
        row["days_overdue"] if row["days_overdue"] is not None else "",
        row["advance_amount"],
        row["application_created_at"] or "",
    ]
