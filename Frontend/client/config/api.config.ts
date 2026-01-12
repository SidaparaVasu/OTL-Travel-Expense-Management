/**
 * Dynamic API Configuration
 * Automatically detects the correct backend API URL based on the current hostname
 */

/**
 * Get the API base URL based on current hostname
 * @returns The API base URL for the current environment
 */
// Define API URLs
export const EXTERNAL_API_URL = "https://hrms.orangetechnolab.com:8596/api";
export const LOCAL_BACKUP_URL = "http://192.168.1.90:8000/api";

/**
 * Get the API base URL based on current hostname
 * @returns The API base URL for the current environment
 */
export const getApiBaseUrl = (): string => {
  // Special Case: 192.168.1.90 Priority Logic
  if (
    typeof window !== "undefined" &&
    window.location.hostname === "192.168.1.90"
  ) {
    return EXTERNAL_API_URL;
  }

  // Force relative path for 'hrms.orangetechnolab.com' (even if in Dev mode)
  // This prevents Mixed Content Error (HTTPS -> HTTP)
  if (
    typeof window !== "undefined" &&
    window.location.hostname === "hrms.orangetechnolab.com"
  ) {
    return "/api";
  }

  // Development mode: use environment variable or localhost
  if (import.meta.env.DEV) {
    return import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";
  }

  // Production: Use direct backend URL on port 8000
  // return "/api";
  return "http://50.17.4.22:8000/api";
};

// Export the API base URL as a constant
export const API_BASE_URL = getApiBaseUrl();

// Log the API URL in development for debugging
if (import.meta.env.DEV) {
  console.log("🔗 API Base URL:", API_BASE_URL);
}
