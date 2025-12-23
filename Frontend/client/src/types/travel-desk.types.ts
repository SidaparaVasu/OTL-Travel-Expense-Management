// Travel Desk Agent Types

export interface BookingDetails {
  to_location?: string;
  from_location?: string;
  to_location_name?: string;
  from_location_name?: string;
  departure_date?: string;
  departure_time?: string;
  arrival_date?: string;
  arrival_time?: string;
  ticket_number?: string;
  check_in_date?: string;
  check_in_time?: string;
  check_out_date?: string;
  check_out_time?: string;
  place?: string;
  guest_house_preferences?: number[];
  guests?: Array<{
    id: number | null;
    name: string;
    employee_id: number | null;
    is_external: boolean;
    is_internal: boolean;
  }>;
  report_at?: string;
  start_date?: string;
  start_time?: string;
  end_date?: string;
  end_time?: string;
  distance_km?: string;
  club_booking?: boolean;
  club_reason?: string;
  not_required?: boolean;
  drop_location?: string;
  has_six_airbags?: boolean;
  accommodation_type?: 'company' | 'self';
}

export interface Booking {
  id: number;
  booking_type: number;
  booking_type_name: string;
  sub_option: number;
  sub_option_name: string;
  booking_details: BookingDetails;
  status: string;
  estimated_cost: string | null;
  actual_cost: string | null;
  booking_reference: string;
  vendor_reference: string;
  booking_file: string | null;
  special_instruction: string;
  can_reassign: boolean;
  trip_segment?: string;
}

export interface TripDetail {
  id: number;
  from_location: number;
  from_location_name: string;
  to_location: number;
  to_location_name: string;
  departure_date: string;
  start_time: string;
  return_date: string;
  end_time: string;
  trip_purpose: string;
  guest_count: number;
  estimated_distance_km: number | null;
  duration_days: number;
  city_category: string;
  bookings: Booking[];
  travel_advance: any | null;
}

export interface Application {
  id: number;
  employee: number;
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
  is_settled: boolean;
  settlement_due_date: string | null;
  travel_request_id: string;
  total_duration_days: number;
  created_at: string;
  updated_at: string;
  submitted_at: string;
  trip_details: TripDetail[];
}

export interface DashboardApplication {
  id: number;
  employee: number;
  employee_name: string;
  from_location: string;
  to_location: string;
  departure_date: string;
  return_date: string;
  purpose: string;
  estimated_total_cost: string;
  status: string;
  status_label: string;
  submitted_at: string;
  total_bookings: number;
  pending_bookings: number;
  booked_bookings: number;
}

export interface DashboardStats {
  pending_travel_desk: number;
  booking_in_progress: number;
  booked: number;
  completed: number;
  overdue_pending: number;
  avg_td_response_hours: number | null;
  avg_booking_completion_hours: number | null;
}

export interface DashboardResponse {
  success: boolean;
  message: string;
  data: {
    stats: DashboardStats;
    recent_applications: DashboardApplication[];
  };
  errors: any | null;
}

export interface ApplicationDetailResponse {
  success: boolean;
  message: string;
  data: Application;
  errors: any | null;
}

export interface BookingAgent {
  id: number;
  name: string;
  email?: string;
  contact?: string;
}

export interface Pagination {
  current_page: number;
  total_pages: number;
  next: string | null;
  previous: string | null;
  count: number;
  page_size: number;
}

export interface ApplicationsListResponse {
  success: boolean;
  message: string;
  data: DashboardApplication[];
  meta?: {
    pagination: Pagination;
  };
  errors: any | null;
}

export interface AssignBookingPayload {
  booking_ids: number[];
  scope: 'single_booking' | 'full_application';
  booking_agent_id: number;
  note: string;
}

export interface ForwardApplicationPayload {
  agent_id: number;
}

export interface AddNotePayload {
  note: string;
}

export interface ReassignBookingPayload {
  new_agent_id: number;
}

export interface CancelApplicationPayload {
  reason: string;
}

export type BookingStatus = 'pending' | 'assigned' | 'booked' | 'completed' | 'cancelled';
export type ApplicationStatus = 'pending_travel_desk' | 'booking_in_progress' | 'booked' | 'completed' | 'cancelled';

export interface RecommendedAgent {
  id: number;
  name: string;
  organization: string;
}

export interface AccommodationRecommendation {
  city: {
    id: number;
    name: string;
  };
  agents: RecommendedAgent[];
  booking_ids: number[];
}

export interface RecommendedAgentsResponse {
  flight_train?: {
    agent: RecommendedAgent;
    booking_ids: number[];
  } | null;

  accommodation: AccommodationRecommendation[];
}

export interface AgentAnalyticsSummary {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  organization_name: string;
  contact_person: string;
  phone: string;
  active_bookings: number;
  completed_bookings: number;
  avg_response_time: number;
}

export interface AgentRecentBooking {
  id: number;
  trip_id: string;
  employee_name: string;
  booking_type: string;
  sub_option: string;
  status: string;
  created_at: string;
  booked_at: string;
  travel_date: string;
  from_loc: string;
  to_loc: string;
}

export interface AgentAnalyticsDetail extends AgentAnalyticsSummary {
  address: string;
  profile_type: string;
  today_assignments: number;
  pending_requests: number;
}

export interface AgentAnalyticsResponse {
  agent: AgentAnalyticsDetail;
  recent_bookings: AgentRecentBooking[];
}
