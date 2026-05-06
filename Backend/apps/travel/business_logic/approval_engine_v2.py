"""
ApprovalEngineV2

Purpose:
- Evaluate a TravelApplication and produce an ordered list of approvers
  honoring TravelPolicyMaster, ApprovalMatrix (if present), and TSF overrides.
- Designed to be drop-in for TravelApplicationSubmitView.

Output:
- build() -> list of ApproverEntry objects with attributes:
    .user, .level, .sequence, .is_required, .can_view, .can_approve

Notes:
- Does NOT auto-approve when approver == requester.
- Attempts to be resilient if some master models are not present.
"""

import logging
from decimal import Decimal
from django.utils import timezone
from django.db import models
from django.utils import timezone

logger = logging.getLogger(__name__)

# Small helper class for final entries
class ApproverEntry:
    def __init__(self, user, level, sequence=0, is_required=True, can_view=True, can_approve=True):
        self.user = user
        self.level = level
        self.sequence = sequence
        self.is_required = is_required
        self.can_view = can_view
        self.can_approve = can_approve

    def to_dict(self):
        return {
            "user_id": getattr(self.user, "id", None),
            "level": self.level,
            "sequence": self.sequence,
            "is_required": self.is_required,
            "can_view": self.can_view,
            "can_approve": self.can_approve
        }

