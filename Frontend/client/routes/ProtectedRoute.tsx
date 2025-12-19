import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/src/store/authStore";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredDashboard?: string;
}

export default function ProtectedRoute({
  children,
  requiredDashboard,
}: ProtectedRouteProps) {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!requiredDashboard) return <>{children}</>;

  const roles = JSON.parse(localStorage.getItem("roles") || "[]").map(
    (r: any) => r.role_type?.toLowerCase(),
  );

  const adminRoles = ["admin", "manager", "ceo", "chro"];

  const required = requiredDashboard.toLowerCase();

  let hasAccess = false;

  if (required === "admin") {
    hasAccess = roles.some((r) => adminRoles.includes(r));
  } else if (required === "travel_desk") {
    hasAccess = roles.includes("travel_desk");
  } else if (required === "booking_agent") {
    hasAccess = roles.includes("booking_agent");
  } else if (required === "employee") {
    hasAccess = roles.includes("employee");
  } else if (required === "admin_or_desk") {
    hasAccess =
      roles.some((r) => adminRoles.includes(r)) ||
      roles.includes("travel_desk");
  }

  if (!hasAccess) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
