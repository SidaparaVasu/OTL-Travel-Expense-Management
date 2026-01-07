import axios from "axios";
import {
  API_BASE_URL,
  EXTERNAL_API_URL,
  LOCAL_BACKUP_URL,
} from "../../config/api.config";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  // headers: { 'Content-Type': 'application/json' },
  headers: {},
});

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    // If the payload is FormData, let axios set correct headers
    if (config.data instanceof FormData) {
      delete config.headers["Content-Type"];
    }
    return config;
  },
  (error) => Promise.reject(error),
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Failover Logic: If External API fails, try Backup (Local) API
    if (
      !originalRequest._retry &&
      originalRequest.baseURL === EXTERNAL_API_URL &&
      (error.code === "ERR_NETWORK" || error.response?.status >= 500)
    ) {
      console.warn("⚠️ Primary API failed. Switching to Backup API...");
      originalRequest._retry = true;
      originalRequest.baseURL = LOCAL_BACKUP_URL; // Switch to Backup
      // Update the main instance defaults as well for future requests
      apiClient.defaults.baseURL = LOCAL_BACKUP_URL;
      return apiClient(originalRequest);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem("refresh_token");
        const { data } = await axios.post(
          `${apiClient.defaults.baseURL}/token/refresh/`,
          {
            refresh: refreshToken,
          },
        );

        localStorage.setItem("access_token", data.data.access);
        originalRequest.headers.Authorization = `Bearer ${data.data.access}`;
        return apiClient(originalRequest);
      } catch {
        localStorage.clear();
        window.location.href = "/login";
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  },
);
