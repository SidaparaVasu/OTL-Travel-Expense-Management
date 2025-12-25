import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { ROUTES } from "@/routes/routes";
import { useAuthStore } from "@/src/store/authStore";
import SSOSyncing from "@/pages/common/SSOSyncing";

/**
 * SSO Authentication Handler
 * Intercepts ?auth= parameter and performs SSO login
 */
export const SSOHandler = () => {
  const navigate = useNavigate();
  const { initializeAuth } = useAuthStore();
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const handleSSOLogin = async () => {
      // Check for auth parameter in URL
      const urlParams = new URLSearchParams(window.location.search);
      const authToken = urlParams.get("auth")?.trim();

      if (!authToken) {
        return; // No SSO token, skip
      }

      try {
        setIsSyncing(true);
        // Robust backend URL detection
        const envBaseAlt = import.meta.env.VITE_API_BASE_URL_ALT;
        const envBase = import.meta.env.VITE_API_BASE_URL;

        const rawBaseUrl =
          window.location.hostname === "localhost"
            ? envBase || "http://localhost:8000"
            : envBaseAlt || envBase || window.location.origin;

        const backendBaseUrl = rawBaseUrl
          .replace(/\/api\/?$/, "")
          .replace(/\/+$/, "");

        const ssoUrl = `${backendBaseUrl}/sso/login/`;

        const response = await axios.get(ssoUrl, {
          params: { auth: authToken },
        });

        if (response.data.success) {
          const { tokens, user, roles, permissions, profile } =
            response.data.data;

          // Store authentication data
          localStorage.setItem("access_token", tokens.access);
          localStorage.setItem("refresh_token", tokens.refresh);
          localStorage.setItem("user", JSON.stringify(user));
          localStorage.setItem("roles", JSON.stringify(roles));
          localStorage.setItem("permissions", JSON.stringify(permissions));
          if (profile) {
            localStorage.setItem("profile", JSON.stringify(profile));
          }

          initializeAuth();

          // Determine redirect based on roles
          const primaryRole = roles.find((r: any) => r.is_primary);
          let redirectPath = ROUTES.employeeDashboard;

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

          // Delay slightly for UX before redirect
          setTimeout(() => {
            window.location.href = redirectPath;
          }, 1500);
        } else {
          setIsSyncing(false);
          toast.error("SSO Authentication Failed", {
            description: response.data.message || "Unknown error",
          });
        }
      } catch (error: any) {
        setIsSyncing(false);
        console.error("Detailed SSO login error:", error);

        toast.error("SSO Authentication Failed", {
          description:
            error.response?.data?.message ||
            error.response?.data?.error ||
            "Unable to authenticate. Please try again.",
        });

        window.history.replaceState({}, "", window.location.pathname);
      }
    };

    handleSSOLogin();
  }, [navigate]);

  if (isSyncing) {
    return <SSOSyncing />;
  }

  return null;
};
