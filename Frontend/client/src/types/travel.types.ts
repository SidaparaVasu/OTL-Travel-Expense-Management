// Base / Master Data Types
export interface Location {
  location_id: number;
  location_name: string;
  location_code: string;
  city_name: string;
}

export interface TravelMode {
  id: number;
  name: string;
  description: string;
}

export interface TravelSubOption {
  id: number;
  mode: number;
  mode_name: string;
  name: string;
  description: string;
}

export interface GLCode {
  id: number;
  vertical_name: string;
  description: string;
  gl_code: string;
}

// Booking Types (Category-wise)
export interface TicketingBooking {
  id?: number;
  from_location: string;
  to_location: string;
  departure_date: string;
  departure_time: string;
  arrival_date?: string; // for round-trip
  arrival_time?: string;
  booking_type: string; // travel mode id
  sub_option?: number;
  estimated_cost: string;
  special_instruction: string;
}

export interface AccommodationBooking {
  id?: number;
  accommodation_type: "company" | "self";
  guest_house_id?: number;
  hotel_name?: string;
  place: string;
  arrival_date: string;
  arrival_time: string;
  departure_date: string;
  departure_time: string;
  booking_type: string;
  estimated_cost: string;
  special_instruction: string;
}

export interface ConveyanceBooking {
  id?: number;
  vehicle_type: string;
  from_location: string;
  to_location: string;
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
  drop_location: string;
  booking_type: string;
  sub_option?: number; // Add this if missing
  estimated_cost: string;
  special_instruction: string;
}

// Unified Booking Structure
export interface Booking {
  id?: number;
  booking_type: number;
  booking_type_name?: string;
  sub_option?: number;
  sub_option_name?: string;
  estimated_cost: string;
  special_instruction?: string;
  booking_details: Record<string, any>;
}

// Travel Advance
export interface TravelAdvanceData {
  air_fare: number;
  train_fare: number;
  lodging_fare: number;
  conveyance_fare: number;
  other_expenses: number;
  special_instruction: string;
  total: number;
}

// Trip Structure
export interface TripDetail {
  id?: number;
  trip_mode?: "one-way" | "round-trip";
  from_location: number;
  from_location_name?: string;
  to_location: number;
  to_location_name?: string;
  departure_date: string;
  return_date: string;
  trip_purpose: string;
  guest_count: number;
  duration_days?: number;
  city_category?: string;
  bookings: Booking[];
}

export interface TripWithCategories {
  bookings: any;
  tripDetails: TripDetail;
  ticketing: TicketingBooking[];
  accommodation: AccommodationBooking[];
  conveyance: ConveyanceBooking[];
  travelAdvance: TravelAdvanceData;
}

// Travel Applications
export interface TravelApplicationRequest {
  purpose: string;
  internal_order: string;
  general_ledger: number;
  sanction_number: string;
  advance_amount: string;
  trip_details: TripDetail[];
}

export interface TravelApplication {
  id: number;
  employee_name: string;
  employee_grade: string;
  purpose: string;
  internal_order: string;
  general_ledger: number;
  gl_code_name: string;
  sanction_number: string;
  advance_amount: string;
  estimated_total_cost: string;
  status: string;
  travel_request_id: string;
  total_duration_days: number;
  created_at: string;
  submitted_at: string;
  trip_details: TripDetail[];
}

// Statistics
export interface TravelStats {
  total_applications: number;
  draft: number;
  pending: number;
  approved: number;
  rejected: number;
}
// Pagination
export interface PaginationMeta {
  total: number;
  count: number;
  per_page: number;
  current_page: number;
  total_pages: number;
  next: string | null;
  previous: string | null;
}

export interface TravelApplicationResponse {
  data: {
    applications: TravelApplication[];
    statistics: TravelStats;
  };
  meta: {
    pagination: PaginationMeta;
  };
}
