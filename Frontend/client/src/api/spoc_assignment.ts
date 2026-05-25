import { apiClient } from "./client";

export const spocAssignmentAPI = {
  // Get all SPOC Assignments with optional filters
  getAll: async (params?: {
    user_id?: string;
    role_id?: string;
    location_id?: string;
    role_name?: string;
    is_active?: boolean;
    search?: string;
    page?: number;
    page_size?: number;
  }) => {
    const { data } = await apiClient.get("/spoc-assignments/", { params });
    return data.data ?? data;
  },

  // Get single SPOC Assignment by ID
  get: async (id: number) => {
    const { data } = await apiClient.get(`/spoc-assignments/${id}/`);
    console.log("get: ", data);
    return data;
  },

  // Create new SPOC Assignment
  create: async (payload: {
    user_id: number;
    role_id: number;
    is_global: boolean;
    location_ids: number[];
    is_active: boolean;
  }) => {
    const { data } = await apiClient.post("/spoc-assignments/", payload);
    return data;
  },

  // Update existing SPOC Assignment
  update: async (
    id: number,
    payload: {
      user_id?: number;
      role_id?: number;
      is_global?: boolean;
      location_ids?: number[];
      is_active?: boolean;
    },
  ) => {
    const { data } = await apiClient.patch(`/spoc-assignments/${id}/`, payload);
    return data;
  },

  // Soft delete (deactivate) or activate SPOC Assignment
  // We can use update for this, but explicit method is nice
  toggleActive: async (id: number, isActive: boolean) => {
    const { data } = await apiClient.patch(`/spoc-assignments/${id}/`, {
      is_active: isActive,
    });
    return data;
  },

  // Delete SPOC Assignment permanently
  delete: async (id: number) => {
    const { data } = await apiClient.delete(`/spoc-assignments/${id}/`);
    return data;
  },

  // Resolve SPOC (Utility)
  resolveSpoc: async (locationId: number, roleName: string) => {
    const { data } = await apiClient.get("/spoc-assignments/resolve-spoc/", {
      params: {
        location_id: locationId,
        role_name: roleName,
      },
    });
    console.log("resolveSpoc: ", data);
    return data;
  },
};
