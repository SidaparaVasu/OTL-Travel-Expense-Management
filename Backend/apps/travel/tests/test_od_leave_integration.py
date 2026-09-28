"""
Comprehensive Test Suite for OD Leave Integration with HRMS Leave Module.

Scenarios tested:
  1. Standard Approval: Confirms OD Leave for self-travel (cmpId=1).
  2. Auto/Self-Approval: Confirms OD Leave immediately upon submission.
  3. Date Edit: Deletes prior approved leave on date change, allows re-approval with new dates.
  4. Non-Date Edit: Preserves active leave if trip dates did not change.
  5. Application Cancellation: Automatically deletes approved leave in HRMS.
  6. Guest Travel: Skips OD leave when travel_for == 'guest'.
  7. Missing HRMS ID: Gracefully skips without crashing.
  8. Flexible Approval ID extraction: Handles various HRMS JSON response formats.

Run via Docker:
  docker exec dev_backend python apps/travel/tests/test_od_leave_integration.py
"""

import os
import sys
import django

# Setup django environment
_project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Main.settings')
django.setup()

import datetime
from django.utils import timezone
from apps.authentication.models import User, OrganizationalProfile
from apps.master_data.models import CompanyInformation, CityMaster
from apps.travel.models import TravelApplication, TripDetails, TravelApprovalFlow, HRMSLeaveRecord
from apps.travel.services.hrms_leave_service import HRMSLeaveService

# ─────────────────────────────────────────────
# Test Tracking Helpers
# ─────────────────────────────────────────────
passed = 0
failed = 0
failures = []

def check(description, condition, extra_info=""):
    global passed, failed
    status = "✓ PASS" if condition else "✗ FAIL"
    print(f"{status} | {description}")
    if not condition:
        if extra_info:
            print(f"       Info: {extra_info}")
        failed += 1
        failures.append((description, extra_info))
    else:
        passed += 1

print("\n=======================================================")
print("  OD LEAVE INTEGRATION - END-TO-END TEST SUITE")
print("=======================================================\n")

# ─────────────────────────────────────────────
# Test Fixtures Setup
# ─────────────────────────────────────────────
# Ensure company with ID 1 exists
company, _ = CompanyInformation.objects.get_or_create(
    id=1,
    defaults={'name': 'TSF Test Company', 'address': 'Test', 'pincode': '123456'}
)

# Test City
city = CityMaster.objects.first()

# Test Traveler User (empId=10101)
traveler, _ = User.objects.get_or_create(
    username='test_od_traveler',
    defaults={
        'email': 'traveler@test.com',
        'first_name': 'Test',
        'last_name': 'Traveler',
        'hrms_id': 10101,
        'is_active': True
    }
)
traveler.hrms_id = 10101
traveler.save(update_fields=['hrms_id'])

# Test Manager User (empId=20202)
manager, _ = User.objects.get_or_create(
    username='test_od_manager',
    defaults={
        'email': 'manager@test.com',
        'first_name': 'Test',
        'last_name': 'Manager',
        'hrms_id': 20202,
        'is_active': True
    }
)
manager.hrms_id = 20202
manager.save(update_fields=['hrms_id'])

# Org Profile setup
profile, _ = OrganizationalProfile.objects.get_or_create(
    user=traveler,
    defaults={'company': company, 'reporting_manager': manager}
)
profile.company = company
profile.reporting_manager = manager
profile.save(update_fields=['company', 'reporting_manager'])

# ─────────────────────────────────────────────
# SCENARIO 1: Standard Approval Flow (Self Travel)
# ─────────────────────────────────────────────
print("\n--- [Scenario 1] Standard Approval Flow (Self Travel) ---")
app1 = TravelApplication.objects.create(
    employee=traveler,
    travel_for='self',
    purpose='Project Inspection',
    status='pending_manager'
)
trip1 = TripDetails.objects.create(
    travel_application=app1,
    from_location=city,
    to_location=city,
    departure_date=datetime.date(2026, 10, 1),
    return_date=datetime.date(2026, 10, 5),
    start_time=datetime.time(9, 0),
    end_time=datetime.time(18, 0),
    no_bookings_required=True
)
flow1 = TravelApprovalFlow.objects.create(
    travel_application=app1,
    approver=manager,
    approval_level='manager',
    sequence=1,
    status='pending'
)

