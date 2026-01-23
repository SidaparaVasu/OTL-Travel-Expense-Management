import { apiClient } from "./client";
import { GuestProfile } from "../types/travel.types";

export const guestProfileAPI = {
  list: async (search?: string): Promise<GuestProfile[]> => {
    const params = new URLSearchParams();
    if (search) params.append("search", search);

    const { data } = await apiClient.get<GuestProfile[]>(
      `/travel/guest-profiles/?${params.toString()}`,
    );
    console.log(data);
    return data.data.results;
  },

  create: async (payload: GuestProfile): Promise<GuestProfile> => {
    const { data } = await apiClient.post<any>(
      "/travel/guest-profiles/",
      payload,
    );
    return data.data;
  },

  update: async (id: number, payload: GuestProfile): Promise<GuestProfile> => {
    const { data } = await apiClient.put<any>(
      `/travel/guest-profiles/${id}/`,
      payload,
    );
    return data.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/travel/guest-profiles/${id}/`);
  },
};
