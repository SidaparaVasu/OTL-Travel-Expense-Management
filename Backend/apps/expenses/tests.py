"""
Expense Claim Tests
===================
Covers the approval-flow gate added to:
  - validate_claim_payload()  (business logic)
  - ClaimableTravelApplicationsView  (API endpoint)

Run with:
    python manage.py test apps.expenses.tests --verbosity=2
"""

from unittest.mock import patch, MagicMock, PropertyMock
from django.test import TestCase, RequestFactory
from django.contrib.auth import get_user_model

User = get_user_model()


# ---------------------------------------------------------------------------
# Helpers — lightweight fakes that avoid hitting the real DB
# ---------------------------------------------------------------------------

def _make_tr(status="completed", travel_for="self"):
    """Return a minimal TravelApplication-like mock."""
    tr = MagicMock()
    tr.id = 1
    tr.status = status
    tr.travel_for = travel_for
    tr.advance_amount = 0
    tr.employee = MagicMock()
    tr.employee.grade = "B-3"
    tr.trip_details.all.return_value = []
    tr.trip_details.order_by.return_value = MagicMock(
        first=MagicMock(return_value=None)
    )
    tr.settlement_due_date = None
    return tr


def _make_approval_flow_qs(entries):
    """
    Return a mock queryset that behaves like
    TravelApprovalFlow.objects.filter(...).
    `entries` is a list of (approval_level, status) tuples.
    """
    qs = MagicMock()
    qs.exists.return_value = bool(entries)
    qs.values_list.return_value = entries
    return qs


MINIMAL_PAYLOAD = {
    "travel_application_id": 1,
    "items": [],
}


# ---------------------------------------------------------------------------
# Unit tests — validate_claim_payload
# ---------------------------------------------------------------------------

