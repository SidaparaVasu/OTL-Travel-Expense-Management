import { apiClient } from "./client";
import {
  TravelApplication,
  TravelApplicationRequest,
  TravelStats,
  Location,
  GLCode,
  TravelApplicationResponse,
} from "@/src/types/travel.types";

export const travelAPI = {
  // Statistics
  getStats: async (): Promise<TravelStats> => {
    const { data } = await apiClient.get("/travel/applications/stats/");
    return data.data;
  },

  // Applications
  getMyApplications: async (
    filter: string,
    page: number,
    search: string = "",
    startDate: string = "",
    endDate: string = "",
  ): Promise<TravelApplicationResponse> => {
    let url = `/travel/my-applications/?status=${filter}&page=${page}&search=${encodeURIComponent(search)}`;
    if (startDate) url += `&departure_after=${startDate}`;
    if (endDate) url += `&departure_before=${endDate}`;
    const { data } = await apiClient.get(url);
    return data;
  },

  getApplication: async (id: number): Promise<TravelApplication> => {
    const { data } = await apiClient.get(`/travel/applications/${id}/`);
    return data;
  },

  createApplication: async (
    request: TravelApplicationRequest,
  ): Promise<TravelApplication> => {
    const { data } = await apiClient.post("/travel/applications/", request);
    return data;
  },

  updateApplication: async (
    id: number,
    request: Partial<TravelApplicationRequest>,
  ): Promise<TravelApplication> => {
    const { data } = await apiClient.put(
      `/travel/applications/${id}/`,
      request,
    );
    return data;
  },

  deleteApplication: async (id: number): Promise<void> => {
    await apiClient.delete(`/travel/applications/${id}/`);
  },

  validateApplication: async (id: number) => {
    const { data } = await apiClient.post(
      `/travel/applications/${id}/validate/`,
    );
    return data;
  },

  // Real-time validation
  realTimeValidate: async (validationType: string, payload: any) => {
    const { data } = await apiClient.post("/travel/validate/", {
      type: validationType,
      ...payload,
    });
    return data;
  },

  submitApplication: async (id: number) => {
    const { data } = await apiClient.post(`/travel/applications/${id}/submit/`);
    return data;
  },

  // Get application for editing with eligibility check
  getApplicationForEdit: async (id: number) => {
    const { data } = await apiClient.get(`/travel/applications/${id}/edit/`);
    return data;
  },

  getCostEstimate: async (id: number) => {
    const { data } = await apiClient.get(
      `/travel/applications/${id}/cost-estimate/`,
    );
    return data;
  },

  checkEntitlement: async (subOptionId: number, cityCategoryId: number) => {
    const { data } = await apiClient.post(
      "/travel/bookings/check-entitlement/",
      {
        sub_option_id: subOptionId,
        city_category_id: cityCategoryId,
      },
    );
    return data;
  },

  getItineraries: async (id: number) => {
    const { data } = await apiClient.get(`/travel/itinerary/${id}/`);
    return data;
  },

  // Master data
  getLocations: async (): Promise<Location[]> => {
    const { data } = await apiClient.get("/master/locations/");
    return data.data;
  },

  // Travel Mode & Travel Sub-option Master
  getTravelModes: async () => {
    const { data } = await apiClient.get("/master/travel-modes/");
    return data.data;
  },

  getTravelSubOptions: async (modeId?: number) => {
    const { data } = await apiClient.get("/master/travel-sub-options/");
    return data.data;
  },

  createTravelModes: async (payload: any) => {
    const { data } = await apiClient.post("/master/travel-modes/", payload);
    return data;
  },

  updateTravelModes: async (id: number, payload: any) => {
    const { data } = await apiClient.put(
      `/master/travel-modes/${id}/`,
      payload,
    );
    return data;
  },

  deleteTravelModes: async (id: number) => {
    const { data } = await apiClient.delete(`/master/travel-modes/${id}/`);
    return data;
  },

  toggleTravelModeActive: async (id: number, isActive: boolean) => {
    const { data } = await apiClient.patch(`/master/travel-modes/${id}/`, {
      is_active: isActive,
    });
    return data;
  },

  createTravelSubOption: async (payload: any) => {
    const { data } = await apiClient.post(
      "/master/travel-sub-options/",
      payload,
    );
    return data;
  },

  updateTravelSubOption: async (id: number, payload: any) => {
    const { data } = await apiClient.put(
      `/master/travel-sub-options/${id}/`,
      payload,
    );
    return data;
  },

  deleteTravelSubOption: async (id: number) => {
    const { data } = await apiClient.delete(
      `/master/travel-sub-options/${id}/`,
    );
    return data;
  },

  toggleSubOptionActive: async (id: number, isActive: boolean) => {
    const { data } = await apiClient.patch(
      `/master/travel-sub-options/${id}/`,
      { is_active: isActive },
    );
    return data;
  },

  // Guest house endpoints
  getGuestHouses: async () => {
    const response = await apiClient.get("/master/guest-houses/");
    return response.data;
  },

  getARCHotels: async () => {
    const response = await apiClient.get("/master/arc-hotels/");
    return response.data;
  },

  // GL code endpoints
  getGLCodes: async (page = 1, pageSize = 10, search = ""): Promise<any> => {
    const params = new URLSearchParams();
    params.append("page", page.toString());
    params.append("page_size", pageSize.toString());
    if (search) {
      params.append("search", search);
    }
    const { data } = await apiClient.get(
      `/master/gl-codes/?${params.toString()}`,
    );
    return data;
  },

  createGLCodes: async (payload: any): Promise<GLCode[]> => {
    const { data } = await apiClient.post("/master/gl-codes/", payload);
    return data;
  },

  updateGLCodes: async (id: number, payload: any): Promise<GLCode[]> => {
    const { data } = await apiClient.put(`/master/gl-codes/${id}/`, payload);
    return data;
  },

  deleteGLCode: async (id: number): Promise<GLCode[]> => {
    const { data } = await apiClient.delete(`/master/gl-codes/${id}/`);
    return data;
  },

  bulkUploadGLCodes: async (formData: FormData, dryRun: boolean = true) => {
    // Append dry_run if not already present
    if (!formData.has("dry_run")) {
      formData.append("dry_run", String(dryRun));
    }

    const { data } = await apiClient.post(
      `/master/gl-code/bulk-upload/`,
      formData,
    );
    return data;
  },

  // Grade Entitlement
  getGradeEntitlement: async (): Promise<GLCode[]> => {
    const { data } = await apiClient.get("/master/grade-entitlements/");
    return data;
  },

  createGradeEntitlement: async (payload: any): Promise<GLCode[]> => {
    const { data } = await apiClient.post(
      "/master/grade-entitlements/",
      payload,
    );
    return data;
  },

  updateGradeEntitlement: async (
    id: number,
    payload: any,
  ): Promise<GLCode[]> => {
    const { data } = await apiClient.put(
      `/master/grade-entitlements/${id}/`,
      payload,
    );
    return data;
  },

  deleteGradeEntitlement: async (id: number): Promise<GLCode[]> => {
    const { data } = await apiClient.delete(
      `/master/grade-entitlements/${id}/`,
    );
    return data;
  },

  bulkCreateGradeEntitlements: async (payload: any) => {
    const { data } = await apiClient.post(
      "/master/grade-entitlements/bulk-create/",
      payload,
    );
    return data;
  },

  requestCancellation: async (id: number, reason: string) => {
    const { data } = await apiClient.post(
      `/travel/applications/${id}/cancel/`,
      {
        reason: reason,
      },
    );
    return data;
  },

  approveCancellation: async (
    id: number,
    action: "approve" | "reject",
    reason?: string,
  ) => {
    const { data } = await apiClient.post(
      `/travel/applications/${id}/cancel/approval/`,
      {
        action,
        reason,
      },
    );
    return data;
  },

  withdrawCancellation: async (id: number) => {
    const { data } = await apiClient.post(
      `/travel/applications/${id}/cancel/withdraw/`,
    );
    return data;
  },
};
