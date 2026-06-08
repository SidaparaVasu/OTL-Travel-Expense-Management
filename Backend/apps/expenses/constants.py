CLAIM_MANAGER_APPROVAL_REQUIRED = False

# Daily Allowance (DA) and Incidental Rules
MIN_DISTANCE_FOR_DA_KM = 50                  # One-way distance must exceed this value (km)
MIN_TOTAL_DURATION_FOR_DA_HOURS = 8          # Total tour duration must exceed this value (hours)
HALF_DAY_DURATION_THRESHOLD_HOURS = 8        # Daily duration above which Half DA is granted (hours)
FULL_DAY_DURATION_THRESHOLD_HOURS = 12       # Daily duration above which Full DA is granted (hours)

# Fallbacks / Default Values
DEFAULT_EMPLOYEE_GRADE = "B-3"
DEFAULT_CITY_CATEGORY = "B"
DEFAULT_CONVEYANCE_RATE_PER_KM = 15.00       # Fallback conveyance rate per km

# Bypass flag for distance validation
# Set to True because the system currently does not collect estimated_distance_km from the user.
BYPASS_DISTANCE_VALIDATION = False