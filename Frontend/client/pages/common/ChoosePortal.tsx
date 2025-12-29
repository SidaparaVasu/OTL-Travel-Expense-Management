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
import { LayoutDashboard, User, ShieldCheck, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";

const ROLE_CONFIG: Record<
  string,
  { title: string; desc: string; icon: any; route: string }
> = {
  admin: {
    title: "Administrator Portal",
    desc: "Manage system configurations, masters, and organization-wide approvals.",
    icon: ShieldCheck,
    route: ROUTES.adminDashboard,
  },
  travel_desk: {
    title: "Travel Desk Portal",
    desc: "Process travel requests, manage itineraries, and coordinate with booking agents.",
    icon: LayoutDashboard,
    route: ROUTES.deskAgentDashboard,
  },
  booking_agent: {
    title: "Booking Agent Portal",
    desc: "Handle ticket bookings, hotel reservations, and travel logistics.",
    icon: Briefcase,
    route: ROUTES.bookingAgentDashboard,
  },
  employee: {
    title: "Employee Portal",
    desc: "Create travel applications, submit expense claims, and track your history.",
    icon: User,
    route: ROUTES.employeeDashboard,
  },
  manager: {
    title: "Manager Portal",
    desc: "Review and approve travel and expense requests from your team.",
    icon: ShieldCheck,
    route: ROUTES.adminDashboard,
  },
  ceo: {
    title: "Executive Portal",
    desc: "Strategic overview and executive-level approvals.",
    icon: ShieldCheck,
    route: ROUTES.adminDashboard,
  },
  chro: {
    title: "HR Portal",
    desc: "Human resources oversight and policy-level approvals.",
    icon: ShieldCheck,
    route: ROUTES.adminDashboard,
  },
};

const ChoosePortal: React.FC = () => {
  const navigate = useNavigate();

  const roles = JSON.parse(localStorage.getItem("roles") || "[]");
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const handleSelect = (route: string) => {
    localStorage.setItem("primary_dashboard", route);
    navigate(route);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="max-w-4xl w-full text-center mb-10">
        <h1 className="text-4xl font-bold text-slate-900 mb-2">
          Welcome, {user.username}
        </h1>
        <p className="text-slate-600 text-lg">
          Please select the portal you wish to access today.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 max-w-4xl w-full">
        {roles.map((role: any) => {
          const config = ROLE_CONFIG[role.role_type?.toLowerCase()] || {
            title: role.role_name || "Unknown Role",
            desc: "Access your dashboard.",
            icon: LayoutDashboard,
            route: ROUTES.employeeDashboard,
          };
          const Icon = config.icon;
          const isPrimary = role.is_primary;

          return (
            <Card
              key={role.id}
              className={cn(
                "cursor-pointer hover:shadow-xl transition-all duration-300 border-2 group",
                isPrimary
                  ? "border-blue-500 bg-blue-50/30"
                  : "border-slate-100 hover:border-blue-300",
              )}
              onClick={() => handleSelect(config.route)}
            >
              <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                <div
                  className={cn(
                    "p-3 rounded-xl transition-colors",
                    isPrimary
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-600",
                  )}
                >
                  <Icon size={24} />
                </div>
                <div>
                  <CardTitle className="text-xl">{config.title}</CardTitle>
                  {isPrimary && (
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-600 text-white px-2 py-0.5 rounded-full mt-1 inline-block">
                      Primary Role
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-slate-600 leading-relaxed mb-4">
                  {config.desc}
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

      {roles.length === 0 && (
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
  );
};

export default ChoosePortal;