class ApprovalEngineV2:
    """
    ApprovalEngineV2
    Arguments:
      - travel_app : TravelApplication instance
      - request_user: User instance who is submitting (for role checks)
      - config (optional): dict to override default thresholds if needed
    """
    DEFAULTS = {
        "flight_amount_threshold": Decimal("10000"),  # TSF fallback if TravelPolicyMaster not present
        "own_car_distance_km": 150,                   # TSF fallback
        "ceo_approval_long_duration_days": 7,         # CEO required if trip > 7 days
        "enable_ceo_approval_long_duration": True,    # Feature flag
    }

    def __init__(self, travel_app, request_user, config=None):
        self.travel_application = travel_app
        self.request_user = request_user
        self.config = self.DEFAULTS.copy()
        if config:
            self.config.update(config)

        # cache model references if available
        self._load_models()

    # ---------------------------
    # Model discovery / safety
    # ---------------------------
    def _load_models(self):
        """
        Try to import commonly expected master models and auth role models.
        If something isn't present, we set it to None and continue gracefully.
        """
        try:
            from apps.master_data.models import TravelPolicyMaster, ApprovalMatrix, TravelModeMaster, GradeMaster
            self.TravelPolicyMaster = TravelPolicyMaster
            self.ApprovalMatrix = ApprovalMatrix
            self.TravelModeMaster = TravelModeMaster
            self.GradeMaster = GradeMaster
        except Exception as e:
            # Not fatal — engine will fall back to built-in TSF rules
            logger.debug("Some master_data models not available: %s", e)
            self.TravelPolicyMaster = None
            self.ApprovalMatrix = None
            self.TravelModeMaster = None
            self.GradeMaster = None

        try:
            from apps.authentication.models import Role, UserRole
            self.Role = Role
            self.UserRole = UserRole
        except Exception as e:
            logger.debug("Authentication role models not available: %s", e)
            self.Role = None
            self.UserRole = None

    # ---------------------------
    # User / role helpers
    # ---------------------------
    def user_has_role(self, user, role_name):
        """
        Robust role check:
        - If user has attribute 'roles' (queryset or list), try that first.
        - Else fallback to UserRole join if available.
        Case-insensitive match on role name.
        """
        try:
            if hasattr(user, "roles"):
                # roles might be list or a Django related manager
                roles_attr = getattr(user, "roles")
                try:
                    # if it's a queryset-like
                    return roles_attr.filter(name__iexact=role_name).exists()
                except Exception:
                    # maybe it's a list of dicts or objects
                    for r in roles_attr:
                        if getattr(r, "name", str(r)).lower() == role_name.lower():
                            return True
                    return False
            if self.UserRole and self.Role:
                role = self.Role.objects.filter(name__iexact=role_name).first()
                if not role:
                    return False
                return self.UserRole.objects.filter(role=role, user=user, is_active=True).exists()
            # Last resort: check user.groups or user.is_superuser (not ideal)
            if hasattr(user, "groups"):
                try:
                    return user.groups.filter(name__iexact=role_name).exists()
                except Exception:
                    return False
            if getattr(user, "is_superuser", False) and role_name.lower() in ["admin", "superuser"]:
                return True
            return False
        except Exception as e:
            logger.exception("Error checking role for user %s: %s", getattr(user, "id", "unknown"), e)
            return False

    def can_self_approve(self, user, mode_name):
        """
        Check if user can self-approve based on grade and travel mode.

        TSF Policy:
        ┌─────────────────────────────┬──────────────┬──────────────────────────────────────────┐
        │ Mode                        │ B-4B / B-4A  │ B-3 / B-2B / B-2A                        │
        ├─────────────────────────────┼──────────────┼──────────────────────────────────────────┤
        │ Flight                      │ B-2B/B-2A    │ Self-Approve (B-3 needs B-2B/B-2A)       │
        │ Train                       │ B-3/B-2B/B-2A│ Self-Approve                             │
        │ Pick-up and Drop            │ B-3/B-2B/B-2A│ Self-Approve                             │
        │ Radio Taxi                  │ Self-Approve │ Self-Approve  (ALL grades)               │
        │ Car at Disposal             │ B-2B/B-2A    │ Self-Approve (B-3 needs B-2B/B-2A)       │
        └─────────────────────────────┴──────────────┴──────────────────────────────────────────┘

        Actual TravelModeMaster names used for matching:
          - "Flight"
          - "Train"
          - "Pick-up and Drop"
          - "Radio Taxi"
          - "Car at Disposal"
        """
        try:
            grade = getattr(user, 'grade', None)
            if not grade:
                return False

            grade_name = grade.name.upper()

            # Normalise: lowercase + strip for safe comparison
            mode = mode_name.strip().lower()

            # ------------------------------------------------------------------
            # Radio Taxi → ALL grades self-approve (no grade restriction)
            # ------------------------------------------------------------------
            if mode == "radio taxi":
                return True

            # ------------------------------------------------------------------
            # B-2A and B-2B: self-approve ALL travel modes per TSF policy.
            # The policy document lists specific modes as examples only.
            # Special escalation rules (flight >₹10k, car disposal >5 days,
            # advance amount, long duration) still override via build() STEP 1.
            # ------------------------------------------------------------------
            if grade_name in ('B-2A', 'B-2B'):
                return True

            # ------------------------------------------------------------------
            # B-3: self-approve Train and Pick-up and Drop only.
            #      Flight and Car at Disposal require B-2B/B-2A approval.
            # ------------------------------------------------------------------
            if grade_name == 'B-3':
                if mode == "train":
                    return True
                if mode == "pick-up and drop":
                    return True
                # Flight → NOT self-approve for B-3 (needs B-2B/B-2A)
                # Car at Disposal → NOT self-approve for B-3 (needs B-2B/B-2A)

            # B-4A / B-4B → no self-approval for any mode (handled above for Radio Taxi)
            return False

        except Exception as e:
            logger.debug(f"Error checking self-approval: {e}")
            return False

    def find_user_for_role(self, role_name):
        """
        Find a user assigned to a role (first active one). Returns user or None.
        Tries:
          1. UserRole join (preferred)
          2. Role-based fallback (if some other mapping exists)
        """
        try:
            if self.UserRole and self.Role:
                role = self.Role.objects.filter(name__iexact=role_name).first()
                if not role:
                    return None
                ur = self.UserRole.objects.filter(role=role, is_active=True).order_by("-is_primary").first()
                if ur:
                    return ur.user
            # If no UserRole model, try scanning reporting structure or system admins
            # (best-effort)
            return None
        except Exception as e:
            logger.debug("find_user_for_role error: %s", e)
            return None

    # ---------------------------
    # Policy readers
    # ---------------------------
    def get_effective_policies(self, policy_type=None):
        """
        Returns list/queryset of active TravelPolicyMaster rules (if model present).
        If policy_type provided, filter by it.
        """
        if not self.TravelPolicyMaster:
            return []
        try:
            qs = self.TravelPolicyMaster.objects.filter(is_active=True)
            today = timezone.now().date()
            qs = qs.filter(effective_from__lte=today).filter(models.Q(effective_to__isnull=True) | models.Q(effective_to__gte=today))
            if policy_type:
                # qs = qs.filter(policy_type=policy_type)
                qs = qs.filter(policy_type__icontains=policy_type)
            return list(qs)
        except Exception as e:
            logger.debug("Error fetching TravelPolicyMaster: %s", e)
            return []

    # ---------------------------
    # Booking / trip analysis
    # ---------------------------
    def _collect_bookings(self):
        """
        Returns a flat list of bookings across trip_details in the travel_app.
        """
        bookings = []
        try:
            for trip in getattr(self.travel_application, "trip_details").all():
                bookings.extend(list(trip.bookings.all()))
        except Exception as e:
            logger.debug("Error collecting bookings: %s", e)
        return bookings

    def _any_flight_above_threshold(self, bookings, threshold=None):
        if threshold is None:
            threshold = self.config.get("flight_amount_threshold", Decimal("10000"))
        try:
            threshold_dec = Decimal(str(threshold))
        except Exception:
            threshold_dec = Decimal("10000")

        for b in bookings:
            try:
                name = getattr(b.booking_type, "name", "") or ""
                if "flight" in name.lower():
                    cost = getattr(b, "estimated_cost", None)
                    if cost is None:
                        continue
                    try:
                        if Decimal(str(cost)) > threshold_dec:
                            logger.info("ApprovalEngineV2: flight amount %s exceeds threshold %s for booking id=%s", cost, threshold_dec, getattr(b, "id", None))
                            return True
                    except Exception:
                        continue
            except Exception:
                continue
        return False

    def _any_own_car_over_distance(self, bookings, max_distance=None):
        """
        Return True if any booking represents own/car/pickup-drop and distance exceeds max_distance.
        """
        if max_distance is None:
            max_distance = self.config.get("own_car_distance_km", 150)
        try:
            max_distance_val = float(max_distance)
        except Exception:
            try:
                max_distance_val = float(str(max_distance))
            except Exception:
                logger.debug("Invalid max_distance provided to _any_own_car_over_distance: %s", max_distance)
                max_distance_val = 150.0

        for b in bookings:
            try:
                name = getattr(b.booking_type, "name", str(getattr(b, "booking_type", "") or "")).lower()
                
                # BUG FIX: Strictly only 'Own Car' and 'Self-Arranged Car at Disposal' trigger the 150km rule.
                # Pick-up & Drop, Goods Carriage, and other hired/commercial modes are excluded.
                is_evaluable = False
                
                if "own car" in name:
                    is_evaluable = True
                elif "disposal" in name:
                    # Specific check for Car at Disposal: Only trigger if "Self-Arranged"
                    sub_opt_obj = getattr(b, "sub_option", None)
                    sub_opt = getattr(sub_opt_obj, "name", "") or ""
                    
                    # Fallback to details
                    if not sub_opt:
                        details = getattr(b, "booking_details", {}) or {}
                        sub_opt = details.get("vehicle_sub_option_label", "")
                    
                    sub_opt = str(sub_opt).lower()
                    if "self-arranged" in sub_opt:
                        is_evaluable = True
                
                if not is_evaluable:
                    continue

                details = getattr(b, "booking_details", {}) or {}
                distance = (
                    details.get("distance_km")
                    or details.get("distance")
                    or details.get("trip_distance")
                    or details.get("trip_distance_km")
                    or details.get("trip_distance_miles")
                    or 0
                )
                if isinstance(distance, dict):
                    distance = distance.get("value") or distance.get("distance") or 0
                try:
                    dist_val = float(distance)
                except Exception:
                    logger.debug("ApprovalEngineV2: malformed distance value '%s' for booking id=%s", distance, getattr(b, "id", None))
                    continue
                
                logger.debug("ApprovalEngineV2: booking id=%s mode=%s distance=%s threshold=%s", getattr(b, "id", None), name, dist_val, max_distance_val)
                if dist_val > max_distance_val:
                    logger.info("ApprovalEngineV2: distance threshold exceeded for booking id=%s (%s > %s)", getattr(b, "id", None), dist_val, max_distance_val)
                    return True
            except Exception as e:
                logger.debug("Error in _any_own_car_over_distance for booking id=%s: %s", getattr(b, "id", None), e)
                continue
        return False


    def _any_car_disposal_over_duration(self, bookings, max_days=5):
        """
        Return True if any booking indicates a 'car at disposal' where trip duration > max_days.
        - Detects disposal flags in booking_details: 'is_disposal', 'disposal', or transport_type == 'disposal'
        - If disposal detected, computes trip duration using booking.trip_details departure/return
        - Defensive about missing dates / malformed data
        """
        for b in bookings:
            try:
                name = getattr(b, "booking_type", None)
                # normalize name string (fallback to empty)
                name_str = (getattr(name, "name", None) or str(name or "")).lower()
                # only relevant for car / own car / disposal entries
                if not any(k in name_str for k in ("car", "own car", "disposal", "pickup", "drop")):
                    # if booking type name doesn't look like car/disposal, still check flags below
                    pass

                details = getattr(b, "booking_details", {}) or {}
                is_disposal = details.get("is_disposal") or details.get("disposal") or (details.get("transport_type") == "disposal")
                # support string truthy values too
                if isinstance(is_disposal, str):
                    is_disposal = is_disposal.lower() in ("1", "true", "yes", "y")

                if not is_disposal:
                    # no disposal marker -> skip this booking
                    continue

                # get trip info
                trip = getattr(b, "trip_details", None)
                dep = getattr(trip, "departure_date", None) if trip else None
                ret = getattr(trip, "return_date", None) if trip else None
                if not dep or not ret:
                    # missing dates; can't compute duration - treat as non-triggering
                    logger.debug("ApprovalEngineV2: disposal booking missing departure/return for booking id=%s", getattr(b, "id", None))
                    continue

                try:
                    duration = (ret - dep).days
                    if duration > int(max_days):
                        return True
                except Exception:
                    # malformed dates - ignore this booking
                    logger.debug("ApprovalEngineV2: error computing disposal duration for booking id=%s", getattr(b, "id", None))
                    continue
            except Exception:
                # ignore problematic bookings
                continue
        return False


    def _any_trip_duration_exceeds(self, max_days):
        """
        Return True if any single trip in the application exceeds max_days.
        Duration = (Return Date - Departure Date).days + 1
        """
        try:
            trips = getattr(self.travel_application, "trip_details", None)
            if not trips:
                return False
            
            for trip in trips.all():
                dep = getattr(trip, "departure_date", None)
                ret = getattr(trip, "return_date", None)
                
                if dep and ret:
                    duration = (ret - dep).days + 1
                    if duration > int(max_days):
                        logger.info(f"ApprovalEngineV2: trip {trip.id} duration {duration} > {max_days} days")
                        return True
        except Exception as e:
            logger.debug(f"Error checking trip duration: {e}")
        return False

    # ---------------------------
    # Matrix-based checks (if available)
    # ---------------------------
    def matrix_requires_chro(self, bookings):
        """
        Check if ApprovalMatrix requires CHRO for any booking
        """
        if not self.ApprovalMatrix:
            return None
        
        try:
            
            for b in bookings:
                try:
                    mode = getattr(b.booking_type, "id", None)
                    amt = getattr(b, "estimated_cost", None)
                    
                    if amt is None or mode is None:
                        continue
                    
                    amt_decimal = Decimal(amt)
                    
                    rows = self.ApprovalMatrix.objects.filter(
                        is_active=True,
                        travel_mode=mode
                    )
                    
                    grade = getattr(self.travel_application.employee, "grade", None)
                    if grade:
                        rows = rows.filter(employee_grade=grade)
                    
                    for r in rows:
                        min_a = r.min_amount or Decimal("0")
                        max_a = r.max_amount or None
                        
                        in_range = amt_decimal >= min_a
                        if max_a is not None:
                            in_range = in_range and amt_decimal <= max_a
                        
                        if in_range and getattr(r, "requires_chro", False):
                            logger.info("ApprovalMatrix rule %s triggered: CHRO required for booking %s amount %s", getattr(r, "id", None), getattr(b, "id", None), amt)
                            return True
                            
                except Exception:
                    continue
            
            return False
            
        except Exception as e:
            logger.debug("matrix_requires_chro error: %s", e)
            return None
        
    def matrix_requires_ceo_for_amount(self, bookings):
        """
        If ApprovalMatrix indicates CEO required for booking amounts,
        check against min_amount and max_amount ranges.
        """
        if not self.ApprovalMatrix:
            return None
        
        try:
            
            for b in bookings:
                try:
                    mode = getattr(b.booking_type, "id", None)
                    amt = getattr(b, "estimated_cost", None)
                    
                    if amt is None or mode is None:
                        continue
                    
                    amt_decimal = Decimal(amt)
                    
                    # Find matching matrix rows
                    rows = self.ApprovalMatrix.objects.filter(
                        is_active=True,
                        travel_mode=mode
                    )
                    
                    # Filter by grade if available
                    grade = getattr(self.travel_application.employee, "grade", None)
                    if grade:
                        rows = rows.filter(employee_grade=grade)
                    
                    # Check amount ranges
                    for r in rows:
                        min_a = r.min_amount or Decimal("0")
                        max_a = r.max_amount or None
                        
                        # Check if amount falls in range
                        in_range = amt_decimal >= min_a
                        if max_a is not None:
                            in_range = in_range and amt_decimal <= max_a
                        
                        if in_range:
                            # Check if this rule requires CEO
                            if getattr(r, "requires_ceo", False):
                                logger.info(f"ApprovalMatrix rule {r.id} triggered: CEO required for {b.booking_type.name} amount {amt}")
                                return True
                            
                except Exception as e:
                    logger.debug(f"Error checking booking against matrix: {e}")
                    continue
            
            return False
        
        except Exception as e:
            logger.debug("matrix_requires_ceo_for_amount error: %s", e)
            return None

    def _any_booking_has_advance(self, bookings):
        """
        Return True if any booking has an advance amount (estimated_cost > 0).
        This checks ticketing, accommodation, and conveyance bookings.
        
        This rule can be disabled by setting config["enable_ceo_approval_for_advance"] = False
        """
        for b in bookings:
            try:
                cost = getattr(b, "estimated_cost", None)
                if cost is not None:
                    try:
                        cost_decimal = Decimal(str(cost))
                        if cost_decimal > Decimal("0"):
                            logger.info(
                                "ApprovalEngineV2: booking id=%s has advance amount %s, CEO approval required",
                                getattr(b, "id", None),
                                cost
                            )
                            return True
                    except Exception:
                        continue
            except Exception:
                continue
        return False

    # ---------------------------
    # Merge/dedupe/order helpers
    # ---------------------------
    def _dedupe_and_order(self, approver_entries):
        """
        Deduplicate by user.id, keep earliest sequence; if same user in multiple levels,
        merge attributes (is_required = OR, can_approve = OR), and renumber sequences.
        Returns ordered list of ApproverEntry.
        """
        final = []
        seen = {}

        for a in approver_entries:
            uid = getattr(a.user, "id", None)
            if uid is None:
                # keep but try to dedupe by object id
                uid = id(a.user)

            if uid not in seen:
                seen[uid] = a
                final.append(a)
            else:
                existing = seen[uid]
                # If current sequence is earlier, swap (maintain position in list)
                if a.sequence and (not existing.sequence or a.sequence < existing.sequence):
                    idx = final.index(existing)
                    final[idx] = a
                    seen[uid] = a
                else:
                    # merge flags
                    existing.is_required = existing.is_required or a.is_required
                    existing.can_view = existing.can_view or a.can_view
                    existing.can_approve = existing.can_approve or a.can_approve

        # normalize sequence numbers in final order
        for i, a in enumerate(final, start=1):
            a.sequence = i
        return final

    # ---------------------------
    # Core build logic
    # ---------------------------
    def build(self):
        """
        Build approver chain with correct priority:
        1) Self-approval (if allowed and no special rules)
        2) Special rules → CEO/CHRO (if any)
        3) Manager only if not skipped by self-approval or special-case
        4) Dedupe + normalize sequences
        Returns: list of ApproverEntry
        """
        bookings = self._collect_bookings()
        approvers = []

        # ============================================================
        # STEP 1 — Primary mode + grade self-approval
        # ============================================================
        can_skip_manager = False

        if bookings:
            primary_booking = max(bookings, key=lambda b: getattr(b, "estimated_cost", 0) or 0)
            primary_mode = primary_booking.booking_type.name if primary_booking else None

            if primary_mode and self.can_self_approve(self.request_user, primary_mode):
                # special rule checks that *override* pure grade-based self-approval
                flight_over = self._any_flight_above_threshold(bookings, self.config.get("flight_amount_threshold"))
                car_dist_over = self._any_own_car_over_distance(bookings, self.config.get("own_car_distance_km"))
                car_disposal_over = self._any_car_disposal_over_duration(bookings, 5)
                
                # Check if advance amount is requested (if rule is enabled)
                advance_requested = False
                if self.config.get("enable_ceo_approval_for_advance", True):
                    advance_requested = self._any_booking_has_advance(bookings)

                # If none of the special rules trigger -> true self-approval (final)
                if not (flight_over or car_dist_over or car_disposal_over or advance_requested):
                    logger.info(
                        f"[SELF APPROVAL] User {getattr(self.request_user, 'id', None)} "
                        f"grade={getattr(getattr(self.request_user, 'grade', None), 'name', None)} "
                        f"mode={primary_mode} → AUTO-APPROVE"
                    )
                    # mark self_approved on TA (do not save here; submit view will persist)
                    setattr(self.travel_application, "self_approved", True)
                    return []

                # Self-approval candidate but special rules require higher approvers.
                # We set can_skip_manager=True which means manager can be skipped in favor of CEO/CHRO
                can_skip_manager = True

        # ============================================================
        # STEP 2 — Determine CEO requirement
        # ============================================================
        require_ceo = False
        try:
            # 1) ApprovalMatrix check (highest precedence)
            if self.matrix_requires_ceo_for_amount(bookings):
                require_ceo = True
            else:
                # 2) TravelPolicyMaster amount_limit policies (dynamic company policies)
                #    If any active policy says amount_limit (or threshold) for flights => require CEO accordingly
                policies = self.get_effective_policies(policy_type="amount_limit")
                for p in policies:
                    try:
                        params = getattr(p, "rule_parameters", {}) or {}
                        # support several keys used in different policy docs
                        threshold = params.get("max_amount") or params.get("threshold") or params.get("amount_limit") or None
                        # if policy explicitly requires CEO for amounts, honor that key too
                        requires_ceo_flag = params.get("requires_ceo") or params.get("requires_ceo_above") or None
                        thr_val = None
                        if threshold is not None:
                            try:
                                thr_val = float(threshold)
                            except Exception:
                                thr_val = None
                        # two modes: explicit requires_ceo flag OR numeric threshold that triggers CEO for flights above it
                        if requires_ceo_flag:
                            # if policy includes a numeric threshold inside the flag, try to interpret it
                            try:
                                # if requires_ceo is boolean/str just trigger; if numeric text, parse
                                if isinstance(requires_ceo_flag, (int, float)):
                                    thr_val = float(requires_ceo_flag)
                                elif str(requires_ceo_flag).strip().isdigit():
                                    thr_val = float(requires_ceo_flag)
                            except Exception:
                                pass
                        if thr_val is not None:
                            if self._any_flight_above_threshold(bookings, thr_val):
                                logger.info("TravelPolicyMaster amount_limit triggered: %s", thr_val)
                                require_ceo = True
                                break

                    except Exception:
                        continue

                # 3) Fallback TSF threshold if still not required
                if not require_ceo:
                    if self._any_flight_above_threshold(bookings, self.config.get("flight_amount_threshold")):
                        require_ceo = True
            
            # 4) Long Duration Travel Rule (> 7 days default)
            # This is "unlinkable" via the enable_ceo_approval_long_duration config.
            if not require_ceo and self.config.get("enable_ceo_approval_long_duration", True):
                days_limit = self.config.get("ceo_approval_long_duration_days", 7)
                if self._any_trip_duration_exceeds(days_limit):
                    logger.info("Long Duration Rule triggered (> %s days). CEO Required.", days_limit)
                    require_ceo = True

            # 5) Advance Amount Rule
            # If any booking (ticketing/accommodation/conveyance) has advance amount requested,
            # require CEO approval. This is "unlinkable" via the enable_ceo_approval_for_advance config.
            if not require_ceo and self.config.get("enable_ceo_approval_for_advance", True):
                if self._any_booking_has_advance(bookings):
                    logger.info("Advance Amount Rule triggered. CEO approval required for advance amount request.")
                    require_ceo = True

        except Exception as e:
            logger.debug("Error evaluating CEO requirement: %s", e)


        # ============================================================
        # STEP 3 — Determine CHRO requirement
        # ============================================================
        require_chro = False
        try:
            # 1) ApprovalMatrix check (returns bool)
            if self.matrix_requires_chro(bookings):
                require_chro = True
            else:
                # 2) Policy-based check: distance_limit policies
                policies = self.get_effective_policies(policy_type="distance_limit")
                for p in policies:
                    try:
                        params = getattr(p, "rule_parameters", {}) or {}
                        # try several possible keys
                        threshold = params.get("max_distance") or params.get("distance_km") or params.get("threshold")
                        if threshold is not None:
                            # tolerant numeric conversion
                            try:
                                thr_val = float(threshold)
                            except Exception:
                                thr_val = None

                            if thr_val is not None:
                                if self._any_own_car_over_distance(bookings, thr_val):
                                    logger.info("TravelPolicyMaster distance_limit triggered: %s km", thr_val)
                                    require_chro = True
                                    break
                    except Exception:
                        continue

                # 3) Fallback TSF configured threshold (if still not required)
                # if not require_chro:
                #     if self._any_own_car_over_distance(bookings, self.config.get("own_car_distance_km")):
                #         logger.info("TSF fallback own_car_distance_km triggered")
                #         require_chro = True
                if not require_chro:
                    # ONLY apply fallback when booking_type contains own car or disposal
                    for b in bookings:
                        name = getattr(b.booking_type, "name", "").lower()
                        if "own car" in name or "disposal" in name:
                            if self._any_own_car_over_distance(bookings, self.config.get("own_car_distance_km")):
                                require_chro = True
                            break

                # 4) Car disposal > configured days
                if not require_chro and self._any_car_disposal_over_duration(bookings, 5):
                    logger.info("Car disposal duration threshold triggered (>{} days)".format(5))
                    require_chro = True
        except Exception as e:
            logger.debug("Error evaluating CHRO requirement: %s", e)


        # ============================================================
        # STEP 4 — Add CHRO/CEO approvers FIRST (when required)
        # ============================================================
        if require_chro:
            chro_user = self.find_user_for_role("CHRO")
            if chro_user:
                approvers.append(
                    ApproverEntry(
                        user=chro_user,
                        level="chro",
                        sequence=len(approvers) + 1
                    )
                )
            else:
                logger.warning("CHRO required but no CHRO user found for travel_app=%s", getattr(self.travel_application, "id", None))

        if require_ceo:
            ceo_user = self.find_user_for_role("CEO")
            if ceo_user:
                approvers.append(ApproverEntry(user=ceo_user, level="ceo", sequence=len(approvers) + 1))
            else:
                logger.warning("CEO required but no CEO user found for travel_app=%s", getattr(self.travel_application, "id", None))

        # ============================================================
        # STEP 5 — Add Manager ONLY IF needed
        # If can_skip_manager is True it means manager can be skipped
        # because user qualifies for self-approval but special rules require
        # only CEO/CHRO (not manager).
        # ============================================================
        # Use resolve_manager_approver so that a user-selected approver takes
        # precedence over the reporting_manager (backward compatible: returns
        # reporting_manager when selected_approver is null).
        from apps.travel.services.approver_helpers import resolve_manager_approver
        reporting_manager = resolve_manager_approver(self.travel_application, self.request_user)

        if not can_skip_manager:
            # If CHRO is required because of OWN CAR distance/disposal, the reporting_manager
            # is skipped (CHRO supersedes manager for car-related approvals per policy).
            # HOWEVER: if the user explicitly selected an approver, that person must ALWAYS
            # be the first approver regardless of CHRO/CEO requirements — per client requirement
            # "first approver should always be selected approver".
            add_manager = True
            has_selected_approver = (
                self.travel_application is not None and
                getattr(self.travel_application, 'selected_approver', None) is not None and
                reporting_manager is not None and
                reporting_manager == getattr(self.travel_application, 'selected_approver', None)
            )
            # Determine if this is a selected_approver (not just the default reporting_manager)
            is_explicitly_selected = (
                self.travel_application is not None and
                getattr(self.travel_application, 'selected_approver', None) is not None
            )

            if require_chro and not is_explicitly_selected:
                # Only skip manager when CHRO is required due to car/distance trigger
                # AND no explicit approver was selected by the user.
                car_related_trigger = False
                for b in bookings:
                    try:
                        name = getattr(b.booking_type, "name", "") or ""
                        n = name.lower()
                        if any(k in n for k in ("car", "own car", "pickup", "drop", "disposal")):
                            # if distance or disposal triggers exist, treat as car-related
                            # check booking details for distance or disposal flags quickly
                            details = getattr(b, "booking_details", {}) or {}
                            distance = details.get("distance_km") or details.get("distance") or None
                            is_disposal = details.get("is_disposal") or details.get("disposal") or (details.get("transport_type") == "disposal")
                            if distance:
                                try:
                                    if float(distance) > 0:
                                        car_related_trigger = True
                                        break
                                except Exception:
                                    car_related_trigger = True
                                    break
                            if is_disposal:
                                car_related_trigger = True
                                break
                    except Exception:
                        continue
                if car_related_trigger:
                    add_manager = False

            if add_manager:
                manager_user = reporting_manager if reporting_manager else self.find_user_for_role("Manager")
                if manager_user:
                    # Insert manager (or selected_approver) at start — always first in chain
                    approvers.insert(0, ApproverEntry(
                        user=manager_user,
                        level="manager",
                        sequence=1
                    ))

        # ============================================================
        # STEP 6 — Self-reporting edge case (reporting_manager == request_user)
        # If the user is their own reporting manager AND they are CEO/CHRO,
        # then drop the manager entry when CEO/CHRO is required.
        # ============================================================
        is_ceo = self.user_has_role(self.request_user, "CEO")
        is_chro = self.user_has_role(self.request_user, "CHRO")

        if reporting_manager == self.request_user:
            # If the employee IS the approver → manager should ALWAYS be removed.
            if (is_ceo and require_ceo) or (is_chro and require_chro):
                approvers = [a for a in approvers if a.level != "manager"]
        # if reporting_manager == self.request_user:
        #     if is_ceo and require_ceo:
        #         approvers = [a for a in approvers if a.level != "manager"]
        #     if is_chro and require_chro:
        #         approvers = [a for a in approvers if a.level != "manager"]

        # ============================================================
        # STEP 7 — Dedupe and normalize order
        # ============================================================
        final = self._dedupe_and_order(approvers)

        # ============================================================
        # STEP 8 — Final fallback (if still empty)
        # ============================================================
        # if not final:
        #     for role in ["Manager", "CHRO", "CEO"]:
        #         user = self.find_user_for_role(role)
        #         if user:
        #             final = [ApproverEntry(user=user, level=role.lower(), sequence=1)]
        #             break

        if not final and not getattr(self.travel_application, "self_approved", False):
            # preserve test expectation: Manager is always fallback
            mgr = self.find_user_for_role("Manager")
            if mgr:
                final = [ApproverEntry(mgr, "manager", 1)]

        # Ensure sequence numbers are contiguous and start at 1
        for i, e in enumerate(final, start=1):
            e.sequence = i

        logger.debug(
            "ApprovalEngineV2 build result for travel_app %s: %s",
            getattr(self.travel_application, "id", None),
            [f"{a.sequence}:{a.level}:{getattr(a.user, 'id', None)}" for a in final]
        )

        return final

