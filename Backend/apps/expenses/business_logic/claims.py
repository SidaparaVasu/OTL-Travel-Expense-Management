from datetime import date, datetime, timedelta, time
from decimal import Decimal
from typing import Any, Dict, List, Optional
from django.core.exceptions import ValidationError
from django.db.models import Q

from apps.travel.models.application import TravelApplication
from apps.expenses.models import *
from apps.master_data.models.travel import GradeEntitlementMaster
from apps.master_data.models.geography import CityCategoriesMaster
from apps.master_data.models.approval import DAIncidentalMaster, ConveyanceRateMaster, ApprovalMatrix
from apps.travel.models.application import TripDetails         
import logging

logger = logging.getLogger(__name__)


# -----------------------------------------------------------
# Utility
# -----------------------------------------------------------

def _to_decimal(val) -> Decimal:
    try:
        if val is None:
            return Decimal("0")
        return Decimal(str(val))
    except:
        return Decimal("0")


def _date_from_str(v) -> Optional[date]:
    if not v:
        return None
    if isinstance(v, date):
        return v
    if isinstance(v, datetime):
        return v.date()
    try:
        return datetime.strptime(str(v), "%Y-%m-%d").date()
    except:
        return None


def _get_expense_type_code(etype) -> str:
    """Return expense type code from instance or raw value."""
    if hasattr(etype, "code"):
        return etype.code.lower()
    return str(etype).lower()

def _get_expense_type_name(etype) -> str:
    """Return expense type name from instance or raw value."""
    if hasattr(etype, "name"):
        return etype.name.lower()
    return str(etype).lower()


# --------------------------------------------------------------------
# DA MASTER FETCH
# --------------------------------------------------------------------

def _get_da_rates_for_grade(grade_name: str):
    """
    Fetch DA & incidental rates from master, grouped by city category.
    The TR provides employee_grade = "B-2A", which matches GradeMaster.name.
    """
    today = date.today()
    result = {}

    # Fetch all DA rows for grade & active date range
    rows = DAIncidentalMaster.objects.filter(
        grade__name=grade_name,
        is_active=True,
        effective_from__lte=today
    ).filter(
        Q(effective_to__isnull=True) | Q(effective_to__gte=today)
    )

    if not rows.exists():
        # Master data missing -> validation error (or fallback empty)
        # We raise a validation error here as per previous logic, 
        # but in production, might want soft failure.
        # Keeping it strict for now.
        raise ValidationError({
            "da_master": [f"DA/Incidental master data not found for grade '{grade_name}'."]
        })

    for r in rows:
        cat = r.city_category.name  # "A", "B", "C"
        result[cat] = {
            "full": _to_decimal(r.da_full_day),
            "half": _to_decimal(r.da_half_day),
            "inc_full": _to_decimal(r.incidental_full_day),
            "inc_half": _to_decimal(r.incidental_half_day),
            # Also store stay allowances for future use
            "stay_a": _to_decimal(r.stay_allowance_category_a),
            "stay_b": _to_decimal(r.stay_allowance_category_b),
        }

    return result

def _get_city_category_for_date(trips, current_date: date) -> str:
    """
    Find the city category for a given date based on TripDetails.
    """
    # Finding the trip segment that covers this date
    # Logic: If date is between departure and return of a trip
    # Naive assumption: sequential trips.
    
    # Sort trips by date just in case
    sorted_trips = trips.order_by("departure_date")
    
    for trip in sorted_trips:
        start = _date_from_str(trip.departure_date)
        end = _date_from_str(trip.return_date)
        if start and end and start <= current_date <= end:
            # Rule: If "Stay at Revenue Village" is selected in any booking for this trip, force Category C
            if trip.bookings.filter(sub_option__name__iexact="Stay at Revenue Village").exists():
                return "C"
            return trip.get_city_category() or "B"
    
    # Fallback: if between trips or not found, pick the destination of the last trip before this date
    # or just default to B.
    return "B"


# --------------------------------------------------------------------
# MAIN: DA CALCULATION WITH FIXED DATE EXTRACTION
# --------------------------------------------------------------------

