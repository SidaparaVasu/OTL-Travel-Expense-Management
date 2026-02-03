// Validation utilities for the travel application

export const formatDate = (date: Date): string => {
  return date.toISOString().split("T")[0];
};

export const parseDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
};

export const getToday = (): string => {
  return formatDate(new Date());
};

export const getMaxDate = (startDate: string): string => {
  const start = parseDate(startDate);
  if (!start) return "";
  const max = new Date(start);
  max.setDate(max.getDate() + 90);
  return formatDate(max);
};

export const getDaysDifference = (date1: string, date2: string): number => {
  const d1 = parseDate(date1);
  const d2 = parseDate(date2);
  if (!d1 || !d2) return 0;
  return Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
};

export const isDateInRange = (date: string, startDate: string, endDate: string): boolean => {
  const d = parseDate(date);
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!d || !start || !end) return false;
  return d >= start && d <= end;
};

export const isPastDate = (dateStr: string): boolean => {
  const date = parseDate(dateStr);
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
};

export const validateTripDuration = (startDate: string, endDate: string): string | null => {
  const days = getDaysDifference(startDate, endDate);
  if (days > 90) {
    return "Trip duration cannot exceed 90 days";
  }
  if (days < 0) {
    return "End date cannot be before start date";
  }
  return null;
};

