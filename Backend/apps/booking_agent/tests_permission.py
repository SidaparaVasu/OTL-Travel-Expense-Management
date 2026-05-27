"""
Test suite to verify that:
1. Assigned booking agents have access to the Travel Application details page and report.
2. Unassigned booking agents are rejected (403 Forbidden).
3. Normal employees/users who are not part of the workflow are rejected (403 Forbidden).

Run using:
  docker exec dev_backend python apps/booking_agent/tests_permission.py
"""

import os
import sys
import django

# Remove the script's directory (apps/booking_agent) from sys.path to prevent 
# collision between local apps.py and the global apps/ package.
for path in list(sys.path):
    if path.endswith('booking_agent'):
        sys.path.remove(path)

# Ensure the project root is on sys.path
_project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Main.settings')
django.setup()

import datetime
from unittest.mock import patch
from django.utils import timezone
from rest_framework.test import APIClient
from apps.authentication.models import User, BookingAgentProfile, OrganizationalProfile
from apps.travel.models import TravelApplication, TripDetails, Booking, BookingAssignment
from apps.master_data.models import TravelModeMaster, LocationMaster
from apps.master_data.models.geography import CityMaster
from apps.booking_agent.models import ProfileTypeMaster, BookingAgentService

# Test helpers and assertion state
passed = 0
failed = 0
failures = []

def check(description, result, expected):
    global passed, failed
    ok = result == expected
    status = "✓ PASS" if ok else "✗ FAIL"
    print(f"{status} | {description}")
    if not ok:
        print(f"       Expected: {expected!r}, Got: {result!r}")
        failed += 1
        failures.append((description, expected, result))
    else:
        passed += 1

# Setup test database objects
try:
    print("--- Setting up test users, location, and travel application ---")
    
    # 1. Clean up existing test users if they exist
    User.objects.filter(username__in=["test_emp", "test_agt_1", "test_agt_2", "test_agt_3", "normal_user"]).delete()
    
    # Get or create a base location
    location = LocationMaster.objects.filter(is_active=True).first()
    if not location:
        location = LocationMaster.objects.create(
            city_name="Test City",
            is_active=True
        )

    # Get or create a city for TripDetails
    city = CityMaster.objects.first()
    if not city:
        city = CityMaster.objects.create(
            city_code="TST",
            city_name="Test City"
        )

    # Get or create Profile Type Masters
    pt_flight_train, _ = ProfileTypeMaster.objects.get_or_create(
        code="flight_train_agent",
        defaults={"name": "Flight and Train Booking Agent", "is_active": True}
    )
    pt_hotel, _ = ProfileTypeMaster.objects.get_or_create(
        code="hotel_agent",
        defaults={"name": "Hotel Booking Agent", "is_active": True}
    )

    # 2. Create Employee
    test_emp = User.objects.create_user(
        username="test_emp",
        email="test_emp@example.com",
        password="testpassword",
        user_type="internal",
        is_active=True
    )
    OrganizationalProfile.objects.create(
        user=test_emp,
        base_location=location
    )

    # 3. Create Assigned Booking Agent 1 (flight_train_agent)
    test_agt_1 = User.objects.create_user(
        username="test_agt_1",
        email="test_agt_1@example.com",
        password="testpassword",
        user_type="external",
        is_active=True
    )
    agt_profile_1 = BookingAgentProfile.objects.create(
        user=test_agt_1,
        organization_name="Agent Org 1",
        is_active=True
    )
    BookingAgentService.objects.create(
        booking_agent_profile=agt_profile_1,
        profile_type=pt_flight_train,
        is_active=True
    )

    # 4. Create Assigned Booking Agent 2 (hotel_agent)
    test_agt_2 = User.objects.create_user(
        username="test_agt_2",
        email="test_agt_2@example.com",
        password="testpassword",
        user_type="external",
        is_active=True
    )
    agt_profile_2 = BookingAgentProfile.objects.create(
        user=test_agt_2,
        organization_name="Agent Org 2",
        is_active=True
    )
    BookingAgentService.objects.create(
        booking_agent_profile=agt_profile_2,
        profile_type=pt_hotel,
        is_active=True
    )

    # 5. Create Unassigned Booking Agent 3 (flight_train_agent)
    test_agt_3 = User.objects.create_user(
        username="test_agt_3",
        email="test_agt_3@example.com",
        password="testpassword",
        user_type="external",
        is_active=True
    )
    agt_profile_3 = BookingAgentProfile.objects.create(
        user=test_agt_3,
        organization_name="Agent Org 3",
        is_active=True
    )
    BookingAgentService.objects.create(
        booking_agent_profile=agt_profile_3,
        profile_type=pt_flight_train,
        is_active=True
    )

    # 6. Create Travel Application
    travel_app = TravelApplication.objects.create(
        employee=test_emp,
        purpose="Client Billing Processing Test",
        travel_for="self",
        status="approved"
    )

    # 7. Create TripDetails
    trip = TripDetails.objects.create(
        travel_application=travel_app,
        from_location=city,
        to_location=city,
        departure_date=timezone.now().date(),
        return_date=timezone.now().date() + datetime.timedelta(days=2)
    )

    # 8. Create Bookings
    mode = TravelModeMaster.objects.filter(is_active=True).first()
    if not mode:
        mode = TravelModeMaster.objects.create(
            name="Flight",
            is_active=True
        )
        
    booking = Booking.objects.create(
        trip_details=trip,
        booking_type=mode,
        status="requested"
    )
    booking2 = Booking.objects.create(
        trip_details=trip,
        booking_type=mode,
        status="requested"
    )

    # 9. Assign Booking to Agent 1 and Booking 2 to Agent 2
    BookingAssignment.objects.create(
        booking=booking,
        assigned_to=test_agt_1,
        assigned_by=test_emp,
        assignment_scope="single_booking"
    )
    BookingAssignment.objects.create(
        booking=booking2,
        assigned_to=test_agt_2,
        assigned_by=test_emp,
        assignment_scope="single_booking"
    )
    
    print("Setup completed successfully.")

