import { apiClient } from "./client";

export interface BackdatedAllowance {
  id: number;
  user: number;
  user_name: string;
  allowed_from: string;
  allowed_until: string;
  granted_by: number;
  granted_by_name: string;
  reason: string;
  is_active: boolean;
  is_valid: boolean;
  created_at: string;
}

export interface CreateAllowance {
  user: number;
  allowed_from: string;
  allowed_until: string;
  reason: string;
}

export const backdatedAllowanceApi = {
  list: async () => {
    const response = await apiClient.get("/travel/admin/backdated-allowance/");
    // With pagination_class = None, data is the array directly inside the standard response wrapper
    if (response.data.success && response.data.data) {
      return response.data.data as BackdatedAllowance[];
    }
    return [];
  },
  
  create: async (data: CreateAllowance) => {
    const response = await apiClient.post("/travel/admin/backdated-allowance/", data);
    return response.data;
  },
  
  update: async (id: number, data: Partial<BackdatedAllowance>) => {
    const response = await apiClient.patch(`/travel/admin/backdated-allowance/${id}/`, data);
    return response.data;
  },
  
  delete: async (id: number) => {
    const response = await apiClient.delete(`/travel/admin/backdated-allowance/${id}/`);
    return response.data;
  },
  
  searchUsers: async (query: string) => {
    const response = await apiClient.get(`/employees/search/?q=${query}&ignore_branch=true`);
    return response.data.data;
  }
};
