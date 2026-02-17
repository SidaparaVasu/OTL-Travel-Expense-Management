import { apiClient } from "./client";

export const roleManagementAPI = {
  // ---- Role APIs ----
  role: {
    get: async (id: number) => {
      const { data } = await apiClient.get(`/roles/${id}/`);
      return data;
    },
    getAll: async () => {
      const { data } = await apiClient.get("/roles/");
      return data;
    },
    getSpocRoles: async () => {
      const { data } = await apiClient.get("/roles/", {
        params: { spoc_roles: "true" },
      });
      return data;
    },
    create: async (payload: any) => {
      const { data } = await apiClient.post("/roles/", payload);
      return data;
    },
    update: async (id: number, payload: any) => {
      const { data } = await apiClient.put(`/roles/${id}/`, payload);
      return data;
    },
    delete: async (id: number) => {
      const { data } = await apiClient.delete(`/roles/${id}/`);
      return data;
    },
  },

  // ---- Permission APIs ----
  permission: {
    get: async (id: number) => {
      const { data } = await apiClient.get(`/permissions/${id}/`);
      return data;
    },
    getAll: async () => {
      const { data } = await apiClient.get("/permissions/");
      return data;
    },
    create: async (payload: any) => {
      const { data } = await apiClient.post("/permissions/", payload);
      return data;
    },
    update: async (id: number, payload: any) => {
      const { data } = await apiClient.put(`/permissions/${id}/`, payload);
      return data;
    },
    delete: async (id: number) => {
      const { data } = await apiClient.delete(`/permissions/${id}/`);
      return data;
    },
  },

  // ---- User Role Assignment ----
  userRole: {
    assign: async (payload: any) => {
      const { data } = await apiClient.post("/user-roles/assign/", payload);
      return data;
    },
  },
};
