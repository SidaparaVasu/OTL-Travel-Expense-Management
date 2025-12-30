/**
 * Dynamic API Configuration
 * Automatically detects the correct backend API URL based on the current hostname
 */

/**
 * Get the API base URL based on current hostname
 * @returns The API base URL for the current environment
 */
export const getApiBaseUrl = (): string => {
  // Development mode: use environment variable or localhost
  if (import.meta.env.DEV) {
    return import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";
  }

  // Production: Use relative URL
  // Nginx reverse proxy will route /api requests to the backend
  // This way, no IPs are hardcoded in the source code
  return "/api";
};

// Export the API base URL as a constant
export const API_BASE_URL = getApiBaseUrl();

// Log the API URL in development for debugging
if (import.meta.env.DEV) {
  console.log("🔗 API Base URL:", API_BASE_URL);
}