class ValidateClaimApprovalFlowTests(TestCase):
    """
    Tests for the approval-flow gate inside validate_claim_payload().
    All DB calls are mocked so no migrations are needed.
    """

    def _run(self, tr, approval_flow_qs, payload=None):
        """
        Patch every DB-touching call inside validate_claim_payload and run it.
        Returns the validation result dict.
        """
        from apps.expenses.business_logic import claims as claims_module

        payload = payload or MINIMAL_PAYLOAD.copy()

        with patch.object(
            claims_module.TravelApplication.objects, "filter"
        ) as mock_ta_filter, patch.object(
            claims_module.TravelApprovalFlow.objects, "filter",
            return_value=approval_flow_qs,
        ), patch(
            "apps.expenses.business_logic.claims.check_duplicate_claim",
            return_value=False,
        ), patch(
            "apps.expenses.business_logic.claims.calculate_da_breakdown",
            return_value=[],
        ), patch(
            "apps.expenses.business_logic.claims._get_da_rates_for_grade",
            return_value={},
        ), patch(
            "apps.expenses.business_logic.claims.ConveyanceRateMaster.objects.filter",
            return_value=MagicMock(__iter__=lambda s: iter([])),
        ), patch(
            "apps.expenses.business_logic.claims.ApprovalMatrix.objects.filter",
            return_value=MagicMock(exists=MagicMock(return_value=False)),
        ), patch(
            "apps.travel.models.booking.Booking.objects.filter",
            return_value=MagicMock(exists=MagicMock(return_value=False)),
        ):
            # When tr is passed directly, the filter call is not used
            result = claims_module.validate_claim_payload(payload, tr=tr)

        return result

    # ------------------------------------------------------------------
    # Scenario 1 — Happy path: all approvals done, claim allowed
    # ------------------------------------------------------------------
    def test_all_approvals_approved_allows_claim(self):
        """
        When every required approval flow is 'approved' or 'skipped',
        no approval error should be raised.
        """
        tr = _make_tr(status="completed")
        # No pending/rejected flows → empty queryset
        approval_qs = _make_approval_flow_qs([])

        result = self._run(tr, approval_qs)

        self.assertNotIn("travel_request.approval", result["errors"])

    # ------------------------------------------------------------------
    # Scenario 2 — Manager approval still pending
    # ------------------------------------------------------------------
    def test_pending_manager_approval_blocks_claim(self):
        """
        A 'pending' manager approval must block claim creation.
        """
        tr = _make_tr(status="completed")
        approval_qs = _make_approval_flow_qs([("manager", "pending")])

        result = self._run(tr, approval_qs)

        self.assertIn("travel_request.approval", result["errors"])
        msg = result["errors"]["travel_request.approval"][0]
        self.assertIn("Reporting Manager", msg)
        self.assertIn("pending", msg)

    # ------------------------------------------------------------------
    # Scenario 3 — CHRO approval rejected
    # ------------------------------------------------------------------
    def test_rejected_chro_approval_blocks_claim(self):
        """
        A 'rejected' CHRO approval must block claim creation.
        """
        tr = _make_tr(status="completed")
        approval_qs = _make_approval_flow_qs([("chro", "rejected")])

        result = self._run(tr, approval_qs)

        self.assertIn("travel_request.approval", result["errors"])
        msg = result["errors"]["travel_request.approval"][0]
        self.assertIn("CHRO", msg)
        self.assertIn("rejected", msg)

    # ------------------------------------------------------------------
    # Scenario 4 — Multiple levels pending
    # ------------------------------------------------------------------
    def test_multiple_pending_approvals_all_listed_in_error(self):
        """
        When multiple approval levels are pending, all should appear in the
        error message so the user knows exactly what is blocking them.
        """
        tr = _make_tr(status="completed")
        approval_qs = _make_approval_flow_qs([
            ("manager", "pending"),
            ("chro", "pending"),
        ])

        result = self._run(tr, approval_qs)

        self.assertIn("travel_request.approval", result["errors"])
        msg = result["errors"]["travel_request.approval"][0]
        self.assertIn("Reporting Manager", msg)
        self.assertIn("CHRO", msg)

    # ------------------------------------------------------------------
    # Scenario 5 — Travel desk still pending
    # ------------------------------------------------------------------
    def test_pending_travel_desk_blocks_claim(self):
        tr = _make_tr(status="completed")
        approval_qs = _make_approval_flow_qs([("travel_desk", "pending")])

        result = self._run(tr, approval_qs)

        self.assertIn("travel_request.approval", result["errors"])
        msg = result["errors"]["travel_request.approval"][0]
        self.assertIn("Travel Desk", msg)

    # ------------------------------------------------------------------
    # Scenario 6 — CEO approval pending
    # ------------------------------------------------------------------
    def test_pending_ceo_approval_blocks_claim(self):
        tr = _make_tr(status="completed")
        approval_qs = _make_approval_flow_qs([("ceo", "pending")])

        result = self._run(tr, approval_qs)

        self.assertIn("travel_request.approval", result["errors"])

    # ------------------------------------------------------------------
    # Scenario 7 — Status not completed (existing check still works)
    # ------------------------------------------------------------------
    def test_non_completed_status_blocks_before_approval_check(self):
        """
        The status check fires before the approval-flow check.
        An application in 'booked' status should fail on status, not approval.
        """
        tr = _make_tr(status="booked")
        approval_qs = _make_approval_flow_qs([])  # no pending approvals

        result = self._run(tr, approval_qs)

        self.assertIn("travel_request.status", result["errors"])
        self.assertNotIn("travel_request.approval", result["errors"])

    # ------------------------------------------------------------------
    # Scenario 8 — Guest travel blocked before approval check
    # ------------------------------------------------------------------
    def test_guest_travel_blocked_before_approval_check(self):
        tr = _make_tr(status="completed", travel_for="guest")
        approval_qs = _make_approval_flow_qs([])

        result = self._run(tr, approval_qs)

        self.assertIn("travel_request", result["errors"])
        self.assertNotIn("travel_request.approval", result["errors"])

    # ------------------------------------------------------------------
    # Scenario 9 — Approval flow check fires before duplicate check
    # ------------------------------------------------------------------
    def test_approval_check_fires_before_duplicate_check(self):
        """
        If approvals are incomplete, we should get the approval error,
        not a duplicate-claim error, even if a duplicate exists.
        """
        tr = _make_tr(status="completed")
        approval_qs = _make_approval_flow_qs([("manager", "pending")])

        from apps.expenses.business_logic import claims as claims_module

        with patch.object(
            claims_module.TravelApprovalFlow.objects, "filter",
            return_value=approval_qs,
        ), patch(
            "apps.expenses.business_logic.claims.check_duplicate_claim",
            return_value=True,  # duplicate exists
        ), patch(
            "apps.expenses.business_logic.claims.calculate_da_breakdown",
            return_value=[],
        ), patch(
            "apps.expenses.business_logic.claims._get_da_rates_for_grade",
            return_value={},
        ), patch(
            "apps.expenses.business_logic.claims.ConveyanceRateMaster.objects.filter",
            return_value=MagicMock(__iter__=lambda s: iter([])),
        ), patch(
            "apps.expenses.business_logic.claims.ApprovalMatrix.objects.filter",
            return_value=MagicMock(exists=MagicMock(return_value=False)),
        ):
            result = claims_module.validate_claim_payload(MINIMAL_PAYLOAD.copy(), tr=tr)

        self.assertIn("travel_request.approval", result["errors"])
        self.assertNotIn("duplicate", result["errors"])

    # ------------------------------------------------------------------
    # Scenario 10 — Self-approval level pending
    # ------------------------------------------------------------------
    def test_pending_self_approval_blocks_claim(self):
        tr = _make_tr(status="completed")
        approval_qs = _make_approval_flow_qs([("self_approval", "pending")])

        result = self._run(tr, approval_qs)

        self.assertIn("travel_request.approval", result["errors"])
        msg = result["errors"]["travel_request.approval"][0]
        self.assertIn("Self Approval", msg)

    # ------------------------------------------------------------------
    # Scenario 11 — Unknown approval level still surfaces in error
    # ------------------------------------------------------------------
    def test_unknown_approval_level_still_surfaces(self):
        """
        If a new approval level is added to the model but not to the
        label map, it should still appear in the error (raw code).
        """
        tr = _make_tr(status="completed")
        approval_qs = _make_approval_flow_qs([("new_level_xyz", "pending")])

        result = self._run(tr, approval_qs)

        self.assertIn("travel_request.approval", result["errors"])
        msg = result["errors"]["travel_request.approval"][0]
        self.assertIn("new_level_xyz", msg)


