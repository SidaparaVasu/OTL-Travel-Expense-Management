# apps/travel/business_logic/validators.py
# Centralized validators used by travel module (copy-paste file)

from datetime import timedelta
from decimal import Decimal
from django.utils import timezone
from django.db.models import Q
from rest_framework import serializers

# models imports (assumes these models exist in your project)
from apps.master_data.models import (
    TravelPolicyMaster,
    GradeEntitlementMaster,
    DAIncidentalMaster,
    ConveyanceRateMaster
)
from apps.travel.models import TravelApplication


# --- helpers -----------------------------------------------------------------

def _get_policy(policy_type, travel_mode=None, grade=None):
    """Return active policy matching filters, or None. Policy lookup is permissive."""
    today = timezone.now().date()
    qs = TravelPolicyMaster.objects.filter(
        policy_type=policy_type,
        is_active=True,
        effective_from__lte=today
    ).filter(Q(effective_to__isnull=True) | Q(effective_to__gte=today))

    if travel_mode:
        qs = qs.filter(travel_mode=travel_mode)
    if grade:
        qs = qs.filter(employee_grade=grade)

    return qs.order_by('-effective_from').first()


# --- advance booking --------------------------------------------------------

def validate_advance_booking(departure_date, mode_name, estimated_cost=0):
    """
    Validate advance booking rules.
    - raises serializers.ValidationError on hard errors.
    - returns list of warnings (may be empty).
    """
    if not departure_date:
        # Nothing to validate
        return []

    today = timezone.now().date()
    days_ahead = (departure_date - today).days

    # mode = (mode_name or "").lower()
    # Normalize travel_mode to string name
    if hasattr(mode_name, "name"):
        mode = mode_name.name.lower()
    else:
        mode = str(mode_name).lower()
    warnings = []

    # Use TravelPolicyMaster if present else fallbacks
    # flight default = 7 days; train default = 3 days
    if "flight" in mode:
        # Get policy without travel_mode filter first
        policies = TravelPolicyMaster.objects.filter(
            policy_type="advance_booking",
            is_active=True,
            effective_from__lte=today
        ).filter(Q(effective_to__isnull=True) | Q(effective_to__gte=today))

        # Try to find Flight-specific policy
        policy = policies.filter(travel_mode__name__iexact="Flight").first()
    
        # Fallback to any advance_booking policy
        if not policy:
            policy = policies.first()

        required_days = None
        if policy and policy.rule_parameters.get("days") is not None:
            required_days = int(policy.rule_parameters.get("days"))
        else:
            required_days = 7

        if days_ahead < required_days:
            # treat as warning (non-blocking) per new requirements
            warnings.append({
                "type": "advance_booking_violation",
                "mode": "Flight",
                "message": f"Flight booking is {days_ahead} days ahead (policy: {required_days} days minimum).",
                "severity": "warning"
            })

    elif "train" in mode:
        # policy = _get_policy("advance_booking", travel_mode__name__iexact="Train")
        policy = TravelPolicyMaster.objects.filter(
            policy_type="advance_booking",
            travel_mode__name__iexact="Train",
            is_active=True,
            effective_from__lte=today
        ).filter(
            Q(effective_to__isnull=True) | Q(effective_to__gte=today)
        ).order_by('-effective_from').first()
        required_days = None
        if policy and policy.rule_parameters.get("hours") is not None:
            # some policies may be stored in hours
            required_hours = int(policy.rule_parameters.get("hours"))
            required_days = (required_hours + 23) // 24
        elif policy and policy.rule_parameters.get("days") is not None:
            required_days = int(policy.rule_parameters.get("days"))
        else:
            required_days = 3

        if days_ahead < required_days:
            warnings.append({
                "type": "advance_booking_violation",
                "mode": "Train",
                "message": f"Train booking is {days_ahead} days ahead (policy: {required_days} days minimum).",
                "severity": "warning"
            })

    # other modes - no policy by default (info)
    return warnings


# --- entitlement -------------------------------------------------------------

