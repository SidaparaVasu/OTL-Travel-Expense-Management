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

type PortalConfig = {
  title: string;
  desc: string;
  icon: any;
  route: string;
  portalKey: string;
};

const ROLE_CONFIG: Record<string, PortalConfig> = {
  admin: {
    title: "Administrator Portal",
    desc: "Manage system configurations, masters, and organization-wide approvals.",
    icon: ShieldCheck,
    route: ROUTES.adminDashboard,
    portalKey: "admin",
  },
  ceo: {
    title: "Administrator Portal",
    desc: "Manage system configurations, masters, and organization-wide approvals.",
    icon: ShieldCheck,
    route: ROUTES.adminDashboard,
    portalKey: "admin",
  },
  chro: {
    title: "Administrator Portal",
    desc: "Manage system configurations, masters, and organization-wide approvals.",
    icon: ShieldCheck,
    route: ROUTES.adminDashboard,
    portalKey: "admin",
  },
  travel_desk: {
    title: "Travel Desk Portal",
    desc: "Process travel requests, manage itineraries, and coordinate with booking agents.",
    icon: UserStar,
    route: ROUTES.deskAgentDashboard,
    portalKey: "travel_desk",
  },
  booking_agent: {
    title: "Booking Agent Portal",
    desc: "Handle ticket bookings, hotel reservations, and travel logistics.",
    icon: Ticket,
    route: ROUTES.bookingAgentDashboard,
    portalKey: "booking_agent",
  },
  employee: {
    title: "Employee Portal",
    desc: "Create travel applications, submit expense claims, and track your history.",
    icon: User,
    route: ROUTES.employeeDashboard,
    portalKey: "employee",
  },
  manager: {
    title: "Manager Portal",
    desc: "Review and approve travel and expense requests from your team.",
    icon: ShieldCheck,
    route: ROUTES.adminDashboard,
    portalKey: "employee",
  },
};

const ChoosePortal: React.FC = () => {
  const navigate = useNavigate();

  const roles = JSON.parse(localStorage.getItem("roles") || "[]");
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  // roles except finance for portal selection
  const portalRoles = roles.filter(
    (r: any) => r.role_type?.toLowerCase() !== "finance",
  );

  React.useEffect(() => {
    if (portalRoles.length === 0) {
      // Redirect to saved primary dashboard OR default employee dashboard
      const primary =
        localStorage.getItem("primary_dashboard") || ROUTES.employeeDashboard;

      navigate(primary, { replace: true });
    }
  }, [navigate, portalRoles.length]);

  const handleSelect = (route: string) => {
    localStorage.setItem("primary_dashboard", route);
    navigate(route);
  };

  const portals: Array<PortalConfig & { isPrimary: boolean }> = Object.values(
    portalRoles.reduce((acc: any, role: any) => {
      const roleType = role.role_type?.toLowerCase();
      const config = ROLE_CONFIG[roleType];

      const safeConfig: PortalConfig =
        config ||
        ({
          title: role.role_name || "Unknown Role",
          desc: "Access your dashboard.",
          icon: UserStar,
          route: ROUTES.employeeDashboard,
          portalKey: roleType || "employee",
        } as PortalConfig);

      const key = safeConfig.portalKey;

      if (!acc[key]) {
        acc[key] = { ...safeConfig, isPrimary: !!role.is_primary };
      } else {
        acc[key].isPrimary = acc[key].isPrimary || !!role.is_primary;
      }

      return acc;
    }, {}),
  ).sort((a: any, b: any) => Number(b.isPrimary) - Number(a.isPrimary));

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
            {portals.map((portal: any) => {
              const Icon = portal.icon;
              const isPrimary = portal.isPrimary;

              return (
                <Card
                  key={portal.portalKey}
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
                          {portal.title}
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
