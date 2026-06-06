import os
import logging
import time
from datetime import datetime
from django.conf import settings
from django.shortcuts import get_object_or_404
from django.db.models import Q, Sum
from apps.expenses.models import ExpenseClaim, ExpenseItem, DAIncidentalBreakdown, ClaimApprovalFlow
from apps.expenses.serializers import ClaimDetailSerializer
from apps.travel.reports.base_report import BaseReport, TravelReportMixin
from django.utils.asyncio import async_unsafe

logger = logging.getLogger(__name__)

class ClaimDetailsReport(BaseReport):
    """
    Report class for generating Claim Application Details PDF.
    """
    
    def __init__(self, claim_id):
        self.claim_id = claim_id
        super().__init__()

    def get_template_name(self) -> str:
        # Use simple template like travel application report
        return "expenses/reports/claim_details_report.html"

    @async_unsafe
    def get_context_data(self):
        logger.info(f"[{self.claim_id}] PERFORMANCE LOG: Before Claim DB fetch")
        start_time = time.time()
        
        claim = get_object_or_404(
            ExpenseClaim.objects.select_related("employee", "status", "travel_application"), 
            pk=self.claim_id
        )
        logger.info(f"[{self.claim_id}] PERFORMANCE LOG: Claim DB fetch took {time.time() - start_time:.4f}s")

        serializer = ClaimDetailSerializer(claim)
        data = serializer.data
        
        logger.info(f"[{self.claim_id}] PERFORMANCE LOG: After serializer (Total context prep took {time.time() - start_time:.4f}s)")
        return self._prepare_report_context(claim, data)

    def _prepare_report_context(self, claim, serialized_data):
        """
        Maps serialized data and model instance to the flat context structure.
        """
        employee = claim.employee
        # Organizational profile for extra employee data (same as travel report)
        from apps.authentication.models.profiles import OrganizationalProfile
        profile = OrganizationalProfile.objects.filter(user=employee).first()

        # Employee fields: Department, Designation, Grade, ID
        def get_attr(source, attr, nested_attr=None):
            if not source: return None
            val = getattr(source, attr, None)
            if val and nested_attr:
                return getattr(val, nested_attr, None)
            return val

        employee_id = get_attr(profile, 'employee_id') or employee.username
        grade = get_attr(profile, 'grade', 'name') or ""
        department = get_attr(profile, 'department', 'dept_name') or ""
        designation = get_attr(profile, 'designation', 'designation_name') or ""

        # Trip overview from Travel Application
        tr = claim.travel_application
        
        # Determine Trip Dates (Actual vs Original)
        from datetime import time as dtime
        if claim.actual_travel_start_date and claim.actual_travel_end_date:
            start_dt = datetime.combine(claim.actual_travel_start_date, claim.actual_travel_start_time or dtime(0,0))
            end_dt = datetime.combine(claim.actual_travel_end_date, claim.actual_travel_end_time or dtime(0,0))
            dates_str = f"{start_dt.strftime('%d/%m/%Y %I:%M %p')} to {end_dt.strftime('%d/%m/%Y %I:%M %p')} (Actual)"
        elif tr:
            # Try to get times from trip details
            first_trip = tr.trip_details.order_by('departure_date', 'start_time').first()
            last_trip = tr.trip_details.order_by('-return_date', '-end_time').first()
            if first_trip and last_trip:
                s_dt = datetime.combine(first_trip.departure_date, first_trip.start_time or dtime(0,0))
                e_dt = datetime.combine(last_trip.return_date, last_trip.end_time or dtime(0,0))
                dates_str = f"{s_dt.strftime('%d/%m/%Y %I:%M %p')} to {e_dt.strftime('%d/%m/%Y %I:%M %p')}"
            else:
                dates_str = f"{tr.get_travel_start_date()} to {tr.get_travel_end_date()}"
        else:
            dates_str = "N/A"

        trip_overview = {
            "purpose": tr.purpose if tr else "N/A",
            "travel_type": tr.get_travel_for_display() if tr else "N/A",
            "internal_order": tr.internal_order if tr else "N/A",
            "cost_center_gl": tr.general_ledger.gl_code if tr and tr.general_ledger else "N/A",
            "sanction_number": tr.sanction_number if tr else "N/A",
            "dates": dates_str
        }

        # Expense Grouping: Booking vs Other
        booking_expenses = claim.items.filter(is_booking_expense=True).aggregate(total=Sum('amount'))['total'] or 0
        other_expenses = claim.items.filter(is_booking_expense=False).aggregate(total=Sum('amount'))['total'] or 0

        # Approval history (excluding audit timeline)
        approvals = []
        for flow in claim.approval_flow.order_by('level', 'acted_on').all():
            approvals.append({
                "level": f"Step {flow.level}",
                "approver": flow.approver.get_full_name(),
                "status": flow.status.title(),
                "remarks": flow.remarks,
                "acted_on": flow.acted_on.strftime("%d/%m/%Y %I:%M %p") if flow.acted_on else "N/A"
            })

        # Financial Summary Calculation
        total_expenses_val = float(claim.total_expenses)
        total_da_val = float(claim.total_da)
        total_incidental_val = float(claim.total_incidental)
        gross_total_val = total_expenses_val + total_da_val + total_incidental_val
        advance_received_val = float(claim.advance_received)
        final_amount_val = float(claim.final_amount_payable)

        def fmt_curr(val):
            try:
                return f"₹{float(val):,.2f}"
            except (ValueError, TypeError):
                return "₹0.00"

        context = {
            "header": {
                "travel_request_id": tr.get_travel_request_id() if tr else "N/A",
                "status": claim.status.label if claim.status else "N/A",
                "created_on": claim.created_on.strftime("%d/%m/%Y %I:%M %p") if claim.created_on else "N/A",
                "generated_on": datetime.now().strftime("%d/%m/%Y %I:%M %p")
            },
            "employee": {
                "name": employee.get_full_name(),
                "employee_id": employee_id,
                "email": employee.email,
                "mobile": getattr(employee, 'mobile_number', 'N/A'),
                "department": department,
                "designation": designation,
                "grade": grade,
                "branch_location": getattr(employee, 'location', 'N/A')
            },
            "trip": trip_overview,
            "items": [
                {
                    "date": item['expense_date'],
                    "type": item['expense_type_display'],
                    "bill": item.get('bill_number', ''),
                    "amount": fmt_curr(item['amount']),
                    "is_booking": "Yes" if item.get('is_booking_expense') else "No",
                    "receipt": "Yes" if item.get('has_receipt') else "No",
                    "receipt_url": item.get('receipt_file', ''),
                    "remarks": item.get('remarks', '')
                } for item in serialized_data['items']
            ],
            "da_breakdown": [
                {
                    "date": day['date'],
                    "hours": day['hours'],
                    "da": fmt_curr(day['eligible_da']),
                    "incidental": fmt_curr(day['eligible_incidental']),
                } for day in serialized_data['da_breakdown']
            ],
            "approvals": approvals,
            "financial_summary": {
                "booking_expenses": fmt_curr(booking_expenses),
                "other_expenses": fmt_curr(other_expenses),
                "total_da": fmt_curr(total_da_val),
                "total_incidental": fmt_curr(total_incidental_val),
                "gross_total": fmt_curr(gross_total_val),
                "advance_received": fmt_curr(advance_received_val),
                "final_amount": fmt_curr(final_amount_val)
            }
        }
        return context

def generate_claim_details_report(claim_id):
    """
    Direct function call for generating Claim Details PDF bytes.
    """
    report = ClaimDetailsReport(claim_id)
    return report.generate()
