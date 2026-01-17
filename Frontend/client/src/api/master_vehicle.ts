import { apiClient } from './client';

export const vehicleMasterAPI = {
  // ---- Vehicle Category APIs ----
  category: {
    get: async (id: number) => {
      const { data } = await apiClient.get(`/master/vehicle-categories/${id}/`);
      return data;
    },
    getAll: async (params?: any) => {
      const { data } = await apiClient.get('/master/vehicle-categories/', { params });
      return data.data;
    },
    create: async (payload: any) => {
      const { data } = await apiClient.post('/master/vehicle-categories/', payload);
      return data;
    },
    update: async (id: number, payload: any) => {
      const { data } = await apiClient.put(`/master/vehicle-categories/${id}/`, payload);
      return data;
    },
    delete: async (id: number) => {
      const { data } = await apiClient.delete(`/master/vehicle-categories/${id}/`);
      return data;
    },
    getDropdown: async () => {
      const { data } = await apiClient.get('/master/vehicle-categories/dropdown/');
      return data.data;
    },
  },

  // ---- Vehicle Type APIs ----
  type: {
    get: async (id: number) => {
      const { data } = await apiClient.get(`/master/vehicle-types/${id}/`);
      return data;
    },
    getAll: async (params?: any) => {
      const { data } = await apiClient.get('/master/vehicle-types/', { params });
      return data.data;
    },
    create: async (payload: any) => {
      const { data } = await apiClient.post('/master/vehicle-types/', payload);
      return data;
    },
    update: async (id: number, payload: any) => {
      const { data } = await apiClient.put(`/master/vehicle-types/${id}/`, payload);
      return data;
    },
    delete: async (id: number) => {
      const { data } = await apiClient.delete(`/master/vehicle-types/${id}/`);
      return data;
    },
    getDropdown: async () => {
      const { data } = await apiClient.get('/master/vehicle-types/dropdown/');
      return data.data;
    },
  },
};
