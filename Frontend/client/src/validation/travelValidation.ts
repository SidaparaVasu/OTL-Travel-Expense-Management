import { TripDetail, Booking } from '@/src/types/travel.types';

export interface ValidationError {
  field: string;
  message: string;
  tripIndex?: number;
  bookingIndex?: number;
}

export const validateField = (
  field: string,
  formData: any,
  trips: TripDetail[]
): ValidationError[] => {
  const allErrors = validateTravelApplication(formData, trips);
  return allErrors.filter((error) => error.field === field);
};

export const validateTravelApplication = (
  formData: any,
  trips: TripDetail[]
): ValidationError[] => {
  const errors: ValidationError[] = [];

  // Basic Information Validation
  if (!formData.purpose.trim()) {
    errors.push({ field: 'purpose', message: 'Purpose of travel is required' });
  } else if (formData.purpose.length < 10) {
    errors.push({ field: 'purpose', message: 'Purpose must be at least 10 characters' });
  }

  if (!formData.internal_order.trim()) {
    errors.push({ field: 'internal_order', message: 'Internal Order (IO) is required' });
  }

  if (!formData.general_ledger) {
    errors.push({ field: 'general_ledger', message: 'GL Code is required' });
  }

  if (!formData.sanction_number.trim()) {
    errors.push({ field: 'sanction_number', message: 'Sanction Number is required' });
  }

  // Trip Validation
  if (trips.length === 0) {
    errors.push({ field: 'trips', message: 'At least one trip is required' });
  }

  trips.forEach((trip, tripIndex) => {
    if (!trip.from_location || trip.from_location === 0) {
      errors.push({
        field: 'from_location',
        message: 'From location is required',
        tripIndex,
      });
    }

    if (!trip.to_location || trip.to_location === 0) {
      errors.push({
        field: 'to_location',
        message: 'To location is required',
        tripIndex,
      });
    }

    if (trip.from_location === trip.to_location && trip.from_location !== 0) {
      errors.push({
        field: 'to_location',
        message: 'From and To locations cannot be same',
        tripIndex,
      });
    }

    if (!trip.departure_date) {
      errors.push({
        field: 'departure_date',
        message: 'Departure date is required',
        tripIndex,
      });
    }

    if (!trip.return_date) {
      errors.push({
        field: 'return_date',
        message: 'Return date is required',
        tripIndex,
      });
    }

    // Date logic validation
    if (trip.departure_date && trip.return_date) {
      const departure = new Date(trip.departure_date);
      const returnDate = new Date(trip.return_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (departure < today) {
        errors.push({
          field: 'departure_date',
          message: 'Departure date cannot be in the past',
          tripIndex,
        });
      }

      if (returnDate < departure) {
        errors.push({
          field: 'return_date',
          message: 'Return date must be after departure date',
          tripIndex,
        });
      }

      // Check advance booking (7 days for ticketing, 3 days is a legacy stub — server enforces actual rules)
      const daysUntilDeparture = Math.ceil((departure.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      trip.bookings.forEach((booking, bookingIndex) => {
        if (booking.booking_category === 'ticketing') {
          if (daysUntilDeparture < 7) {
            errors.push({
              field: 'departure_date',
              message: 'Ticketing bookings (Flight/Train) require 7 days advance notice',
              tripIndex,
              bookingIndex,
            });
          }
        }
      });
    }

    // Booking validation
    // if (trip.bookings.length === 0) {
    //   errors.push({
    //     field: 'bookings',
    //     message: 'At least one booking is required',
    //     tripIndex,
    //   });
    // }

    trip.bookings.forEach((booking, bookingIndex) => {
      if (!booking.booking_type || booking.booking_type === 0) {
        errors.push({
          field: 'booking_type',
          message: 'Travel mode is required',
          tripIndex,
          bookingIndex,
        });
      }

      // if (!booking.estimated_cost || parseFloat(booking.estimated_cost) <= 0) {
      //   errors.push({
      //     field: 'estimated_cost',
      //     message: 'Estimated cost must be greater than 0',
      //     tripIndex,
      //     bookingIndex,
      //   });
      // }

      // Flight cost validation (>10,000 requires CEO approval warning)
      if (booking.booking_category === 'ticketing' && parseFloat(booking.estimated_cost) > 10000) {
        errors.push({
          field: 'estimated_cost',
          message: 'Ticketing cost exceeds ₹10,000 - CEO approval may be required',
          tripIndex,
          bookingIndex,
        });
      }
    });
  });

  return errors;
};

export const getErrorMessage = (
  errors: ValidationError[],
  field: string,
  tripIndex?: number,
  bookingIndex?: number
): string | null => {
  const error = errors.find(
    (e) =>
      e.field === field &&
      e.tripIndex === tripIndex &&
      e.bookingIndex === bookingIndex
  );
  return error ? error.message : null;
};