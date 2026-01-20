import { apiClient } from "./client";

export interface TravelApplication {
  id: number;
  status: string;
  purpose: string;
  created_at: string;
}

export interface TravelApplicationRequest {
  purpose: any;
  ticketing: any[];
  accommodation: any[];
  conveyance: any[];
  ticketingNotRequired?: boolean;
  accommodationNotRequired?: boolean;
  conveyanceNotRequired?: boolean;
  is_draft?: boolean;
}

export interface GLCode {
  id: number;
  gl_code: string;
  vertical_name: string;
  short_description?: string;
  description?: string;
}

export interface City {
  id: number;
  city_name: string;
  city_code: string;
  state_name?: string;
  country_name?: string;
  category?: number;
}

export interface TravelMode {
  id: number;
  name: string;
  is_active?: boolean;
}

export interface TravelSubOption {
  id: number;
  name: string;
  mode: number;
  is_active?: boolean;
}

export interface GuestHouse {
  id: number;
  name: string;
  location: string;
}

export interface ARCHotel {
  id: number;
  name: string;
  location: string;
  category?: string;
}

export const travelAPI = {
  // GL Codes
  getGLCodes: async (): Promise<GLCode[]> => {
    try {
      const { data } = await apiClient.get("/master/gl-codes/");
      // console.log('GL Codes: ', data);
      return data.data.results || data;
    } catch (error) {
      console.error("Failed to fetch GL codes:", error);
      return { results: [], count: 0 };
    }
  },

  // Active GL Codes (Non-paginated for Dropdowns)
  getActiveGLCodes: async (): Promise<GLCode[]> => {
    try {
      const { data } = await apiClient.get("/master/active-gl-codes/");
      return data.data || data || [];
    } catch (error) {
      console.error("Failed to fetch active GL codes:", error);
      return [];
    }
  },

  // Travel Modes & Sub-options
  getTravelModes: async (): Promise<{
    modes: TravelMode[];
    subOptions: Record<string, TravelSubOption[]>;
  }> => {
    try {
      const { data } = await apiClient.get("/master/travel-modes-active/");
      const modes = data.data || data || [];
      // console.log('Travel Modes: ', modes);
      // Get sub-options
      const subOptionsRes = await apiClient.get(
        "/master/travel-sub-options-active/",
      );
      const subOptions = subOptionsRes.data.data || subOptionsRes.data || [];
      // console.log('Travel Sub Modes: ', subOptionsRes);
      // Group sub-options by mode
      const groupedSubOptions: Record<string, TravelSubOption[]> = {};
      subOptions.forEach((sub: TravelSubOption) => {
        const modeId = String(sub.mode);
        if (!groupedSubOptions[modeId]) {
          groupedSubOptions[modeId] = [];
        }
        groupedSubOptions[modeId].push(sub);
      });

      // console.log('groupedSubOptions: ', groupedSubOptions);
      return { modes, subOptions: groupedSubOptions };
    } catch (error) {
      console.error("Failed to fetch travel modes:", error);
      return { modes: [], subOptions: {} };
    }
  },

  // Allowed modes based on grade entitlements
  getAllowedTravelModes: async (): Promise<{
    modes: TravelMode[];
    subOptions: Record<string, TravelSubOption[]>;
  }> => {
    try {
      const { data } = await apiClient.get("/master/allowed-travel-modes/");

      const modes = data.data || [];

      // Normalize into the SAME shape expected by UI
      const groupedSubOptions: Record<string, TravelSubOption[]> = {};

      modes.forEach((mode: any) => {
        groupedSubOptions[String(mode.id)] = mode.sub_options || [];
      });

      return {
        modes,
        subOptions: groupedSubOptions,
      };
    } catch (error) {
      console.error("Failed to fetch allowed travel modes:", error);
      return { modes: [], subOptions: {} };
    }
  },

  // Guest Houses
  getGuestHouses: async (): Promise<GuestHouse[]> => {
    try {
      const response = await apiClient.get("/master/guest-houses/");
      // console.log('Guest Houses: ', response);
      return response.data.data.results || response.data || [];
    } catch (error) {
      console.error("Failed to fetch guest houses:", error);
      return [];
    }
  },

  // ARC Hotels
  getARCHotels: async (): Promise<ARCHotel[]> => {
    try {
      const response = await apiClient.get("/master/arc-hotels/");
      // console.log('ARC Hotels: ', response);
      return response.data.data || response.data || [];
    } catch (error) {
      console.error("Failed to fetch ARC hotels:", error);
      return [];
    }
  },

  // Create Application (Save as Draft)
  createApplication: async (
    request: TravelApplicationRequest,
  ): Promise<TravelApplication> => {
    const { data } = await apiClient.post("/travel/applications/", request);
    return data;
  },

  // Update Application
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

  // Submit Application
  submitApplication: async (id: number) => {
    const { data } = await apiClient.post(`/travel/applications/${id}/submit/`);
    return data;
  },

  // Get Application
  getApplication: async (id: number): Promise<TravelApplication> => {
    const { data } = await apiClient.get(`/travel/applications/${id}/`);
    return data;
  },

  // Get Application for editing with eligibility check
  getApplicationForEdit: async (id: number) => {
    const { data } = await apiClient.get(`/travel/applications/${id}/edit/`);
    return data;
  },
};

export const locationAPI = {
  // Get All Cities
  // getAllCities: async (): Promise<City[]> => {
  //   try {
  //     const response = await apiClient.get('/master/cities/');
  //     console.log('All cities: ', response);
  //     return response.data.data || response.data || [];
  //   } catch (error) {
  //     console.error('Failed to fetch cities:', error);
  //     return [];
  //   }
  // },
  getAllCities: async () => {
    const response = await apiClient.get("/master/cities/");
    // console.log('All cities: ', response);
    return response.data.data;
  },
};