def calculate_da_breakdown(tr: TravelApplication) -> List[Dict[str, Any]]:
    """
    Calculate DA/Incidental for each day of travel.
    Respects actual travel dates/times if provided.
    """

    # ---------- Extract travel dates ----------
    # Use actual dates if provided, else fallback to TR dates
    start = actual_start_date or _date_from_str(getattr(tr, "start_date", None))
    end = actual_end_date or _date_from_str(getattr(tr, "end_date", None))

    trips = tr.trip_details.all()

    # Fallback to TripDetails table if basic dates missing (and no actuals)
    if not start or not end:
        if trips.exists():
            # If actuals not provided, try to infer from trips
            if not start:
                first_trip = trips.order_by("departure_date").first()
                start = _date_from_str(first_trip.departure_date) if first_trip else None
            if not end:
                last_trip = trips.order_by("-return_date").first()
                end = _date_from_str(last_trip.return_date) if last_trip else None

    if not start or not end:
        return []  # cannot calculate

    # ---------- Grade ----------
    grade_code = getattr(getattr(tr, "employee", None), "grade", None) or "B-3"
    da_master = _get_da_rates_for_grade(grade_code)

    # ---------- Build breakdown ----------
    results = []
    
    curr = start
    while curr <= end:
        # Determine City Category for this specific date
        cat = _get_city_category_for_date(trips, curr)

        if cat not in da_master:
            # Fallback
            keys = list(da_master.keys())
            cat = keys[0] if keys else "B"
            
        daily_rates = da_master.get(cat, da_master.get("B", {}))
        
        # Calculate Duration
        # Default: 24 hours (full day)
        duration_hours = Decimal(24)
        
        # --- Logic for Start Time ---
        st = None
        # If Current Day is Actual Start Date -> Use Actual Start Time
        if actual_start_date and curr == actual_start_date:
            st = actual_start_time
        # Else check trips for departure match (Standard logic)
        elif not actual_start_date:
            start_trip = trips.filter(departure_date=curr).first()
            if start_trip:
                st = start_trip.start_time
        
        # --- Logic for End Time ---
        et = None
        # If Current Day is Actual End Date -> Use Actual End Time
        if actual_end_date and curr == actual_end_date:
            et = actual_end_time
        # Else check trips for return match (Standard logic)
        elif not actual_end_date:
            end_trip = trips.filter(return_date=curr).first()
            if end_trip:
                et = end_trip.end_time
        
        # --- Compute Duration based on st/et ---
        
        # Case 1: Single Day (Start & End on same day)
        if curr == start and curr == end:
             if st and et:
                 # Calculate diff
                 dt_start = datetime.combine(curr, st)
                 dt_end = datetime.combine(curr, et)
                 diff = dt_end - dt_start
                 duration_hours = Decimal(diff.total_seconds() / 3600)
             else:
                 # Fallback
                 duration_hours = Decimal(12) 
                 
        # Case 2: Start Day (but not End Day)
        elif curr == start:
             if st:
                 duration = 24 - (st.hour + st.minute/60.0)
                 duration_hours = Decimal(duration)
                 
        # Case 3: End Day (but not Start Day)
        elif curr == end:
             if et:
                 duration = et.hour + et.minute/60.0
                 duration_hours = Decimal(duration)
        
        # Case 4: Middle Day -> 24 hours (already set)
        
        # Sanity check
        if duration_hours < 0: duration_hours = Decimal(0)
        if duration_hours > 24: duration_hours = Decimal(24)

        if duration_hours > 12:
            da = daily_rates.get("full", Decimal(0))
            inc = daily_rates.get("inc_full", Decimal(0))
        elif duration_hours >= 8:
            da = daily_rates.get("half", Decimal(0))
            inc = daily_rates.get("inc_half", Decimal(0))
        else:
            da = Decimal("0")
            inc = Decimal("0")

        results.append({
            "date": curr,
            "duration_hours": float(round(duration_hours, 2)),
            "city_category": cat,
            "eligible": da > 0,
            "da": da,
            "incidental": inc
        })

        curr += timedelta(days=1)

    return results

def get_grade_entitlement_limit(grade_name, city_category_name, sub_option_name="Hotel/Guest House"):
    """
    Fetch max_amount for a specific grade, city cat, and sub_option.
    Returns: Decimal limit or None if not found/unlimited.
    """
    # Try specific city category first
    ent = GradeEntitlementMaster.objects.filter(
        grade__name=grade_name,
        sub_option__name__icontains=sub_option_name,
        city_category__name=city_category_name,
        is_allowed=True
    ).first()
    
    if ent and ent.max_amount:
        return ent.max_amount

    # Try 'All Cities' (null city_category)
    ent_all = GradeEntitlementMaster.objects.filter(
        grade__name=grade_name,
        sub_option__name__icontains=sub_option_name,
        city_category__isnull=True,
        is_allowed=True
    ).first()

    if ent_all:
        return ent_all.max_amount
    
    return None



