import { apiClient } from "./client";
import type {
  DashboardResponse,
  ApplicationsListResponse,
  ApplicationDetailResponse,
  AssignBookingPayload,
  ForwardApplicationPayload,
  AddNotePayload,
  ReassignBookingPayload,
  CancelApplicationPayload,
  BookingAgent,
  AgentAnalyticsSummary,
  AgentAnalyticsResponse,
} from "@/src/types/travel-desk.types";

export const travelDeskAPI = {
  dashboard: {
    get: async (): Promise<DashboardResponse> => {
      const { data } = await apiClient.get("/travel/dashboard/travel-desk/");
      return data;
    },
  },

  applications: {
    list: async (params?: {
      page?: number;
      search?: string;
      status?: string;
    }): Promise<ApplicationsListResponse> => {
      const queryParams = new URLSearchParams();

      if (params?.page) queryParams.append("page", params.page.toString());
      if (params?.search) queryParams.append("search", params.search);
      if (params?.status) queryParams.append("status", params.status);

      const { data } = await apiClient.get(
        `/travel/travel-desk/applications/${queryParams.toString() ? `?${queryParams}` : ""}`,
      );

      return data;
    },

    detail: async (
      applicationId: number,
      params?: { forwarded_only?: boolean },
    ): Promise<ApplicationDetailResponse> => {
      const queryParams = new URLSearchParams();
      if (params?.forwarded_only) queryParams.append("forwarded_only", "true");

      const { data } = await apiClient.get(
        `/travel/travel-desk/applications/${applicationId}/${queryParams.toString() ? `?${queryParams}` : ""}`,
      );
      return data;
    },

    bookings: async (applicationId: number) => {
      const { data } = await apiClient.get(
        `/travel/travel-desk/applications/${applicationId}/bookings/`,
      );
      return data;
    },

    cancel: async (
      applicationId: number,
      payload: CancelApplicationPayload,
    ) => {
      const { data } = await apiClient.post(
        `/travel/travel-desk/applications/${applicationId}/cancel/`,
        payload,
      );
      return data;
    },

    forward: async (
      applicationId: number,
      payload: ForwardApplicationPayload,
    ) => {
      const { data } = await apiClient.post(
        `/travel/travel-desk/applications/${applicationId}/forward/`,
        payload,
      );
      return data;
    },
  },

  bookings: {
    assign: async (payload: AssignBookingPayload) => {
      const { data } = await apiClient.post(
        `/travel/travel-desk/assign-bookings/`,
        payload,
      );
      return data;
    },

    addNote: async (bookingId: number, payload: AddNotePayload) => {
      const { data } = await apiClient.post(
        `/travel/travel-desk/bookings/${bookingId}/notes/`,
        payload,
      );
      return data;
    },

    reassign: async (bookingId: number, payload: ReassignBookingPayload) => {
      const { data } = await apiClient.post(
        `/travel/travel-desk/bookings/${bookingId}/reassign/`,
        payload,
      );
      return data;
    },

    cancel: async (bookingId: number, payload: { reason: string }) => {
      const { data } = await apiClient.post(
        `/travel/travel-desk/bookings/${bookingId}/cancel/`,
        payload,
      );
      return data;
    },

    forwardToDesk: async (
      bookingId: number,
      payload: { target_user_id: number; remarks?: string },
    ) => {
      const { data } = await apiClient.post(
        `/travel/travel-desk/bookings/${bookingId}/forward-to-desk/`,
        payload,
      );
      return data;
    },

    downloadDutySlip: async (bookingId: number) => {
      const response = await apiClient.get(
        `/travel/travel-desk/bookings/${bookingId}/duty-slip/`,
        { responseType: "blob" },
      );
      return response.data;
    },
  },

  users: {
    getTravelDeskUsers: async () => {
      const { data } = await apiClient.get(`/travel/travel-desk/users/`);
      return data;
    },
  },

  agents: {
    list: async (): Promise<{ data: BookingAgent[] }> => {
      const { data } = await apiClient.get(`/booking_agent/booking-agents/`);
      return data;
    },
    getRecommendedAgents: async (applicationId: number) => {
      const { data } = await apiClient.get(
        `/travel/travel-desk/applications/${applicationId}/recommended-agents/`,
      );
      console.log("Recommended Agents: ", data);
      return data;
    },
    getAgentVehicleTypes: async (
      agentId: number,
    ): Promise<{ data: { id: number; name: string }[] }> => {
      const { data } = await apiClient.get(
        `/travel/travel-desk/agents/${agentId}/vehicle-types/`,
      );
      return data;
    },
  },

  locations: {
    list: async () => {
      const { data } = await apiClient.get<{ id: number; name: string }[]>(
        "/travel/travel-desk/assigned-locations/",
      );
      return data;
    },
  },

  analytics: {
    agents: {
      list: async (search?: string, cityId?: number | null) => {
        const params = new URLSearchParams();
        if (search) params.append("search", search);
        if (cityId) params.append("city", cityId.toString());

        const { data } = await apiClient.get<{ data: AgentAnalyticsSummary[] }>(
          `/travel/travel-desk/analytics/agents/?${params.toString()}`,
        );
        return data.data;
      },
      detail: async (id: number) => {
        const { data } = await apiClient.get<{ data: AgentAnalyticsResponse }>(
          `/travel/travel-desk/analytics/agents/${id}/`,
        );
        return data.data;
      },
      getAgentCities: async () => {
        const { data } = await apiClient.get<{
          data: { id: number; city_name: string }[];
        }>(`/travel/travel-desk/analytics/agents/cities/`);
        return data.data;
      },
    },
  },
};