def validate_travel_entitlement(employee, booking_type, sub_option, city_category=None, estimated_cost=None):
    """
    Validates entitlement based on GradeEntitlementMaster.
    No unexpected filter args, safe for all booking modes.
    """

    # --- Grade Handling ---
    grade = getattr(employee, "grade", None)
    if not grade:
        raise serializers.ValidationError("Employee grade not assigned.")

    # --- Normalize Mode Name (Flight/Train/Car/etc) ---
    mode_name = None
    if hasattr(booking_type, "name"):
        mode_name = booking_type.name
    else:
        mode_name = str(booking_type)

    # --- Base Query ---
    qs = GradeEntitlementMaster.objects.filter(
        grade=grade,
        sub_option=sub_option,
        sub_option__mode__name__iexact=mode_name
    )

    # --- City Category Condition ---
    if city_category:
        # Try to find specific match first, then generic
        qs_specific = qs.all()
        if hasattr(city_category, "name"):
            qs_specific = qs_specific.filter(city_category__name__iexact=city_category.name)
        elif hasattr(city_category, "id"):
            qs_specific = qs_specific.filter(city_category=city_category.id)
        else:
            qs_specific = qs_specific.filter(city_category__name__iexact=str(city_category))
            
        entitlement = qs_specific.first()
        
        # Fallback to generic (NULL city_category) if specific not found
        if not entitlement:
            entitlement = qs.filter(city_category__isnull=True).first()
    else:
        # If no city category passed, try generic first? 
        # Or just take whatever (entitlement logic usually implies generic if not passed)
        entitlement = qs.first()

    # --- Not Allowed Case ---
    if not entitlement or not entitlement.is_allowed:
        raise serializers.ValidationError(
            f"Booking not permitted for grade '{grade.name}' "
            f"and travel option '{sub_option.name}'."
        )

    # --- Optional max_amount enforcement ---
    if estimated_cost and entitlement.max_amount and entitlement.max_amount > Decimal('0'):
        try:
           cost_dec = Decimal(str(estimated_cost))
           if cost_dec > entitlement.max_amount:
               raise serializers.ValidationError(
                   f"Estimated cost ({cost_dec}) exceeds entitlement limit ({entitlement.max_amount})."
               )
        except Exception:
           pass

    return True

'''
def validate_travel_entitlement(employee, booking_type, sub_option, city_category):
    """
    Validate grade entitlement for a booking's sub-option and city category.
    Raises ValidationError if not entitled.
    """
    # booking_type: TravelModeMaster instance or object with .id
    # sub_option: TravelSubOptionMaster instance
    # city_category: CityCategory instance or id or name

    grade = getattr(employee, "grade", None)
    if not grade:
        raise serializers.ValidationError("Employee grade not assigned.")

    grade_id = grade.id if hasattr(grade, "id") else grade
    sub_option_id = sub_option.id if hasattr(sub_option, "id") else sub_option

    # Lookup GradeEntitlementMaster
    ent_qs = GradeEntitlementMaster.objects.filter(
        grade=grade_id,
        sub_option=sub_option_id,
    )

    # city_category could be nullable; handle accordingly
    if city_category:
        if hasattr(city_category, "id"):
            ent_qs = ent_qs.filter(city_category=city_category.id)
        else:
            ent_qs = ent_qs.filter(city_category=city_category)

    ent = ent_qs.first()
    if not ent or not getattr(ent, "is_allowed", False):
        raise serializers.ValidationError(
            f"Booking not allowed for grade '{grade.name}' and selected option."
        )

    # enforce max_amount if configured
    # if ent.max_amount and ent.max_amount > Decimal('0'):
        # booking estimated cost must not exceed max_amount
        # calling code should pass estimated cost if needed. We keep check optional here.
'''

# --- own car & safety -------------------------------------------------------

def validate_own_car_booking(booking_details, distance_km):
    """
    Validate own car rules: distance cap (policy), safety attributes (airbags)
    Returns list of issues dicts. Caller can raise if any 'error' severity found.
    """
    issues = []

    # Distance validation - use parameter if provided, else try booking_details
    if distance_km is None:
        distance_km = booking_details.get('distance_km') if booking_details else None

    # distance check - from TravelPolicyMaster distance limit OR default 150
    policy = _get_policy("distance_limit", None)
    max_distance = None
    if policy:
        max_distance = policy.rule_parameters.get("max_distance")
    if max_distance is None:
        max_distance = 150

    if distance_km is None:
        # if missing treat as error
        issues.append({"severity": "error", "message": "Own-car distance not provided."})
        return issues

    try:
        dist = float(distance_km)
    except Exception:
        issues.append({"severity": "error", "message": "Invalid distance_km value."})
        return issues

    if dist > float(max_distance):
        issues.append({
            "severity": "warning",
            "message": f"Own car distance {dist}km exceeds {max_distance}km. CHRO approval required."
        })

    # Airbag validation
    # safety check - expect airbags count in booking_details
    if booking_details:
        airbags = booking_details.get("airbags")
        if airbags is None:
            issues.append({"severity": "warning", "message": "Airbags count not provided for own car."})
        else:
            try:
                airbags_n = int(airbags)
                if airbags_n < 6:
                    issues.append({"severity": "error", "message": "Own car must have minimum 6 airbags."})
            except Exception:
                issues.append({"severity": "error", "message": "Invalid airbags value."})

        # Optional checks
        fitness_ok = booking_details.get("fitness_certificate", False)
        if not fitness_ok:
            issues.append({"severity": "warning", "message": "Fitness certificate not provided for own car."})

    return issues


