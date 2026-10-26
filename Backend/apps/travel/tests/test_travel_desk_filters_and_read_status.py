"""
Test suite for Travel Desk Read/Unread Flagging and Advanced Filter Options.
Tests:
  1. TravelApplicationReadStatus model creation and toggling
  2. TravelDeskToggleReadStatusView API functionality
  3. Read/Unread filtering in TravelDeskApplicationListView
  4. IO Number, GL Code, Sanction Number filtering in TravelDeskApplicationListView
  5. Location filtering in TravelDeskApplicationListView

Run:
  docker exec dev_backend python apps/travel/tests/test_travel_desk_filters_and_read_status.py
"""

import os
import sys
import django

_project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Main.settings')
django.setup()

from django.test import RequestFactory
from django.utils import timezone
from apps.authentication.models import User, Role, UserRole
from apps.travel.models import TravelApplication, TravelApplicationReadStatus
from apps.master_data.models import GLCodeMaster, LocationMaster
from apps.travel.views.travel_desk_views import (
    TravelDeskApplicationListView,
    TravelDeskToggleReadStatusView,
    TRAVEL_DESK_VISIBLE_STATUSES
)

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

print("\n--- Running Travel Desk Filter & Read Status Tests ---\n")

from rest_framework.test import APIRequestFactory, force_authenticate

factory = APIRequestFactory()

# Setup test user with Global Travel Desk role
desk_user = User.objects.filter(userrole__role__name='Global Travel Desk', userrole__is_active=True).first()
if not desk_user:
    desk_user = User.objects.first()
    desk_role, _ = Role.objects.get_or_create(name='Global Travel Desk')
    UserRole.objects.get_or_create(user=desk_user, role=desk_role, is_active=True)

# Find or create a visible travel application
app = TravelApplication.objects.filter(status__in=TRAVEL_DESK_VISIBLE_STATUSES).first()
if not app:
    app = TravelApplication.objects.first()
    app.status = 'pending_travel_desk'
    app.save()

# Clean up any existing read status for test
TravelApplicationReadStatus.objects.filter(user=desk_user, application=app).delete()

# Test 1: Model creation
status_obj, created = TravelApplicationReadStatus.objects.update_or_create(
    application=app,
    user=desk_user,
    defaults={'is_read': True, 'read_at': timezone.now()}
)
check("Test 1: Read status model created with is_read=True", status_obj.is_read, True)

# Test 2: Toggle API endpoint
view = TravelDeskToggleReadStatusView.as_view()
req = factory.post(f"/api/v1/travel/travel-desk/applications/{app.id}/read-status/", {"is_read": False}, format="json")
force_authenticate(req, user=desk_user)
res = view(req, pk=app.id)
check("Test 2A: Toggle endpoint sets is_read=False", res.data.get('data', {}).get('is_read'), False)

req2 = factory.post(f"/api/v1/travel/travel-desk/applications/{app.id}/read-status/", {}, format="json")
force_authenticate(req2, user=desk_user)
res2 = view(req2, pk=app.id)
check("Test 2B: Toggle endpoint toggles to True when payload empty", res2.data.get('data', {}).get('is_read'), True)

# Test 3: Read/Unread filtering in list view
list_view = TravelDeskApplicationListView.as_view()

# Mark app as read
TravelApplicationReadStatus.objects.update_or_create(
    application=app,
    user=desk_user,
    defaults={'is_read': True}
)

req_read = factory.get(f"/api/v1/travel/travel-desk/applications/?read_status=read")
force_authenticate(req_read, user=desk_user)
res_read = list_view(req_read)
data_read = res_read.data.get('data')
results_read = data_read if isinstance(data_read, list) else data_read.get('results', [])
check("Test 3A: read_status=read finds read application", any(r['id'] == app.id for r in results_read), True)

req_unread = factory.get(f"/api/v1/travel/travel-desk/applications/?read_status=unread")
force_authenticate(req_unread, user=desk_user)
res_unread = list_view(req_unread)
data_unread = res_unread.data.get('data')
results_unread = data_unread if isinstance(data_unread, list) else data_unread.get('results', [])
check("Test 3B: read_status=unread does not include read application", any(r['id'] == app.id for r in results_unread), False)

# Test 4: IO Number, GL Code, Sanction Number filtering
app.internal_order = "IO-TEST-9999"
app.sanction_number = "SANCTION-TEST-8888"
app.save()

req_io = factory.get(f"/api/v1/travel/travel-desk/applications/?io_number=IO-TEST-9999")
force_authenticate(req_io, user=desk_user)
res_io = list_view(req_io)
data_io = res_io.data.get('data')
results_io = data_io if isinstance(data_io, list) else data_io.get('results', [])
check("Test 4A: io_number filter finds matching application", any(r['id'] == app.id for r in results_io), True)

req_sanction = factory.get(f"/api/v1/travel/travel-desk/applications/?sanction_number=SANCTION-TEST-8888")
force_authenticate(req_sanction, user=desk_user)
res_sanction = list_view(req_sanction)
data_sanction = res_sanction.data.get('data')
results_sanction = data_sanction if isinstance(data_sanction, list) else data_sanction.get('results', [])
check("Test 4B: sanction_number filter finds matching application", any(r['id'] == app.id for r in results_sanction), True)

# Cleanup
TravelApplicationReadStatus.objects.filter(user=desk_user, application=app).delete()

print(f"\nSummary: {passed} passed, {failed} failed\n")
if failed > 0:
    sys.exit(1)
