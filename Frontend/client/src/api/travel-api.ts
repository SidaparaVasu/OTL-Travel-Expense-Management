import { apiClient } from "./client";
import { API_BASE_URL } from "../../config/api.config";

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
  bulk_upload_file?: string | null; // For removing file (sending null)
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

export interface MealPreference {
  id: number;
  code: string;
  name: string;
  allowed_modes: number[];
  is_active?: boolean;
}

export interface BulkFilePreviewData {
  source: "booking" | "application";
  booking_id?: number;
  application_id?: number;
  file_name: string;
  file_url?: string;
  columns: string[];
  rows: Record<string, string | number | boolean | null>[];
  total_rows: number;
  truncated: boolean;
  max_preview_rows: number;
}

export interface EligibleApprover {
  id: number;
  name: string;
  email: string;
  grade: string | null;
  employee_id: string | null;
  is_temp_authorized: boolean;
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

  // ARC Hotels Dropdown
  getARCHotelsDropdown: async (cityIds?: number[]): Promise<ARCHotel[]> => {
    try {
      let url = "/master/arc-hotels/dropdown/";
      if (cityIds && cityIds.length > 0) {
        url += `?city_ids=${cityIds.join(",")}`;
      }
      const response = await apiClient.get(url);
      // console.log('ARC Hotels: ', response);
      return response.data.data || response.data || [];
    } catch (error) {
      console.error("Failed to fetch ARC hotels:", error);
      return [];
    }
  },

  // Meal Preferences
  getMealPreferences: async (): Promise<MealPreference[]> => {
    try {
      const response = await apiClient.get("/master/meal-preferences/");
      return response.data.data || response.data || [];
    } catch (error) {
      console.error("Failed to fetch meal preferences:", error);
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

  // Get Travel Application Details (comprehensive view)
  getTravelApplicationDetails: async (id: number) => {
    const { data } = await apiClient.get(`/travel/applications/${id}/details/`);
    return data.data;
  },
  // Upload Bulk File (LEGACY — application-level)
  uploadBulkFile: async (id: number, file: File) => {
    const formData = new FormData();
    formData.append("bulk_upload_file", file);
    const { data } = await apiClient.post(
      `/travel/applications/${id}/upload-bulk-file/`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      },
    );
    return data;
  },

  // Upload bulk guest data file to a specific booking line item
  uploadBookingBulkFile: async (bookingId: number, file: File) => {
    const formData = new FormData();
    formData.append("bulk_booking_file", file);
    const { data } = await apiClient.post(
      `/travel/bookings/${bookingId}/upload-bulk-file/`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return data;
  },

  // Remove bulk guest data file from a specific booking line item
  removeBookingBulkFile: async (bookingId: number) => {
    const { data } = await apiClient.delete(
      `/travel/bookings/${bookingId}/upload-bulk-file/`,
    );
    return data;
  },

  getBookingBulkFilePreview: async (
    bookingId: number,
  ): Promise<BulkFilePreviewData> => {
    const { data } = await apiClient.get(
      `/travel/bookings/${bookingId}/bulk-file/preview/`,
    );
    return data.data;
  },

  getApplicationBulkFilePreview: async (
    applicationId: number,
  ): Promise<BulkFilePreviewData> => {
    const { data } = await apiClient.get(
      `/travel/applications/${applicationId}/bulk-file/preview/`,
    );
    return data.data;
  },

  downloadBulkSample: (
    category: "ticketing" | "accommodation" | "conveyance",
  ) => {
    window.open(
      `${API_BASE_URL}/travel/bulk-booking/sample/${category}/`,
      "_blank",
      "noopener,noreferrer",
    );
  },

  // Download Travel Application Report
  downloadTravelApplicationReport: async (id: number) => {
    const response = await apiClient.get(`/travel/applications/${id}/report/`, {
      responseType: "blob",
    });
    return response.data;
  },

  // Get eligible approvers for TR approver selection
  getEligibleApprovers: async (): Promise<EligibleApprover[]> => {
    try {
      const { data } = await apiClient.get("/travel/eligible-approvers/");
      return data.data || [];
    } catch (error) {
      console.error("Failed to fetch eligible approvers:", error);
      return [];
    }
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