def validate_car_safety_requirements(booking_details):
    """
    Lower-level safety checks that raise ValidationError on hard failures.
    """
    issues = validate_own_car_booking(booking_details, booking_details.get("distance_km"))
    errors = [i for i in issues if i["severity"] == "error"]
    if errors:
        raise serializers.ValidationError({"own_car_safety": [e["message"] for e in errors]})
    return issues


# --- DA / Incidentals -------------------------------------------------------

def calculate_da_eligibility(duration_hours, distance_km=None):
    """
    Determine DA eligibility and type. Returns dict:
    {'eligible': bool, 'reason': str, 'da_type': 'half_day'|'full_day'|None}
    
    TSF Rules:
    - One-way distance MUST exceed 50km
    - Duration MUST exceed 8 hours (including travel time)
    """
    if duration_hours is None:
        return {"eligible": False, "reason": "Duration hours not provided.", "da_type": None}

    try:
        hrs = float(duration_hours)
    except Exception:
        return {"eligible": False, "reason": "Invalid duration hours.", "da_type": None}

    # Distance check
    if distance_km is not None:
        try:
            dist = float(distance_km)
            if dist <= 50:
                return {"eligible": False, "reason": f"One-way distance {dist}km does not meet 50km minimum.", "da_type": None}
        except Exception:
            return {"eligible": False, "reason": "Invalid distance value.", "da_type": None}

    # Duration check
    if hrs < 8:
        return {"eligible": False, "reason": "Travel duration less than 8 hours.", "da_type": None}

    if hrs >= 12:
        return {"eligible": True, "reason": "Full day DA eligible.", "da_type": "full_day"}

    return {"eligible": True, "reason": "Half day DA eligible.", "da_type": "half_day"}


def fetch_da_rate_for(employee, city_category):
    """Return DAIncidentalMaster record or None"""
    today = timezone.now().date()
    try:
        return DAIncidentalMaster.objects.filter(
            grade=employee.grade,
            city_category=city_category,
            is_active=True,
            effective_from__lte=today
        ).filter(Q(effective_to__isnull=True) | Q(effective_to__gte=today)).first()
    except Exception:
        return None


# --- duplicate travel -------------------------------------------------------

def validate_duplicate_travel_request(user, start_date, end_date):
    """
    Prevent overlapping travel only if existing application is still active.
    Rejected/Cancelled applications must not block new requests.
    """

    from apps.travel.models import TravelApplication
    from django.db.models import Q

    ACTIVE_STATUSES = [
        "draft",
        "submitted",
        "pending_manager",
        "approved_manager",
        "pending_chro",
        "approved_chro",
        "pending_ceo",
        "approved_ceo",
        "pending_travel_desk",
        "booking_in_progress",
        "booked",
        "completed",
    ]

    qs = TravelApplication.objects.filter(
        employee=user,
        status__in=ACTIVE_STATUSES
    ).filter(
        Q(trip_details__departure_date__lte=end_date) &
        Q(trip_details__return_date__gte=start_date)
    ).distinct()

    if qs.exists():
        raise Exception(
            "You already have an active travel application overlapping this period."
        )
    

# --- conveyance receipt rules ----------------------------------------------

def validate_booking_receipt_requirements(booking_type):
    """
    If booking type requires a receipt per ConveyanceRateMaster, raise if missing.
    Returns True if receipt required else False.
    """
    # booking_type may be TravelModeMaster or name; we try to find ConveyanceRateMaster by conveyance_type/name
    c = None
    try:
        c = ConveyanceRateMaster.objects.filter(is_active=True).first()
    except Exception:
        c = None

    # If we cannot resolve, assume behavior handled elsewhere
    # Caller will check booking_details for receipt accordingly.
    return True if c and c.requires_receipt else False


# --- max trip duration -----------------------------------------------------

def validate_max_trip_duration(departure_date, return_date, max_days=90):
    """
    Validate maximum trip duration is 90 days
    """
    if not departure_date or not return_date:
        return
    
    duration = (return_date - departure_date).days
    if duration > max_days:
        raise serializers.ValidationError(
            f"Trip duration {duration} days exceeds maximum allowed {max_days} days"
        )
    

# --- car disposal duration rule -----------------------------------------------------

def validate_car_disposal_duration(booking_details, trip_duration_days):
    """
    Car at disposal for >5 days requires CHRO approval
    """
    if trip_duration_days > 5:
        return {
            "requires_chro": True,
            "message": f"Car at disposal for {trip_duration_days} days exceeds 5-day limit. CHRO approval required.",
            "severity": "warning"
        }
    return {"requires_chro": False}


# --- DA requires for one-way distance rule -----------------------------------------------------

def validate_da_distance_requirement(distance_km):
    """
    DA requires one-way distance > 50km
    """
    if distance_km is None:
        return True, "Distance not provided"
    
    if distance_km <= 50:
        return False, f"One-way distance {distance_km}km does not meet 50km minimum for DA eligibility"
    
    return True, "Distance requirement met"