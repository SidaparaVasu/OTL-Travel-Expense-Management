import { apiClient } from "./client";

export interface User {
  id: number;
  employee_id: string;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  gender: string;
  department?: number;
  department_name?: string;
  designation?: number;
  designation_name?: string;
  employee_type?: number;
  employee_type_name?: string;
  company?: number;
  company_name?: string;
  grade?: number;
  grade_name?: string;
  base_location?: number;
  base_location_name?: string;
  reporting_manager?: number;
  reporting_manager_name?: string;
  is_active: boolean;
  date_joined?: string;
  last_login?: string;
}

export interface UserCreatePayload {
  employee_id: string;
  username: string;
  password: string;
  confirm_password: string;
  first_name: string;
  last_name: string;
  email: string;
  gender: string;
  department?: number;
  designation?: number;
  employee_type?: number;
  company?: number;
  grade?: number;
  base_location?: number;
  reporting_manager?: number;
  is_active: boolean;
}

export const userAPI = {
  // getAll: async (query = '') => {
  //     const { data } = await apiClient.get(`/users/${query}`);
  //     return data;
  // },

  getAll: async (params?: {
    search?: string;
    page?: number;
    page_size?: number;
    department?: number;
    designation?: number;
    company?: number;
    base_location?: number;
    is_active?: boolean;
    user_type?: string;
  }) => {
    const { data } = await apiClient.get("/users/", { params });
    console.log(data);
    return data;
  },

  get: async (id: number) => {
    const { data } = await apiClient.get(`/users/${id}/`);
    return data;
  },

  create: async (payload) => {
    const { data } = await apiClient.post("/users/", payload);
    return data;
  },

  update: async (id: number, payload) => {
    const { data } = await apiClient.put(`/users/${id}/`, payload);
    return data;
  },

  delete: async (id: number) => {
    const { data } = await apiClient.delete(`/users/${id}/`);
    return data;
  },

  export: async () => {
    const { data } = await apiClient.get(`/users/export/`);
    return data;
  },

  // Search colleagues for guest selection
  searchColleagues: async (query: string) => {
    const { data } = await apiClient.get(
      `/employees/search/?q=${encodeURIComponent(query)}`,
    );
    console.log(data);
    return data.data || [];
  },
};
