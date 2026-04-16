import React from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/routes/routes";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  UserStar,
  User,
  ShieldCheck,
  Ticket,
  BriefcaseBusiness,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

type RoleConfig = {
  group: string;
  route: string;
  desc: string;
  icon: any;
  priority: number;
};

const ROLE_CONFIG: Record<string, RoleConfig> = {
  // Employee Portal Group
  admin: {
    group: "Employee Portal",
    route: ROUTES.adminDashboard,
    desc: "Manage system configurations, masters, and organization-wide approvals.",
    icon: ShieldCheck,
    priority: 10,
  },
  ceo: {
    group: "Employee Portal",
    route: ROUTES.adminDashboard,
    desc: "Executive dashboard for organizational oversight.",
    icon: ShieldCheck,
    priority: 10,
  },
  chro: {
    group: "Employee Portal",
    route: ROUTES.adminDashboard,
    desc: "HR oversight and policy management.",
    icon: ShieldCheck,
    priority: 10,
  },
  finance: {
    group: "Employee Portal",
    route: ROUTES.employeeDashboard,
    desc: "Financial oversight and reimbursement processing.",
    icon: ShieldCheck,
    priority: 10,
  },
  manager: {
    group: "Employee Portal",
    route: ROUTES.adminDashboard,
    desc: "Managerial approvals and team oversight.",
    icon: ShieldCheck,
    priority: 8,
  },
  employee: {
    group: "Employee Portal",
    route: ROUTES.employeeDashboard,
    desc: "Create travel applications, submit expense claims, and track your history.",
    icon: User,
    priority: 1,
  },

  // Travel Desk Portal Group
  travel_desk: {
    group: "Travel Desk Portal",
    route: ROUTES.deskAgentDashboard,
    desc: "Process travel requests, manage itineraries, and coordinate with booking agents.",
    icon: UserStar,
    priority: 10,
  },
  global_travel_desk: {
    group: "Travel Desk Portal",
    route: ROUTES.deskAgentDashboard,
    desc: "Centralized view of all travel requests across all branches.",
    icon: UserStar,
    priority: 10,
  },

  // Booking Agent Portal Group
  booking_agent: {
    group: "Booking Agent Portal",
    route: ROUTES.bookingAgentDashboard,
    desc: "Handle ticket bookings, hotel reservations, and travel logistics.",
    icon: Ticket,
    priority: 10,
  },
};

const ChoosePortal: React.FC = () => {
  const navigate = useNavigate();

  const roles = JSON.parse(localStorage.getItem("roles") || "[]");
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  // Determine unique portal groups available to user
  const portals = React.useMemo(() => {
    const portalMap: Record<string, RoleConfig & { isPrimary: boolean }> = {};

    roles.forEach((role: any) => {
      const roleKey = role.role_type?.toLowerCase();
      const config = ROLE_CONFIG[roleKey];

      if (config) {
        // Check if we already have this group
        const existing = portalMap[config.group];

        // We want the route with the HIGHEST priority within the same group
        // e.g. Admin (10) > Employee (1) -> Route to Admin Dashboard
        if (!existing || config.priority > existing.priority) {
          portalMap[config.group] = {
            ...config,
            isPrimary: existing?.isPrimary || !!role.is_primary, // Keep primary flag if any role in group is primary
          };
        } else {
          // If existing has higher/equal priority, just update isPrimary flag if needed
          if (role.is_primary) {
            portalMap[config.group].isPrimary = true;
          }
        }
      }
    });

    // Convert map to array and sort by primary status
    return Object.values(portalMap).sort(
      (a, b) => Number(b.isPrimary) - Number(a.isPrimary),
    );
  }, [roles]);

  React.useEffect(() => {
    // If user has access to exactly one portal group, auto-redirect
    if (portals.length === 1) {
      navigate(portals[0].route, { replace: true });
    } else if (portals.length === 0) {
      // Fallback if no roles match
      const primary =
        localStorage.getItem("primary_dashboard") || ROUTES.employeeDashboard;
      // Check if we should redirect or stay?
      // If no roles, stay to show "No roles found" message.
      // But if they have roles that just aren't in our config?
      // We'll let the "No roles found" UI handle it.
    }
  }, [portals, navigate]);

  const handleSelect = (route: string) => {
    localStorage.setItem("primary_dashboard", route);
    navigate(route);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-[60%] max-w-6xl px-4 sm:px-6 py-10">
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-2">
            Welcome, {user.username || "User"}
          </h1>
          <p className="text-slate-600 text-base sm:text-lg">
            Please select the portal you wish to access today.
          </p>
        </div>

        {portals.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
            {portals.map((portal) => {
              const Icon = portal.icon;
              const isPrimary = portal.isPrimary;

              return (
                <Card
                  key={portal.group}
                  className={cn(
                    "cursor-pointer border-2 transition-all duration-300 group hover:shadow-xl active:scale-[0.99]",
                    isPrimary
                      ? "border-blue-500 bg-blue-50/30"
                      : "border-slate-200 hover:border-blue-300",
                  )}
                  onClick={() => handleSelect(portal.route)}
                >
                  <CardHeader className="flex flex-row items-start gap-4 space-y-0">
                    <div
                      className={cn(
                        "p-3 rounded-xl transition-colors",
                        isPrimary
                          ? "bg-blue-600 text-white"
                          : "bg-slate-100 text-slate-700 group-hover:bg-blue-100 group-hover:text-blue-700",
                      )}
                    >
                      <Icon size={24} />
                    </div>

                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <CardTitle className="text-lg sm:text-xl leading-tight">
                          {portal.group}
                        </CardTitle>
                      </div>

                      {isPrimary && (
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-600 text-white px-2 py-0.5 rounded-full mt-2 inline-block">
                          Primary Role
                        </span>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent>
                    <CardDescription className="text-slate-600 leading-relaxed mb-4 line-clamp-3">
                      {portal.desc}
                    </CardDescription>

                    <Button
                      variant={isPrimary ? "default" : "outline"}
                      className="w-full"
                    >
                      Access Portal
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center mt-10">
            <p className="text-red-500 font-medium">
              No roles found. Please contact support.
            </p>
            <Button variant="link" onClick={() => navigate(ROUTES.login)}>
              Back to Login
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChoosePortal;
