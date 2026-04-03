from datetime import datetime, date

def calculate_age(dob):
    """
    Calculates age from date of birth.
    Can handle date objects, datetime objects, and strings.
    """
    if not dob or dob == 'N/A':
        return "N/A"
    
    # If already a date or datetime object
    if isinstance(dob, (date, datetime)):
        if isinstance(dob, datetime):
            dob = dob.date()
    # If it's a string, try to parse it
    elif isinstance(dob, str):
        # Step 1: Clean the month format (remove dot) if present (e.g., "Jan. 01, 1990")
        dob_str = dob.replace('.', '')
        try:
            # Try the expected format
            dob = datetime.strptime(dob_str, "%b %d, %Y").date()
        except ValueError:
            # Fallback to common formats
            try:
                # Try ISO format or simple date string
                from dateutil import parser
                dob = parser.parse(dob_str).date()
            except (ValueError, ImportError, OverflowError):
                try:
                    # Very basic fallback if dateutil is not available
                    dob = date.fromisoformat(dob_str[:10])
                except ValueError:
                    return "N/A"
    else:
        return "N/A"

    # Step 3: Calculate age
    today = date.today()
    age = today.year - dob.year

    # Adjust if birthday not yet occurred this year
    if (today.month, today.day) < (dob.month, dob.day):
        age -= 1

    return age

# Example usage
if __name__ == "__main__":
    print(f"Age from string: {calculate_age('Apr 01, 1990')}")
    print(f"Age from date object: {calculate_age(date(1990, 4, 1))}")
    print(f"Age from N/A: {calculate_age('N/A')}")
    print(f"Age from N/A: {calculate_age('')}")
    print(f"Age from N/A: {calculate_age(' ')}")
    print(f"Age from N/A: {calculate_age(None)}")
    print(f"Age from N/A: {calculate_age(123)}")
    print(f"Age from N/A: {calculate_age(123.45)}")
    print(f"Age from N/A: {calculate_age('123.45')}")