# Simulate manager approval
app1.update_status_after_approval(flow1)

rec1 = app1.hrms_leave_records.filter(status='ACTIVE').first()
check("Leave record created on final approval", rec1 is not None)
if rec1:
    check("Leave record status is ACTIVE", rec1.status == 'ACTIVE')
    check("From date matches departure date", rec1.from_date == datetime.date(2026, 10, 1))
    check("To date matches return date", rec1.to_date == datetime.date(2026, 10, 5))
    check("Leave period is 5 days", rec1.leave_period == 5)
    check("Approval ID is assigned", rec1.leave_approval_id is not None)
    check("Payload cmpId is 1", rec1.request_payload.get('cmpId') == 1)
    check("Payload empId is 10101", rec1.request_payload.get('empId') == 10101)
    check("Payload sEmpId is 20202", rec1.request_payload.get('sEmpId') == 20202)

# ─────────────────────────────────────────────
# SCENARIO 2: Auto / Self-Approval Flow
# ─────────────────────────────────────────────
print("\n--- [Scenario 2] Auto / Self-Approval Flow ---")
app2 = TravelApplication.objects.create(
    employee=traveler,
    travel_for='self_guest',
    purpose='Executive Conference',
    status='draft',
    self_approved=True
)
trip2 = TripDetails.objects.create(
    travel_application=app2,
    from_location=city,
    to_location=city,
    departure_date=datetime.date(2026, 11, 10),
    return_date=datetime.date(2026, 11, 12),
    start_time=datetime.time(10, 0),
    end_time=datetime.time(20, 0),
    no_bookings_required=True
)

# Trigger approve_od_leave as done in TravelApplicationSubmitView
rec2 = HRMSLeaveService.approve_od_leave(app2, approver=traveler)
check("Leave record created on self-approval", rec2 is not None)
if rec2:
    check("Self-approval leave record is ACTIVE", rec2.status == 'ACTIVE')
    check("Self-approval leave period is 3 days", rec2.leave_period == 3)
    check("Payload sEmpId falls back to traveler when self-approving", rec2.request_payload.get('sEmpId') == 10101)

# ─────────────────────────────────────────────
# SCENARIO 3: Date Edit Flow (Delete old, Re-approve new)
# ─────────────────────────────────────────────
print("\n--- [Scenario 3] Date Edit Flow (Delete old, Re-approve new) ---")
# Modify trip dates on app1
trip1.return_date = datetime.date(2026, 10, 8)
trip1.save(update_fields=['return_date'])

# Trigger delete_approved_leave as done in TravelApplicationViewSet.update
del_success = HRMSLeaveService.delete_approved_leave(app1, user=traveler)
check("DeleteApprovedLeave triggered on date change", del_success is True)

rec1.refresh_from_db()
check("Prior leave record marked as DELETED", rec1.status == 'DELETED')

# Simulate re-approval after resubmission
rec1_new = HRMSLeaveService.approve_od_leave(app1, approver=manager)
check("New leave record created for updated dates", rec1_new is not None and rec1_new.id != rec1.id)
if rec1_new:
    check("New leave record is ACTIVE", rec1_new.status == 'ACTIVE')
    check("New leave to_date is updated to 2026-10-08", rec1_new.to_date == datetime.date(2026, 10, 8))
    check("New leave period is updated to 8 days", rec1_new.leave_period == 8)

# ─────────────────────────────────────────────
# SCENARIO 4: Non-Date Edit (Minor Edit)
# ─────────────────────────────────────────────
print("\n--- [Scenario 4] Non-Date Edit (Minor Edit) ---")
app1.purpose = "Updated Purpose: Revised Inspection"
app1.save(update_fields=['purpose'])