# --------------------------------------------------------------------
# DUPLICATE CLAIM CHECK
# --------------------------------------------------------------------

def check_duplicate_claim(tr: TravelApplication, exclude_claim_id=None):
    qs = ExpenseClaim.objects.filter(travel_application=tr)
    if exclude_claim_id:
        qs = qs.exclude(id=exclude_claim_id)
    return qs.exists()


# --------------------------------------------------------------------
# MAIN VALIDATION
# --------------------------------------------------------------------

def validate_claim_payload(
    payload: Dict[str, Any],
    tr: Optional[TravelApplication] = None,
    travel_application: Optional[TravelApplication] = None,
    exclude_claim_id: Optional[int] = None
):
    """
    Core validation function.
    """

    # Normalization: accept either argument name
    if travel_application is not None and tr is None:
        tr = travel_application

    errors = {}
    warnings = {}
    computed = {}

    # 1 — Get TR
    if not tr:
        tr_id = payload.get("travel_application_id")
        tr = TravelApplication.objects.filter(id=tr_id).first()

    if not tr:
        errors["travel_request"] = ["Travel application not found."]
        return {"errors": errors, "warnings": warnings, "computed": computed}

    # 2 — Validate TR status for claim
    if tr.status != "completed":
        errors["travel_request.status"] = [
            f"Claims allowed only when travel is completed. Current status: {tr.status}"
        ]
        return {"errors": errors, "warnings": warnings, "computed": computed}

    # 3 — Validate Guest Restriction
    if tr.travel_for == 'guest':
        errors["travel_request"] = ["Expense claims are not allowed for Guest travel applications."]
        return {"errors": errors, "warnings": warnings, "computed": computed}

    # 4 — Prevent duplicate claims
    # If explicit exclude_claim_id passed, use it.
    # Also check payload for 'claim_id' (common in edit/validate scenarios)
    claim_id_to_exclude = exclude_claim_id or payload.get("claim_id")
    
    if check_duplicate_claim(tr, exclude_claim_id=claim_id_to_exclude):
        errors["duplicate"] = ["Claim already submitted for this travel."]
        return {"errors": errors, "warnings": warnings, "computed": computed}

    # 4 — DA Breakdown
    
    # Helper to parse time string/obj
    def _to_time(v):
        if not v: return None
        if isinstance(v, (datetime, time)): return v if isinstance(v, time) else v.time()
        try: return datetime.strptime(str(v), "%H:%M:%S").time()
        except: 
            try: return datetime.strptime(str(v), "%H:%M").time()
            except: return None

    try:
        breakdown = calculate_da_breakdown(
            tr,
            actual_start_date=_date_from_str(payload.get("actual_travel_start_date")),
            actual_start_time=_to_time(payload.get("actual_travel_start_time")),
            actual_end_date=_date_from_str(payload.get("actual_travel_end_date")),
            actual_end_time=_to_time(payload.get("actual_travel_end_time"))
        )
    except ValidationError as e:
        errors.update(e.message_dict)
        return {"errors": errors, "warnings": warnings, "computed": computed}

    if not breakdown:
        warnings.setdefault("trip_dates", []).append(
            "Travel dates missing in TravelApplication/TripDetails."
        )

    total_da = sum([row["da"] for row in breakdown])
    total_inc = sum([row["incidental"] for row in breakdown])

    computed["da_breakdown"] = breakdown
    computed["total_da"] = _to_decimal(total_da)
    computed["total_incidental"] = _to_decimal(total_inc)

    # 4b — Prepare Stay Allowance Rates (from DA Master)
    # We re-fetch DA master here for the grade to get stay allowances
    try:
        emp = getattr(tr, "employee", None)
        # Handle case where emp is None or grade attr missing
        grade = getattr(emp, "grade", None) if emp else "B-3"
        
        logger.info(f"Fetching DA rates for grade: {grade} (Employee: {emp})")
        da_rates_map = _get_da_rates_for_grade(grade)
    except Exception as e:
        logger.error(f"Failed to fetch DA rates map: {e}")
        # Use empty map or re-raise if critical?
        da_rates_map = {}
        # We might want to warn
        warnings.setdefault("master_data", []).append(f"Could not fetch DA Master for grade {grade}: {str(e)}")

    # 5 — Expenses
    items = payload.get("items", [])
    total_exp = Decimal("0")
    
    # 5a — Get Common Policy Data
    today = date.today()
    grade_code = getattr(getattr(tr, "employee", None), "grade", None) or "B-3"
    
    # Fetch all active conveyance rates
    conveyance_rates = {
        cr.conveyance_type: cr.rate_per_km 
        for cr in ConveyanceRateMaster.objects.filter(is_active=True, effective_from__lte=today)
    }
    # Fallback default
    default_rate = conveyance_rates.get('taxi_without_receipt') or conveyance_rates.get('own_vehicle') or Decimal("15.00")

    # Fetch Approval Matrix for Grade (specifically for Car logic)
    # Finding matrix for "Car/Taxi" -> assuming travel_mode name logic or ID
    # For simplicity, we search generic matrices for this grade
    approval_rules = ApprovalMatrix.objects.filter(
        employee_grade__name=grade_code,
        is_active=True
    )
    
    # Helper to check approvals
    approval_requirements = set()

    for idx, item in enumerate(items):
        prefix = f"items[{idx}]"

        # expense_type is FK instance after serializer (Submit) OR int ID (Edit/Validate)
        etype = item.get("expense_type")
        if isinstance(etype, (int, str)):
             try:
                 etype = ExpenseTypeMaster.objects.get(pk=int(etype))
                 item["expense_type"] = etype # Update item for later logic
             except (ValueError, ExpenseTypeMaster.DoesNotExist):
                 pass

        code = _get_expense_type_code(etype)

        # date
        if not item.get("expense_date"):
            errors.setdefault(f"{prefix}.expense_date", []).append("Expense date required.")

        # amount
        amt = _to_decimal(item.get("amount", 0))
        if amt < 0:
            errors.setdefault(f"{prefix}.amount", []).append("Amount cannot be negative.")
        total_exp += amt

        # receipt rules
        has_receipt = item.get("has_receipt", True)
        if code in ("hotel", "flight", "train", "taxi"):
            # If item is linked to a booking (has booking_id) OR has receipt, it's valid.
            # If neither, and it's a required type, warn.
            is_booking = item.get("booking_id") or item.get("is_booking") or item.get("is_booking_expense")
            
            if not has_receipt and not is_booking:
                warnings.setdefault(f"{prefix}.receipt", []).append(
                    "Receipt missing for required expense type."
                )

        # --------------------------------------------------------------------------------
        # 7. NEW: ACCOMMODATION RULES
        # --------------------------------------------------------------------------------
        
        # A) Hotel Limit Check
        if code == 'hotel':
             # Find duration of stay from dates? or just check Total Amount vs (Limit * 1 day)?
             # Ideally validation should check "Check-In" / "Check-Out" but ExpenseItem only has `expense_date`.
             # We will assume each "Hotel" line item represents 1 night unless specified.
             # BETTER: Check simple daily limit. If amount > limit, warn.
             
             # Need city category for this expense
             city_cat = item.get("city_category") or "B" 
             
             limit = get_grade_entitlement_limit(grade_code, city_cat, "Hotel")
             
             if limit and amt > limit:
                 warnings.setdefault(f"{prefix}.approval", []).append(
                     f"Hotel expense {amt} exceeds entitlement {limit}. Requires CHRO Approval."
                 )
                 approval_requirements.add("CHRO")

        # B) Own Stay Allowance Check
        # Expense type code for this needs to be known. Assuming 'own_accommodation' or similar.
        if code in ('own_accommodation', 'own_arrangement', 'stay_allowance'):
             # Determine rate based on city category
             city_cat = item.get("city_category") or "B"
             
             # Fetch rates for this grade (using the map we fetched earlier)
             # da_rates_map[cat] -> {stay_a, stay_b}
             
             rate_key = "stay_a" if city_cat == "A" else "stay_b"
             # Safe fallback
             grade_rates = da_rates_map.get(city_cat, da_rates_map.get("B", {}))
             allowed_rate = grade_rates.get(rate_key, Decimal(0))
             
             if allowed_rate > 0 and amt > allowed_rate:
                  errors.setdefault(f"{prefix}.amount", []).append(
                      f"Own Stay Allowance {amt} exceeds permissible rate {allowed_rate} for Category {city_cat}."
                  )
             elif allowed_rate == 0:
                  # Maybe validation missing or zero entitlement?
                  pass
        if etype.is_distance_based:
            dist_km = _to_decimal(item.get("distance_km") or 0)
            
            if dist_km <= 0:
                 errors.setdefault(f"{prefix}.distance_km", []).append("Distance (km) required.")
            
            # Rate Validation / Calculation fallback
            # Note: amount is usually user-input, but we can validate it against rate
            # Determine rate type
            rate = default_rate
            if code == 'own_car':
                rate = conveyance_rates.get('own_vehicle', default_rate)
            elif code == 'taxi':
                rate = conveyance_rates.get('taxi_without_receipt', default_rate)

            # Check Max Distance & Approval Rules
            # Filter matrices that might apply to this distance
            # We look for any rule that has distance_limit_km
            relevant_rules = approval_rules.filter(distance_limit_km__isnull=False)
            
            for rule in relevant_rules:
                limit = rule.distance_limit_km
                if limit and dist_km > limit:
                     # Check what approvals needed
                     if rule.requires_chro or rule.requires_chro_for_distance:
                         warnings.setdefault(f"{prefix}.approval", []).append(
                             f"Distance {dist_km}km exceeds limit {limit}km. Requires CHRO Approval."
                         )
                         approval_requirements.add("CHRO")
                     elif rule.requires_ceo:
                         warnings.setdefault(f"{prefix}.approval", []).append(
                             f"Distance {dist_km}km exceeds limit {limit}km. Requires CEO Approval."
                         )
                         approval_requirements.add("CEO")


    computed["total_expenses"] = total_exp
    computed["approval_requirements"] = list(approval_requirements)

    # 6 — Advance
    adv = Decimal("0")
    
    # Sum all booking advances
    all_trips = tr.trip_details.all()
    for trip in all_trips:
        for b in trip.bookings.all():
            adv += _to_decimal(b.estimated_cost or 0)

    # Add "other expenses" advance from TravelApplication
    adv += _to_decimal(tr.advance_amount or 0)

    computed["advance_received"] = adv

    # 7 — Final total
    gross = computed["total_da"] + computed["total_incidental"] + computed["total_expenses"]
    final_amt = gross - adv

    computed["gross_total"] = gross
    computed["final_amount"] = final_amt

    computed["policy_summary"] = {
        "da_rates_source": "master",
        "per_km_rate_default": str(default_rate),
        "approval_matrix_active": approval_rules.exists()
    }

    return {"errors": errors, "warnings": warnings, "computed": computed}


