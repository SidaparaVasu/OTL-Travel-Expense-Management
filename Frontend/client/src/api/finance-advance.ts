import { apiClient as client } from "./client";

export const financeAdvanceAPI = {
  // List all advance requests
  getAdvanceRequests: async (params?: any) => {
    try {
      const response = await client.get("/travel/finance/advances/", { params });
      return response.data.data.results;
    } catch (error) {
      console.error("Failed to fetch advance requests:", error);
      throw error;
    }
  },

  // Get detail of a specific advance request
  getAdvanceRequest: async (id: string | number) => {
    try {
      const response = await client.get(`/travel/finance/advances/${id}/`);
      console.log(response.data);
      return response.data.data;
    } catch (error) {
      console.error("Failed to fetch advance request detail:", error);
      throw error;
    }
  },

  // Process an advance request
  processAdvance: async (id: string | number, data: any) => {
    try {
      const response = await client.post(
        `/travel/finance/advances/${id}/process/`,
        data,
      );
      console.log(response.data);
      return response.data;
    } catch (error) {
      console.error("Failed to process advance request:", error);
      throw error;
    }
  },
};
