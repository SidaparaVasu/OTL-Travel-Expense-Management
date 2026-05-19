import { apiClient } from "./client";

export interface BookingAgentDashboardStats {
  total_assigned: number;
  pending: number;
  in_progress: number;
  confirmed: number;
  cancelled: number;
  overdue_pending: number;
  avg_response_hours: number | null;
  avg_confirmation_hours: number | null;
  avg_completion_hours: number | null;
}

export interface BookingAgentDashboardData {
  stats: BookingAgentDashboardStats;
  recent: Booking[];
}

export interface Traveler {
  id: number;
  user?: number | null;
  user_name?: string | null;
  guest?: number | null;
  guest_name?: string | null;
  is_primary: boolean;
  employee_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  full_name: string;
  email?: string | null;
  contact_number?: string | null;
  gender: string;
  age: number | null;
  nationality_type: string;
  flight_meal_preference?: number | null;
  accommodation_meal_preference?: number | null;
  flight_meal_preference_name?: string | null;
  accommodation_meal_preference_name?: string | null;
}

export interface Booking {
  id: number;
  booking_type: number;
  booking_type_name?: string;
  sub_option: number;
  sub_option_name?: string;
  estimated_cost: string;
  actual_cost: string | null;
  vendor_reference: string;
  booking_reference: string;
  status: string;
  booking_details: BookingDetails;
  booking_file: string | null;
  bulk_booking_file?: string | null;
  assigned_agent_name: string | null;
  special_instruction?: string;
  travel_request_id?: string;
  purpose?: string;
  employee_name?: string;
  employee_email?: string;
  employee_mobile?: string;
  employee_gender?: string;
  employee_grade?: string;
  assigned_agent?: {
    id: number;
    name: string;
    assigned_at: string;
    scope: "single_booking" | "full_application";
  };
  notes?: {
    id: number;
    note: string;
    author_name: string;
    created_at: string;
  }[];
  requested_vehicle_type?: {
    id: number;
    name: string;
  };
  created_at?: string;
  max_allowed_cost?: number;
  grade_entitled_amount?: number | null;
  ceo_approval_status?: "pending" | "approved" | "rejected" | "not_required";
  travel_application_status?: string; // Added for hold status check
  trip_segment?: string;
  travelers?: Traveler[];
}

export interface BookingDetails {
  // Flight/Train
  from_location?: number;
  from_location_name?: string;
  to_location?: number;
  to_location_name?: string;
  departure_date?: string;
  departure_time?: string;
  arrival_date?: string;
  arrival_time?: string;
  ticket_number?: string;
  meal_preference?: string;

  // Accommodation
  place?: string;
  check_in_date?: string;
  check_in_time?: string;
  check_out_date?: string;
  check_out_time?: string;
  guest_house_preferences?: number[];
  arc_hotel_preferences?: any[];

  // Conveyance
  start_date?: string;
  start_time?: string;
  report_at?: string;
  drop_location?: string;
  club_booking?: boolean;
  club_reason?: string;
  not_required?: boolean;
  has_six_airbags?: boolean;
  distance_km?: number;
  guests?: Array<{
    id: number | null;
    name: string;
    employee_id: string | null;
    is_internal: boolean;
    is_external: boolean;
  }>;
}

export interface Pagination {
  count: number;
  current_page: number;
  total_pages: number;
  page_size: number;
  next: string | null;
  previous: string | null;
}

export interface BookingsListResponse {
  success: boolean;
  message: string;
  data: Booking[];
  meta?: {
    pagination?: Pagination;
  };
  errors: null | Record<string, string[]>;
}

export interface BookingsListParams {
  page?: number;
  status?: "pending" | "in_progress" | "confirmed" | "cancelled" | "";
  search?: string;
  date_from?: string; // YYYY-MM-DD
  date_to?: string;   // YYYY-MM-DD
}

export const bookingAgentAPI = {
  dashboard: {
    get: async (): Promise<{
      success: boolean;
      data: BookingAgentDashboardData;
    }> => {
      const response = await apiClient.get(
        "/booking_agent/dashboard/booking-agent/",
      );
      return response.data;
    },
  },

  bookings: {
    list: async (
      params: BookingsListParams = {},
    ): Promise<BookingsListResponse> => {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append("page", params.page.toString());
      if (params.status) queryParams.append("status", params.status);
      if (params.search) queryParams.append("search", params.search);
      if (params.date_from) queryParams.append("date_from", params.date_from);
      if (params.date_to) queryParams.append("date_to", params.date_to);

      const response = await apiClient.get(
        `/booking_agent/booking-agent/bookings/?${queryParams.toString()}`,
      );
      return response.data;
    },

    get: async (
      bookingId: number,
    ): Promise<{ success: boolean; data: Booking }> => {
      const response = await apiClient.get(
        `/booking_agent/booking-agent/bookings/${bookingId}/`,
      );
      return response.data;
    },

    accept: async (
      bookingId: number,
    ): Promise<{ success: boolean; message: string; data: any }> => {
      const response = await apiClient.post(
        `/booking_agent/booking-agent/bookings/${bookingId}/accept/`,
      );
      return response.data;
    },

    reject: async (
      bookingId: number,
      remarks: string,
    ): Promise<{ success: boolean; message: string; data: any }> => {
      const response = await apiClient.post(
        `/booking_agent/booking-agent/bookings/${bookingId}/reject/`,
        { remarks },
      );
      return response.data;
    },

    updateStatus: async (
      bookingId: number,
      formData: FormData,
    ): Promise<{
      success: boolean;
      message: string;
      data?: {
        booking_id?: number;
        status?: string;
        application_status?: string;
      };
    }> => {
      const response = await apiClient.post(
        `/booking_agent/booking-agent/bookings/${bookingId}/status/`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );
      return response.data;
    },

    addNote: async (
      bookingId: number,
      data: { note: string },
    ): Promise<{ success: boolean; message: string }> => {
      const response = await apiClient.post(
        `/booking_agent/booking-agent/bookings/${bookingId}/notes/`,
        data,
      );
      return response.data;
    },

    uploadFile: async (
      bookingId: number,
      formData: FormData,
    ): Promise<{ success: boolean; message: string }> => {
      const response = await apiClient.post(
        `/booking_agent/booking-agent/bookings/${bookingId}/upload-file/`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );
      return response.data;
    },
  },
};
