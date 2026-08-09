import { TripWithCategories, Booking, TravelAdvanceData } from '@/src/types/travel.types';

// UI format → Backend format
export function transformToBackend(trips: TripWithCategories[]) {
  return trips.map(trip => ({
    ...trip.tripDetails,
    bookings: [
      ...trip.ticketing.map(t => ticketingToBooking(t)),
      ...trip.accommodation.map(a => accommodationToBooking(a)),
      ...trip.conveyance.map(c => conveyanceToBooking(c))
    ],
    travel_advance: trip.travelAdvance
  }));
}

// Backend format → UI format
export function transformFromBackend(tripDetails: any[]): TripWithCategories[] {
  return tripDetails.map(trip => ({
    tripDetails: {
      from_location: trip.from_location,
      to_location: trip.to_location,
      departure_date: trip.departure_date,
      return_date: trip.return_date,
      trip_purpose: trip.trip_purpose,
      guest_count: trip.guest_count,
      bookings: trip.bookings || [] 
    },
    ticketing: trip.bookings
      .filter((b: any) => b.booking_category === 'ticketing')
      .map(bookingToTicketing),
    accommodation: trip.bookings
      .filter((b: any) => b.booking_category === 'accommodation')
      .map(bookingToAccommodation),
    conveyance: trip.bookings
      .filter((b: any) => b.booking_category === 'conveyance')
      .map(bookingToConveyance),
    travelAdvance: trip.travel_advance || getEmptyAdvance()
  }));
}

// Helper converters
function ticketingToBooking(t: any): Booking {
  return {
    booking_type: t.booking_type,
    sub_option: t.sub_option,
    estimated_cost: t.estimated_cost,
    special_instruction: t.special_instruction,
    booking_details: {
      category: 'ticketing',
      from_location: t.from_location,
      to_location: t.to_location,
      departure_date: t.departure_date,
      departure_time: t.departure_time,
      arrival_date: t.arrival_date,
      arrival_time: t.arrival_time
    }
  };
}

function accommodationToBooking(a: any): Booking {
  return {
    booking_type: a.booking_type || 0,
    estimated_cost: a.estimated_cost,
    special_instruction: a.special_instruction,
    booking_details: {
      category: 'accommodation',
      accommodation_type: a.accommodation_type,
      guest_house_id: a.guest_house_id,
      hotel_name: a.hotel_name || '',
      place: a.place,
      arrival_date: a.arrival_date,
      arrival_time: a.arrival_time,
      departure_date: a.departure_date,
      departure_time: a.departure_time
    }
  };
}

function conveyanceToBooking(c: any): Booking {
  return {
    booking_type: c.booking_type,
    sub_option: c.sub_option,
    estimated_cost: c.estimated_cost,
    special_instruction: c.special_instruction,
    booking_details: {
      category: 'conveyance',
      vehicle_type: c.vehicle_type,
      from_location: c.from_location,
      to_location: c.to_location,
      start_date: c.start_date,
      start_time: c.start_time,
      end_date: c.end_date,
      end_time: c.end_time,
      drop_location: c.drop_location
    }
  };
}

function bookingToTicketing(b: any) {
  const d = b.booking_details;
  return {
    id: b.id,
    from_location: d.from_location,
    to_location: d.to_location,
    departure_date: d.departure_date,
    departure_time: d.departure_time,
    arrival_date: d.arrival_date,
    arrival_time: d.arrival_time,
    booking_type: b.booking_type,
    sub_option: b.sub_option,
    estimated_cost: b.estimated_cost,
    special_instruction: b.special_instruction
  };
}

function bookingToAccommodation(b: any) {
  const d = b.booking_details;
  return {
    id: b.id,
    accommodation_type: d.accommodation_type,
    guest_house_id: d.guest_house_id,
    hotel_name: d.hotel_name,
    place: d.place,
    arrival_date: d.arrival_date,
    arrival_time: d.arrival_time,
    departure_date: d.departure_date,
    departure_time: d.departure_time,
    booking_type: b.booking_type,
    estimated_cost: b.estimated_cost,
    special_instruction: b.special_instruction
  };
}

function bookingToConveyance(b: any) {
  const d = b.booking_details;
  return {
    id: b.id,
    vehicle_type: d.vehicle_type,
    from_location: d.from_location,
    to_location: d.to_location,
    start_date: d.start_date,
    start_time: d.start_time,
    end_date: d.end_date,
    end_time: d.end_time,
    drop_location: d.drop_location,
    booking_type: b.booking_type,
    estimated_cost: b.estimated_cost,
    special_instruction: b.special_instruction
  };
}

function getEmptyAdvance(): TravelAdvanceData {
  return {
    air_fare: 0,
    train_fare: 0,
    lodging_fare: 0,
    conveyance_fare: 0,
    other_expenses: 0,
    special_instruction: '',
    total: 0
  };
}