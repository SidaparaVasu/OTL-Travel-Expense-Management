import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { ROUTES } from "@/routes/routes";
import { useAuthStore } from "@/src/store/authStore";

/**
 * SSO Authentication Handler
 * Intercepts ?auth= parameter and performs SSO login
 */
export const SSOHandler = () => {
  const navigate = useNavigate();
  const { initializeAuth } = useAuthStore();

  useEffect(() => {
    const handleSSOLogin = async () => {
      // Check for auth parameter in URL
      const urlParams = new URLSearchParams(window.location.search);
      const authToken = urlParams.get("auth");

      if (!authToken) {
        return; // No SSO token, skip
      }

      try {
        // Show loading toast
        const loadingToast = toast.loading("Authenticating via HRMS...");

        // Robust backend URL detection
        const envBaseAlt = import.meta.env.VITE_API_BASE_URL_ALT;
        const envBase = import.meta.env.VITE_API_BASE_URL;

        // Determine backend base URL:
        // 1. Try ALT env (production standard)
        // 2. Try Standard env
        // 3. Try origin if on localhost
        // Then remove /api and trailing slashes
        const rawBaseUrl =
          window.location.hostname === "localhost"
            ? envBase || "http://localhost:8000"
            : envBaseAlt || envBase || window.location.origin;

        const backendBaseUrl = rawBaseUrl
          .replace(/\/api\/?$/, "")
          .replace(/\/+$/, "");

        console.log("SSO Authentication Trace:", {
          hostname: window.location.hostname,
          envBaseAlt,
          envBase,
          selectedBase: rawBaseUrl,
          finalBackendUrl: backendBaseUrl,
        });

        // Call backend SSO endpoint (note: /sso not /api/sso)
        const ssoUrl = `${backendBaseUrl}/sso/login/`;
        console.log("Calling SSO Endpoint:", ssoUrl);

        const response = await axios.get(ssoUrl, {
          params: { auth: authToken },
        });

        if (response.data.success) {
          const { tokens, user, roles, permissions, profile } =
            response.data.data;

          // Store authentication data (same as regular login)
          localStorage.setItem("access_token", tokens.access);
          localStorage.setItem("refresh_token", tokens.refresh);
          localStorage.setItem("user", JSON.stringify(user));
          localStorage.setItem("roles", JSON.stringify(roles));
          localStorage.setItem("permissions", JSON.stringify(permissions));
          if (profile) {
            localStorage.setItem("profile", JSON.stringify(profile));
          }

          // CRITICAL: Initialize auth store with localStorage data
          initializeAuth();

          // Dismiss loading toast
          toast.dismiss(loadingToast);

          // Success toast
          toast.success("SSO Login Successful", {
            description: `Welcome, ${user.full_name}!`,
          });

          // Determine redirect based on roles
          const primaryRole = roles.find((r: any) => r.is_primary);
          let redirectPath = ROUTES.employeeDashboard; // Default

          if (primaryRole) {
            const roleType = primaryRole.role_type?.toLowerCase();

            if (roleType === "admin") {
              redirectPath = ROUTES.adminDashboard;
            } else if (roleType === "travel_desk") {
              redirectPath = ROUTES.deskAgentDashboard;
            } else if (roleType === "booking_agent") {
              redirectPath = ROUTES.bookingAgentDashboard;
            } else if (["manager", "chro", "ceo"].includes(roleType)) {
              redirectPath = ROUTES.adminDashboard;
            }
          }

          // Use window.location.href for hard redirect (ensures navigation works)
          window.location.href = redirectPath;
        } else {
          console.error("SSO Response failed (success=false):", response.data);
          toast.dismiss(loadingToast);
          toast.error("SSO Authentication Failed", {
            description: response.data.message || "Unknown error",
          });
        }
      } catch (error: any) {
        console.error("Detailed SSO login error:", {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
          headers: error.response?.headers,
          url: error.config?.url,
          method: error.config?.method,
          params: error.config?.params,
        });

        toast.error("SSO Authentication Failed", {
          description:
            error.response?.data?.message ||
            error.response?.data?.error ||
            "Unable to authenticate. Please try again.",
        });

        // Clear auth param from URL
        window.history.replaceState({}, "", window.location.pathname);

        // Redirect to login page
        // window.location.href = ROUTES.login;
      }
    };

    handleSSOLogin();
  }, [navigate]);

  return null; // This component renders nothing
};
