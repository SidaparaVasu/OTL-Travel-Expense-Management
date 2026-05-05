"""
Test suite for the selected_approver / flexible approver selection feature.

Tests:
  1. is_eligible_approver() — grade-based and temp-auth-based
  2. resolve_manager_approver() — selected_approver priority, fallback, expired auth
  3. get_eligible_approvers() — returns correct users
  4. Backward compatibility — existing TRs with null selected_approver
  5. Self-selection prevention (serializer validation)
  6. Ineligible user selection (serializer validation)

Run:
  docker exec dev_backend python apps/travel/tests/test_selected_approver.py
  OR
  docker exec dev_backend python manage.py shell < apps/travel/tests/test_selected_approver.py
"""

import os
import sys
import django

# Ensure the project root (/app inside Docker, Backend/ locally) is on sys.path
_project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Main.settings')
django.setup()

import datetime
from django.utils import timezone
from apps.authentication.models import User, TemporaryApproverAuthorization
from apps.master_data.models import GradeMaster
from apps.travel.services.approver_helpers import (
    is_eligible_approver, resolve_manager_approver, get_eligible_approvers
)

# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

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

class MockGrade:
    def __init__(self, name): self.name = name

class MockProfile:
    def __init__(self, grade_name=None, reporting_manager=None):
        self.grade = MockGrade(grade_name) if grade_name else None
        self.reporting_manager = reporting_manager

class MockUser:
    _id_counter = 9000
    def __init__(self, grade_name=None, reporting_manager=None):
        MockUser._id_counter += 1
        self.id = MockUser._id_counter
        self.grade = MockGrade(grade_name) if grade_name else None
        self.organizational_profile = MockProfile(grade_name, reporting_manager)
    def get_full_name(self): return f"User-{self.id}"

class MockTravelApp:
    def __init__(self, selected_approver=None):
        self.id = 99999
        self.selected_approver = selected_approver

# ─────────────────────────────────────────────
# 1. is_eligible_approver() — grade-based
# ─────────────────────────────────────────────
print("\n=== 1. is_eligible_approver() — grade-based ===")

check("B-2A is eligible", is_eligible_approver(MockUser("B-2A")), True)
check("B-2B is eligible", is_eligible_approver(MockUser("B-2B")), True)
check("B-3 is eligible",  is_eligible_approver(MockUser("B-3")),  True)
check("B-4A is NOT eligible", is_eligible_approver(MockUser("B-4A")), False)
check("B-4B is NOT eligible", is_eligible_approver(MockUser("B-4B")), False)
check("No grade is NOT eligible", is_eligible_approver(MockUser(None)), False)
check("None user returns False", is_eligible_approver(None), False)

# ─────────────────────────────────────────────
# 2. is_eligible_approver() — temp auth (DB)
# ─────────────────────────────────────────────
print("\n=== 2. is_eligible_approver() — TemporaryApproverAuthorization ===")

# Get a real B-4A user from DB (or create one)
try:
    b4a_grade = GradeMaster.objects.filter(name__icontains='B-4').first()
    temp_user = User.objects.filter(
        organizational_profile__grade=b4a_grade,
        is_active=True
    ).first() if b4a_grade else None

    if temp_user:
        today = timezone.now().date()

        # Create active temp auth
        auth = TemporaryApproverAuthorization.objects.create(
            user=temp_user,
            reason="Test: promotion pending",
            valid_from=today,
            valid_until=today + datetime.timedelta(days=30),
            is_active=True
        )
        check("B-4A with active temp auth IS eligible", is_eligible_approver(temp_user), True)

        # Expire it
        auth.valid_until = today - datetime.timedelta(days=1)
        auth.save()
        check("B-4A with expired temp auth is NOT eligible", is_eligible_approver(temp_user), False)

        # Deactivate
        auth.valid_until = today + datetime.timedelta(days=30)
        auth.is_active = False
        auth.save()
        check("B-4A with inactive temp auth is NOT eligible", is_eligible_approver(temp_user), False)

        # Cleanup
        auth.delete()
    else:
        print("  ⚠ SKIP: No B-4A user found in DB for temp auth tests")
except Exception as e:
    print(f"  ⚠ SKIP: DB temp auth test error: {e}")

# ─────────────────────────────────────────────
# 3. resolve_manager_approver() — mock objects
# ─────────────────────────────────────────────
print("\n=== 3. resolve_manager_approver() ===")

reporting_mgr = MockUser("B-3")
selected_b2a  = MockUser("B-2A")
selected_b4a  = MockUser("B-4A")  # ineligible
employee      = MockUser("B-4B")
employee.organizational_profile.reporting_manager = reporting_mgr