# Active leave should remain intact
active_leaves = app1.hrms_leave_records.filter(status='ACTIVE')
check("Active leave record preserved on minor edit", active_leaves.count() == 1)

# ─────────────────────────────────────────────
# SCENARIO 5: Application Cancellation Flow
# ─────────────────────────────────────────────
print("\n--- [Scenario 5] Application Cancellation Flow ---")
app1._perform_hard_cancel(cancelled_by=traveler, reason="Client meeting rescheduled")
rec1_new.refresh_from_db()
check("Leave record marked DELETED upon cancellation", rec1_new.status == 'DELETED')
check("Application status is cancelled", app1.status == 'cancelled')

# ─────────────────────────────────────────────
# SCENARIO 6: Guest Travel Exclusion
# ─────────────────────────────────────────────
print("\n--- [Scenario 6] Guest Travel Exclusion (travel_for='guest') ---")
app_guest = TravelApplication.objects.create(
    employee=traveler,
    travel_for='guest',
    purpose='Vendor Travel',
    status='pending_manager'
)
TripDetails.objects.create(
    travel_application=app_guest,
    from_location=city,
    to_location=city,
    departure_date=datetime.date(2026, 12, 1),
    return_date=datetime.date(2026, 12, 3),
    no_bookings_required=True
)
guest_rec = HRMSLeaveService.approve_od_leave(app_guest, approver=manager)
check("No leave record created for guest travel", guest_rec is None)
check("hrms_leave_records count is 0 for guest TR", app_guest.hrms_leave_records.count() == 0)

# ─────────────────────────────────────────────
# SCENARIO 7: Missing HRMS ID Handling
# ─────────────────────────────────────────────
print("\n--- [Scenario 7] Missing HRMS ID Handling ---")
no_hrms_user, _ = User.objects.get_or_create(
    username='no_hrms_user',
    defaults={'email': 'nohrms@test.com', 'hrms_id': None, 'is_active': True}
)
app_no_hrms = TravelApplication.objects.create(
    employee=no_hrms_user,
    travel_for='self',
    purpose='No HRMS Test',
    status='pending_manager'
)
TripDetails.objects.create(
    travel_application=app_no_hrms,
    from_location=city,
    to_location=city,
    departure_date=datetime.date(2026, 12, 1),
    return_date=datetime.date(2026, 12, 3),
    no_bookings_required=True
)
no_hrms_rec = HRMSLeaveService.approve_od_leave(app_no_hrms, approver=manager)
check("Gracefully skipped when employee has no hrms_id", no_hrms_rec is None)

# ─────────────────────────────────────────────
# SCENARIO 8: Flexible Approval ID Extraction
# ─────────────────────────────────────────────
print("\n--- [Scenario 8] Flexible Approval ID Extraction ---")
extract = HRMSLeaveService._extract_approval_id
check("Direct int extraction", extract(54321) == 54321)
check("String int extraction", extract("54321") == 54321)
check("Dict leaveApprovalId extraction", extract({"leaveApprovalId": 9876}) == 9876)
check("Dict Leave_Approval_ID extraction", extract({"Leave_Approval_ID": "6543"}) == 6543)
check("Nested dict extraction", extract({"status": "success", "data": {"leaveApprovalId": 1122}}) == 1122)
check("Nested data with int value", extract({"status": "success", "data": 3344}) == 3344)

# ─────────────────────────────────────────────
# Cleanup Test Records
# ─────────────────────────────────────────────
app1.delete()
app2.delete()
app_guest.delete()
app_no_hrms.delete()

print("\n=======================================================")
print(f"  TEST RESULTS: {passed} PASSED | {failed} FAILED")
print("=======================================================\n")

if failed > 0:
    print("Failures:")
    for desc, info in failures:
        print(f"  - {desc}: {info}")
    sys.exit(1)
else:
    print("All integration scenarios PASSED successfully without bugs!\n")
    sys.exit(0)
