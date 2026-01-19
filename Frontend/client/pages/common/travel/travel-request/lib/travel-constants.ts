// Mock data for the travel application (used as fallback when API fails)
export const CITIES = [
  { id: 1, city_name: "Mumbai", city_code: "MUM", state_name: "Maharashtra", country_name: "India", category_id: 1 },
  { id: 2, city_name: "Delhi", city_code: "DEL", state_name: "Delhi", country_name: "India", category_id: 1 },
  { id: 3, city_name: "Bangalore", city_code: "BLR", state_name: "Karnataka", country_name: "India", category_id: 1 },
  { id: 4, city_name: "Chennai", city_code: "CHN", state_name: "Tamil Nadu", country_name: "India", category_id: 2 },
  { id: 5, city_name: "Kolkata", city_code: "KOL", state_name: "West Bengal", country_name: "India", category_id: 2 },
  { id: 6, city_name: "Hyderabad", city_code: "HYD", state_name: "Telangana", country_name: "India", category_id: 1 },
  { id: 7, city_name: "Pune", city_code: "PUN", state_name: "Maharashtra", country_name: "India", category_id: 2 },
  { id: 8, city_name: "Ahmedabad", city_code: "AHM", state_name: "Gujarat", country_name: "India", category_id: 2 },
  { id: 9, city_name: "Jaipur", city_code: "JAI", state_name: "Rajasthan", country_name: "India", category_id: 3 },
  { id: 10, city_name: "Lucknow", city_code: "LKN", state_name: "Uttar Pradesh", country_name: "India", category_id: 3 },
];

export const GL_CODES = [
  { id: 1, gl_code: "5001", vertical_name: "Travel - Domestic" },
  { id: 2, gl_code: "5002", vertical_name: "Travel - International" },
  { id: 3, gl_code: "5003", vertical_name: "Accommodation" },
  { id: 4, gl_code: "5004", vertical_name: "Conveyance" },
];

export const TRAVEL_MODES = [
  { id: 1, name: "Flight" },
  { id: 2, name: "Train" },
];

export const TRAVEL_SUB_OPTIONS: Record<string, { id: number; name: string; mode: number }[]> = {
  "1": [
    { id: 1, name: "Economy Class", mode: 1 },
    { id: 2, name: "Business Class", mode: 1 },
  ],
  "2": [
    { id: 3, name: "AC First Class", mode: 2 },
    { id: 4, name: "AC 2 Tier", mode: 2 },
    { id: 5, name: "AC 3 Tier", mode: 2 },
    { id: 6, name: "Sleeper", mode: 2 },
  ],
};

export const ACCOMMODATION_TYPES = [
  { id: 1, name: "Company Arranged" },
  { id: 2, name: "Self Arranged" },
];

export const ACCOMMODATION_SUB_OPTIONS: Record<string, { id: number; name: string }[]> = {
  "1": [
    { id: 1, name: "Guest House" },
    { id: 2, name: "ARC Hotel" },
    { id: 3, name: "Standard Hotel" },
  ],
  "2": [
    { id: 4, name: "Self Arranged Accommodation" },
  ],
};

export const GUEST_HOUSES = [
  { id: 1, name: "Corporate Guest House - Mumbai", location: "Mumbai" },
  { id: 2, name: "Executive Lodge - Delhi", location: "Delhi" },
  { id: 3, name: "Company Quarters - Bangalore", location: "Bangalore" },
  { id: 4, name: "Transit House - Chennai", location: "Chennai" },
  { id: 5, name: "Staff Residence - Hyderabad", location: "Hyderabad" },
];

export const VEHICLE_TYPES = [
  { id: 1, name: "Company Vehicle" },
  { id: 2, name: "Own Car" },
  { id: 3, name: "Taxi" },
  { id: 4, name: "Car at Disposal" },
];

export const VEHICLE_SUB_OPTIONS: Record<string, { id: number; name: string }[]> = {
  "1": [
    { id: 1, name: "Sedan" },
    { id: 2, name: "SUV" },
  ],
  "2": [
    { id: 3, name: "Personal Vehicle" },
  ],
  "3": [
    { id: 4, name: "App-based Taxi" },
    { id: 5, name: "Local Taxi" },
  ],
  "4": [
    { id: 6, name: "Full Day Rental" },
    { id: 7, name: "Half Day Rental" },
  ],
};

export const LOCATION_TYPES = [
  "Residence",
  "Hotel",
  "Guest House",
  "Airport",
  "Railway Station",
  "Office",
];

// Empty form templates
export const getEmptyPurposeForm = () => ({
  purpose: "",
  internal_order: "",
  general_ledger: "",
  sanction_number: "",
  advance_amount: "",
  trip_from_location: "",
  trip_from_location_label: "",
  trip_to_location: "",
  trip_to_location_label: "",
  departure_date: "",
  start_time: "",
  return_date: "",
  end_time: "",
});

export const getEmptyTicketing = () => ({
  booking_type: "",
  sub_option: "",
  ticket_number: "",
  from_location: "",
  from_label: "",
  to_location: "",
  to_label: "",
  departure_date: "",
  departure_time: "",
  arrival_date: "",
  arrival_time: "",
  estimated_cost: "",
  meal_preference: "",
  special_instruction: "",
});

export const getEmptyAccommodation = () => ({
  accommodation_type: "",
  accommodation_type_label: "",
  accommodation_sub_option: "",
  accommodation_sub_option_label: "",
  guest_house_preferences: [] as number[],
  arc_hotel_preferences: [] as number[],
  place: "",
  place_label: "",
  check_in_date: "",
  check_in_time: "",
  check_out_date: "",
  check_out_time: "",
  estimated_cost: "",
  special_instruction: "",
});

export const getEmptyConveyance = () => ({
  vehicle_type: "",
  vehicle_type_label: "",
  vehicle_sub_option: "",
  vehicle_sub_option_label: "",
  from_location: "",
  to_location: "",
  report_at: "",
  drop_location: "",
  start_date: "",
  start_time: "",
  end_date: "",
  end_time: "",
  estimated_cost: "",
  special_instruction: "",
  club_booking: true,
  club_booking_reason: "",
  guests: [] as { id?: number; full_name: string; is_colleague: boolean }[],
  distance_km: "",
  passenger_count: "1",
  has_six_airbags: true,
});

// Validation Configuration
export const STRICT_ADVANCE_BOOKING = false;
