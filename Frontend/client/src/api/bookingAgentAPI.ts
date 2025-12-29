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
  assigned_agent_name: string | null;
  special_instruction?: string;
  travel_request_id?: string;
  employee_name?: string;
  employee_grade?: string;
  assigned_agent?: {
    name: string;
    scope: string;
    assigned_at: string;
  };
  created_at?: string;
  max_allowed_cost?: number;
  ceo_approval_status?: "pending" | "approved" | "rejected" | "not_required";
  travel_application_status?: string; // Added for hold status check
  trip_segment?: string;
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
}

export const bookingAgentAPI = {
  dashboard: {
    get: async (): Promise<{
      success: boolean;
      data: BookingAgentDashboardData;
    }> => {
      const response = await apiClient.get("/travel/dashboard/booking-agent/");
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

      const response = await apiClient.get(
        `/travel/booking-agent/bookings/?${queryParams.toString()}`,
      );
      return response.data;
    },

    get: async (
      bookingId: number,
    ): Promise<{ success: boolean; data: Booking }> => {
      const response = await apiClient.get(
        `/travel/booking-agent/bookings/${bookingId}/`,
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
        `/travel/booking-agent/bookings/${bookingId}/status/`,
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
        `/travel/booking-agent/bookings/${bookingId}/notes/`,
        data,
      );
      return response.data;
    },

    uploadFile: async (
      bookingId: number,
      formData: FormData,
    ): Promise<{ success: boolean; message: string }> => {
      const response = await apiClient.post(
        `/travel/booking-agent/bookings/${bookingId}/upload-file/`,
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