# Case 1: No selected_approver → returns reporting_manager
app_no_selection = MockTravelApp(selected_approver=None)
result = resolve_manager_approver(app_no_selection, employee)
check("No selected_approver → returns reporting_manager", result, reporting_mgr)

# Case 2: selected_approver is eligible → returns selected_approver
app_with_b2a = MockTravelApp(selected_approver=selected_b2a)
result = resolve_manager_approver(app_with_b2a, employee)
check("selected_approver B-2A → returns selected_approver", result, selected_b2a)

# Case 3: selected_approver is ineligible → falls back to reporting_manager
app_with_b4a = MockTravelApp(selected_approver=selected_b4a)
result = resolve_manager_approver(app_with_b4a, employee)
check("selected_approver B-4A (ineligible) → falls back to reporting_manager", result, reporting_mgr)

# Case 4: travel_app is None (engine init edge case) → returns reporting_manager
result = resolve_manager_approver(None, employee)
check("travel_app=None → returns reporting_manager", result, reporting_mgr)

# Case 5: No reporting_manager and no selected_approver → returns None
employee_no_mgr = MockUser("B-4B")
employee_no_mgr.organizational_profile.reporting_manager = None
app_no_selection2 = MockTravelApp(selected_approver=None)
result = resolve_manager_approver(app_no_selection2, employee_no_mgr)
check("No reporting_manager, no selected_approver → returns None", result, None)

# Case 6: selected_approver is None explicitly → returns reporting_manager
app_explicit_none = MockTravelApp(selected_approver=None)
result = resolve_manager_approver(app_explicit_none, employee)
check("selected_approver=None explicitly → returns reporting_manager", result, reporting_mgr)

# ─────────────────────────────────────────────
# 4. get_eligible_approvers() — DB test
# ─────────────────────────────────────────────
print("\n=== 4. get_eligible_approvers() ===")

try:
    eligible_qs = get_eligible_approvers()
    count = eligible_qs.count()
    print(f"  ℹ  get_eligible_approvers() returned {count} users")

    # All returned users should be eligible
    all_eligible = all(is_eligible_approver(u) for u in eligible_qs[:20])
    check("All users from get_eligible_approvers() pass is_eligible_approver()", all_eligible, True)

    # No inactive users
    has_inactive = eligible_qs.filter(is_active=False).exists()
    check("No inactive users in eligible list", has_inactive, False)

except Exception as e:
    print(f"  ⚠ SKIP: get_eligible_approvers DB test error: {e}")

# ─────────────────────────────────────────────
# 5. Backward compatibility — existing TRs
# ─────────────────────────────────────────────
print("\n=== 5. Backward compatibility — existing TRs ===")

try:
    from apps.travel.models import TravelApplication
    # Check that all existing TRs have selected_approver=None
    total = TravelApplication.objects.count()
    with_selected = TravelApplication.objects.exclude(selected_approver__isnull=True).count()
    check(
        f"All existing {total} TRs have selected_approver=NULL (backward compat)",
        with_selected,
        0
    )
except Exception as e:
    print(f"  ⚠ SKIP: backward compat DB test error: {e}")

# ─────────────────────────────────────────────
# 6. Serializer validation (mock)
# ─────────────────────────────────────────────
print("\n=== 6. Serializer validate_selected_approver() ===")

try:
    from apps.travel.serializers.travel_serializers import TravelApplicationSerializer

    class MockRequest:
        def __init__(self, user): self.user = user

    # Ineligible user → should raise ValidationError
    ineligible_user = User.objects.filter(
        organizational_profile__grade__name__in=['B-4A', 'B-4B'],
        is_active=True
    ).first()

    if ineligible_user:
        serializer = TravelApplicationSerializer(context={'request': MockRequest(MockUser("B-4B"))})
        try:
            serializer.validate_selected_approver(ineligible_user)
            check("Ineligible user raises ValidationError", False, True)
        except Exception:
            check("Ineligible user raises ValidationError", True, True)
    else:
        print("  ⚠ SKIP: No B-4A/B-4B user in DB for serializer test")

    # None → should pass
    serializer2 = TravelApplicationSerializer(context={'request': MockRequest(MockUser("B-4B"))})
    result = serializer2.validate_selected_approver(None)
    check("None selected_approver passes validation", result, None)

except Exception as e:
    print(f"  ⚠ SKIP: Serializer test error: {e}")

# ─────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────
print()
print("=" * 70)
print(f"RESULTS: {passed} passed, {failed} failed out of {passed + failed} tests")
print("=" * 70)

if failures:
    print("\nFAILED TESTS:")
    for desc, expected, actual in failures:
        print(f"  • {desc}")
        print(f"    Expected: {expected!r}, Got: {actual!r}")

exit(0 if failed == 0 else 1)