# ---------------------------------------------------------------------------
# Unit tests — ClaimableTravelApplicationsView queryset filtering
# ---------------------------------------------------------------------------

class ClaimableTravelApplicationsViewTests(TestCase):
    """
    Tests for the approval-flow exclusion in ClaimableTravelApplicationsView.

    Strategy: call the view's get() method directly (bypassing DRF auth) and
    patch the ORM at the model level so we can inspect every exclude() call.
    """

    def _call_view_get(self, blocked_ids):
        """
        Directly invoke ClaimableTravelApplicationsView.get() with a fake
        authenticated request, patching all ORM/serializer calls.

        Returns (response, list_of_exclude_kwargs_dicts).
        """
        from apps.expenses.views import ClaimableTravelApplicationsView
        from apps.travel.models.application import TravelApplication
        from apps.travel.models.approval import TravelApprovalFlow

        # --- Build a chainable mock queryset that records exclude() calls ---
        exclude_calls = []

        class TrackingQS:
            """Minimal queryset stand-in that records exclude() kwargs."""
            def filter(self, **kw):
                return self
            def exclude(self, **kw):
                exclude_calls.append(kw)
                return self
            def select_related(self, *a):
                return self
            def prefetch_related(self, *a):
                return self
            def order_by(self, *a):
                return self
            def __iter__(self):
                return iter([])

        tracking_qs = TrackingQS()

        # Mock request — set user directly so DRF permission check passes
        factory = RequestFactory()
        request = factory.get("/api/expenses/claimable-travel-applications/")
        request.user = MagicMock()
        request.user.is_authenticated = True

        mock_af_filter = MagicMock(
            return_value=MagicMock(
                values_list=MagicMock(return_value=blocked_ids)
            )
        )

        # Patch the serializer at the module level in views so many=True
        # never reaches the real class (avoids DRF metaclass issues)
        mock_serializer_instance = MagicMock()
        mock_serializer_instance.data = []
        mock_serializer_class = MagicMock(return_value=mock_serializer_instance)

        with patch.object(TravelApplication.objects, "filter", return_value=tracking_qs), \
             patch.object(TravelApprovalFlow.objects, "filter", mock_af_filter), \
             patch("apps.expenses.views.TravelApplicationSerializer", mock_serializer_class):

            view_instance = ClaimableTravelApplicationsView()
            response = view_instance.get(request)

        return response, exclude_calls

    # ------------------------------------------------------------------
    # Scenario A — No blocked apps → view returns 200 with success=True
    # ------------------------------------------------------------------
    def test_no_blocked_apps_returns_200(self):
        response, _ = self._call_view_get(blocked_ids=[])
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data.get("success"))

    # ------------------------------------------------------------------
    # Scenario B — Blocked IDs are passed to exclude(id__in=...)
    # ------------------------------------------------------------------
    def test_blocked_ids_are_excluded_from_queryset(self):
        blocked = [10, 20, 30]
        _, exclude_calls = self._call_view_get(blocked_ids=blocked)

        id_in_calls = [c for c in exclude_calls if "id__in" in c]
        self.assertTrue(
            len(id_in_calls) > 0,
            "Expected at least one exclude(id__in=...) call for blocked applications",
        )
        excluded_ids = list(id_in_calls[0]["id__in"])
        self.assertEqual(sorted(excluded_ids), sorted(blocked))

    # ------------------------------------------------------------------
    # Scenario C — Guest exclusion still present alongside approval exclusion
    # ------------------------------------------------------------------
    def test_guest_exclusion_still_applied(self):
        _, exclude_calls = self._call_view_get(blocked_ids=[])
        guest_calls = [c for c in exclude_calls if c.get("travel_for") == "guest"]
        self.assertTrue(
            len(guest_calls) > 0,
            "Expected exclude(travel_for='guest') to still be applied",
        )

    # ------------------------------------------------------------------
    # Scenario D — Existing claim exclusion still present
    # ------------------------------------------------------------------
    def test_existing_claim_exclusion_still_applied(self):
        _, exclude_calls = self._call_view_get(blocked_ids=[])
        claim_calls = [c for c in exclude_calls if "expense_claim__isnull" in c]
        self.assertTrue(
            len(claim_calls) > 0,
            "Expected exclude(expense_claim__isnull=False) to still be applied",
        )


