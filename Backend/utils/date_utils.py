from datetime import date

def calculate_age(born: date) -> int:
    """
    Calculates age given a birth date.
    Args:
        born (date): The date of birth.
    Returns:
        int: The age in years.
    """
    if born is None:
        return 0
    
    today = date.today()
    try:
        birthday = born.replace(year=today.year)
    except ValueError:
        # Raised when birth date is February 29 and the current year is not a leap year
        birthday = born.replace(year=today.year, month=born.month + 1, day=1)
    
    if birthday > today:
        return today.year - born.year - 1
    else:
        return today.year - born.year