export const validateAdvanceBooking = (
  departureDate: string,
  mode: "Flight" | "Train"
): string | null => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const depDate = parseDate(departureDate);
  if (!depDate) return null;

  const daysAhead = Math.floor((depDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (mode === "Flight" && daysAhead < 7) {
    return `Flight requires 7 days advance booking (current: ${daysAhead} days)`;
  }
  if (mode === "Train" && daysAhead < 3) {
    return `Train requires 72 hours (3 days) advance booking (current: ${daysAhead} days)`;
  }
  return null;
};

export const validateEndTime = (
  startDate: string,
  startTime: string,
  endDate: string,
  endTime: string
): string | null => {
  if (!startDate || !startTime || !endDate || !endTime) return null;

  if (startDate === endDate) {
    if (endTime < startTime) {
      return "End time cannot be earlier than start time on the same day";
    }
  }
  return null;
};

export const validateLocationPair = (
  fromLocation: string,
  toLocation: string
): string | null => {
  if (fromLocation && toLocation && fromLocation === toLocation) {
    return "Origin and destination cannot be the same";
  }
  return null;
};

// export const validateConveyanceLocations = (
//   pickUp: string,
//   dropOff: string,
//   isValidationLocked: boolean = false
// ): string | null => {
//   // const validPickUpLocations = ["Residence", "Hotel", "Guest House"];
//   // const validDropLocations = ["Airport", "Railway Station"];
//   const validPickUpLocations = ["Residence", "Hotel", "Guest House", "Airport", "Railway Station"];
//   const validDropLocations = ["Residence", "Hotel", "Guest House", "Airport", "Railway Station"];

//   const isValidPickUp = validPickUpLocations.includes(pickUp);
//   const isValidDrop = validDropLocations.includes(dropOff);

//   const reverseValid = validDropLocations.includes(pickUp) && validPickUpLocations.includes(dropOff);

//   if (!isValidationLocked && !((isValidPickUp && isValidDrop) || reverseValid)) {
//     return "Pick-up & Drop must be between residence/hotel/guest house and airport/railway station";
//   }
//   return null;
// };

export const validateOwnCarDistance = (distance: number): string | null => {
  if (distance > 150) {
    return "Own car travel exceeds 150 km limit. CHRO approval required.";
  }
  return null;
};

export const validateEstimatedCost = (cost: string): string | null => {
  const numCost = parseFloat(cost);
  if (isNaN(numCost) || numCost < 0) {
    return "Estimated cost must be a positive number";
  }
  return null;
};

export const isAmountWithinLimit = (maxAllowed, estimated_cost) => {
  if (!maxAllowed) return true; // no limit defined → allow
  if (!estimated_cost) return true;

  return Number(estimated_cost) <= maxAllowed;
};

export const validateSpecialInstructions = (text: string): string | null => {
  if (text && text.length > 200) {
    return "Special instructions cannot exceed 200 characters";
  }
  return null;
};

// Check for overlapping time ranges
export const hasTimeOverlap = (
  bookings: Array<{ start_date: string; start_time?: string; end_date?: string; end_time?: string }>
): boolean => {
  for (let i = 0; i < bookings.length; i++) {
    for (let j = i + 1; j < bookings.length; j++) {
      const a = bookings[i];
      const b = bookings[j];

      const aStart = new Date(`${a.start_date}T${a.start_time || "00:00"}`);
      const aEnd = new Date(`${a.end_date || a.start_date}T${a.end_time || "23:59"}`);
      const bStart = new Date(`${b.start_date}T${b.start_time || "00:00"}`);
      const bEnd = new Date(`${b.end_date || b.start_date}T${b.end_time || "23:59"}`);

      if (aStart <= bEnd && bStart <= aEnd) {
        return true;
      }
    }
  }
  return false;
};

// Helper to validate Date + Time (Validate bookings against trip window)
export const isDateTimeInRange = (
  checkDate: string,
  checkTime: string,
  startDate: string,
  startTime: string,
  endDate: string,
  endTime: string,
): boolean => {
  if (!checkDate || !startDate || !endDate) return false;

  // Create Date objects for comparison
  // Use a fixed date for time-only comparison or full timestamp
  const check = new Date(`${checkDate}T${checkTime || "00:00"}`);
  const start = new Date(`${startDate}T${startTime || "00:00"}`);
  const end = new Date(`${endDate}T${endTime || "23:59"}`);

  return check >= start && check <= end;
};

export interface BookingDateValidation {
  isValid: boolean;
  errors: Record<number, string>;
}

export const validateTicketingDates = (
  ticketing: Array<{
    departure_date: string;
    departure_time: string;
    arrival_date: string;
    arrival_time: string;
  }>,
  tripStartDate: string,
  tripStartTime: string,
  tripEndDate: string,
  tripEndTime: string,
): BookingDateValidation => {
  const errors: Record<number, string> = {};

  ticketing.forEach((ticket, index) => {
    const departureValid = isDateTimeInRange(
      ticket.departure_date,
      ticket.departure_time,
      tripStartDate,
      tripStartTime,
      tripEndDate,
      tripEndTime,
    );
    const arrivalValid = isDateTimeInRange(
      ticket.arrival_date,
      ticket.arrival_time,
      tripStartDate,
      tripStartTime,
      tripEndDate,
      tripEndTime,
    );

    if (!departureValid && !arrivalValid) {
      // errors[index] = `Departure (${ticket.departure_date}) and arrival (${ticket.arrival_date}) dates are outside trip window (${tripStartDate} to ${tripEndDate})`;
      errors[index] = `Departure and arrival times are outside trip window`;
    } else if (!departureValid) {
      // errors[index] = `Departure date (${ticket.departure_date}) is outside trip window (${tripStartDate} to ${tripEndDate})`;
      errors[index] = `Departure time is outside trip window`;
    } else if (!arrivalValid) {
      // errors[index] = `Arrival date (${ticket.arrival_date}) is outside trip window (${tripStartDate} to ${tripEndDate})`;
      errors[index] = `Arrival time is outside trip window`;
    }
  });

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

export const validateAccommodationDates = (
  accommodation: Array<{
    check_in_date: string;
    check_in_time: string;
    check_out_date: string;
    check_out_time: string;
  }>,
  tripStartDate: string,
  tripStartTime: string,
  tripEndDate: string,
  tripEndTime: string,
): BookingDateValidation => {
  const errors: Record<number, string> = {};

  accommodation.forEach((acc, index) => {
    const checkInValid = isDateTimeInRange(
      acc.check_in_date,
      acc.check_in_time,
      tripStartDate,
      tripStartTime,
      tripEndDate,
      tripEndTime,
    );
    const checkOutValid = isDateTimeInRange(
      acc.check_out_date,
      acc.check_out_time,
      tripStartDate,
      tripStartTime,
      tripEndDate,
      tripEndTime,
    );

    if (!checkInValid && !checkOutValid) {
      // errors[index] = `Check-in (${acc.check_in_date}) and check-out (${acc.check_out_date}) dates are outside trip window (${tripStartDate} to ${tripEndDate})`;
      errors[index] = `Check-in and check-out times are outside trip window`;
    } else if (!checkInValid) {
      // errors[index] = `Check-in date (${acc.check_in_date}) is outside trip window (${tripStartDate} to ${tripEndDate})`;
      errors[index] = `Check-in time is outside trip window`;
    } else if (!checkOutValid) {
      // errors[index] = `Check-out date (${acc.check_out_date}) is outside trip window (${tripStartDate} to ${tripEndDate})`;
      errors[index] = `Check-out time is outside trip window`;
    }
  });

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

export const validateConveyanceDates = (
  conveyance: Array<{
    start_date: string;
    start_time: string;
    end_date: string;
    end_time: string;
  }>,
  tripStartDate: string,
  tripStartTime: string,
  tripEndDate: string,
  tripEndTime: string,
): BookingDateValidation => {
  const errors: Record<number, string> = {};

  conveyance.forEach((conv, index) => {
    const startValid = isDateTimeInRange(
      conv.start_date,
      conv.start_time,
      tripStartDate,
      tripStartTime,
      tripEndDate,
      tripEndTime,
    );
    const endValid = isDateTimeInRange(
      conv.end_date,
      conv.end_time,
      tripStartDate,
      tripStartTime,
      tripEndDate,
      tripEndTime,
    );

    if (!startValid && !endValid) {
      // errors[index] = `Start (${conv.start_date}) and end (${conv.end_date}) dates are outside trip window (${tripStartDate} to ${tripEndDate})`;
      errors[index] = `Start and end times are outside trip window`;
    } else if (!startValid) {
      // errors[index] = `Start date (${conv.start_date}) is outside trip window (${tripStartDate} to ${tripEndDate})`;
      errors[index] = `Start time is outside trip window`;
    } else if (!endValid) {
      // errors[index] = `End date (${conv.end_date}) is outside trip window (${tripStartDate} to ${tripEndDate})`;
      errors[index] = `End time is outside trip window`;
    }
  });

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};