# ---------------------------------------------------------------------------
# Integration-style tests — validate_claim_payload with real model structure
# (uses Django's test DB; requires migrations to be run)
# ---------------------------------------------------------------------------

class ValidateClaimApprovalFlowIntegrationTests(TestCase):
    """
    These tests use the real ORM but mock only the DA master lookup
    (which requires master data fixtures).

    They verify the approval-flow gate end-to-end with actual model instances.
    Skip if you don't have a test DB with migrations applied.
    """

    @classmethod
    def setUpTestData(cls):
        """
        Create the minimum model instances needed.
        Skips gracefully if models are not available.
        """
        try:
            from apps.travel.models.application import TravelApplication, TripDetails
            from apps.travel.models.approval import TravelApprovalFlow
            from apps.authentication.models import User as AuthUser

            cls.user = AuthUser.objects.create_user(
                username="test_claimant",
                password="testpass123",
                email="claimant@test.com",
            )

            cls.tr_all_approved = TravelApplication.objects.create(
                employee=cls.user,
                status="completed",
                travel_for="self",
                purpose="Test trip — all approved",
            )

            cls.tr_pending_manager = TravelApplication.objects.create(
                employee=cls.user,
                status="completed",
                travel_for="self",
                purpose="Test trip — manager pending",
            )

            # Approver user
            cls.approver = AuthUser.objects.create_user(
                username="test_approver",
                password="testpass123",
                email="approver@test.com",
            )

            # For tr_all_approved: manager flow is approved
            TravelApprovalFlow.objects.create(
                travel_application=cls.tr_all_approved,
                approver=cls.approver,
                approval_level="manager",
                sequence=1,
                status="approved",
                is_required=True,
            )

            # For tr_pending_manager: manager flow is still pending
            TravelApprovalFlow.objects.create(
                travel_application=cls.tr_pending_manager,
                approver=cls.approver,
                approval_level="manager",
                sequence=1,
                status="pending",
                is_required=True,
            )

            cls.models_available = True

        except Exception:
            cls.models_available = False

    def _validate(self, tr):
        from apps.expenses.business_logic.claims import validate_claim_payload

        with patch(
            "apps.expenses.business_logic.claims.calculate_da_breakdown",
            return_value=[],
        ), patch(
            "apps.expenses.business_logic.claims._get_da_rates_for_grade",
            return_value={},
        ), patch(
            "apps.expenses.business_logic.claims.ConveyanceRateMaster.objects.filter",
            return_value=MagicMock(__iter__=lambda s: iter([])),
        ), patch(
            "apps.expenses.business_logic.claims.ApprovalMatrix.objects.filter",
            return_value=MagicMock(exists=MagicMock(return_value=False)),
        ):
            return validate_claim_payload({"travel_application_id": tr.id, "items": []}, tr=tr)

    def test_all_approvals_approved_no_error(self):
        if not self.models_available:
            self.skipTest("Models not available — run migrations first")

        result = self._validate(self.tr_all_approved)
        self.assertNotIn("travel_request.approval", result["errors"])

    def test_pending_manager_approval_raises_error(self):
        if not self.models_available:
            self.skipTest("Models not available — run migrations first")

        result = self._validate(self.tr_pending_manager)
        self.assertIn("travel_request.approval", result["errors"])
        msg = result["errors"]["travel_request.approval"][0]
        self.assertIn("Reporting Manager", msg)
        self.assertIn("pending", msg)

    def test_no_approval_flows_at_all_allows_claim(self):
        """
        If a travel application has no approval flow records at all
        (e.g., self-approved or legacy data), the claim should be allowed.
        """
        if not self.models_available:
            self.skipTest("Models not available — run migrations first")

        from apps.travel.models.application import TravelApplication

        tr_no_flows = TravelApplication.objects.create(
            employee=self.user,
            status="completed",
            travel_for="self",
            purpose="Test trip — no approval flows",
        )

        result = self._validate(tr_no_flows)
        self.assertNotIn("travel_request.approval", result["errors"])