# --------------------------------------------------------------------
# PREPARE FINAL OBJECT (before saving)
# --------------------------------------------------------------------

def compute_claim_totals_and_prepare(
    payload,
    tr: TravelApplication = None,
    travel_application: TravelApplication = None,
    exclude_claim_id: int = None
):
    """
    Supports both 'tr' and 'travel_application' for compatibility.
    """

    # Normalization
    if travel_application is not None and tr is None:
        tr = travel_application

    result = validate_claim_payload(payload, tr=tr, exclude_claim_id=exclude_claim_id)

    if result["errors"]:
        return result

    computed = result["computed"]
    items = payload.get("items", [])

    prepared_items = []
    for item in items:
        amt = _to_decimal(item["amount"])
        prepare_booking_flag = item.get("is_booking_expense", False)
        if item.get("booking_id"):
            prepare_booking_flag = True

        prepared_items.append({
            "expense_type": item["expense_type"],
            "expense_date": _date_from_str(item.get("expense_date")),
            "amount": amt,
            "booking_id": item.get("booking_id"), # Pass booking_id if present
            "is_booking_expense": prepare_booking_flag,
            "has_receipt": item.get("has_receipt", True),
            "receipt_file": item.get("receipt_file"),
            "is_self_certified": item.get("is_self_certified", False),
            "self_certified_reason": item.get("self_certified_reason", ""),
            "distance_km": item.get("distance_km"),
            "vendor_name": item.get("vendor_name", ""),
            "bill_number": item.get("bill_number", ""),
            "city_category": item.get("city_category", ""),
            "remarks": item.get("remarks", "")
        })

    return {
        **result,
        "items_prepared": prepared_items,
        "total_da": computed["total_da"],
        "total_incidental": computed["total_incidental"],
        "total_expenses": computed["total_expenses"],
        "advance_received": computed["advance_received"],
        "final_amount": computed["final_amount"],
    }