except Exception as e:
    print(f"✗ Setup failed: {e}")
    sys.exit(1)

# ─────────────────────────────────────────────
# Run Permission API Tests
# ─────────────────────────────────────────────
print("\n=== Running API Permission Tests ===")

client = APIClient()

# Test 1: Assigned Agent with correct profile type (test_agt_1) can fetch Travel Application Details
client.force_authenticate(user=test_agt_1)
res_details_1 = client.get(f"/api/travel/applications/{travel_app.id}/details/")
check("Assigned Agent (flight_train_agent) details request returns 200 OK", res_details_1.status_code, 200)
check("Assigned Agent retrieves correct Travel Application Purpose", res_details_1.data.get("data", {}).get("application", {}).get("purpose"), travel_app.purpose)

# Test 2: Assigned Agent with incorrect profile type (test_agt_2) CANNOT fetch Travel Application Details
client.force_authenticate(user=test_agt_2)
res_details_2 = client.get(f"/api/travel/applications/{travel_app.id}/details/")
check("Assigned Agent (hotel_agent) details request returns 403 Forbidden", res_details_2.status_code, 403)

# Test 3: Unassigned Agent with correct profile type (test_agt_3) CANNOT fetch Travel Application Details
client.force_authenticate(user=test_agt_3)
res_details_3 = client.get(f"/api/travel/applications/{travel_app.id}/details/")
check("Unassigned Agent (flight_train_agent) details request returns 403 Forbidden", res_details_3.status_code, 403)

# Test 4: Assigned Agent with correct profile type (test_agt_1) can download PDF Travel Report
client.force_authenticate(user=test_agt_1)
with patch('apps.travel.reports.travel_details_report.TravelDetailsReport.generate', return_value=b"dummy pdf report"):
    res_report_1 = client.get(f"/api/travel/applications/{travel_app.id}/report/")
check("Assigned Agent (flight_train_agent) report download returns 200 OK", res_report_1.status_code, 200)
check("Assigned Agent report download returns application/pdf content type", res_report_1.headers.get("Content-Type"), "application/pdf")

# Test 5: Assigned Agent with incorrect profile type (test_agt_2) CANNOT download PDF Travel Report
client.force_authenticate(user=test_agt_2)
res_report_2 = client.get(f"/api/travel/applications/{travel_app.id}/report/")
check("Assigned Agent (hotel_agent) report download returns 403 Forbidden", res_report_2.status_code, 403)

# Test 6: Unassigned Agent with correct profile type (test_agt_3) CANNOT download PDF Travel Report
client.force_authenticate(user=test_agt_3)
res_report_3 = client.get(f"/api/travel/applications/{travel_app.id}/report/")
check("Unassigned Agent (flight_train_agent) report download returns 403 Forbidden", res_report_3.status_code, 403)

# Test 7: Normal unassigned Employee (not in workflow) CANNOT fetch Details
normal_user = User.objects.create_user(
    username="normal_user",
    email="normal@example.com",
    password="testpassword",
    user_type="internal",
    is_active=True
)
OrganizationalProfile.objects.create(
    user=normal_user,
    base_location=location
)
client.force_authenticate(user=normal_user)
res_details_4 = client.get(f"/api/travel/applications/{travel_app.id}/details/")
check("Normal employee details request returns 403 Forbidden", res_details_4.status_code, 403)

# Cleanup database
print("\n--- Cleaning up test data ---")
User.objects.filter(username__in=["test_emp", "test_agt_1", "test_agt_2", "test_agt_3", "normal_user"]).delete()
travel_app.delete()

# Test results summary
print()
print("=" * 70)
print(f"RESULTS: {passed} passed, {failed} failed out of {passed + failed} tests")
print("=" * 70)

if failures:
    print("\nFAILED TESTS DETAILS:")
    for desc, expected, actual in failures:
        print(f"  • {desc}")
        print(f"    Expected: {expected!r}, Got: {actual!r}")

sys.exit(0 if failed == 0 else 1)
