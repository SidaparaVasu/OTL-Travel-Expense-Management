import { useState, useMemo, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { authAPI } from "@/src/api/auth";
import { ROUTES } from "@/routes/routes";
import OrangeLogo from "@/assets/logo-otl-e1576143457585.png";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  Bell,
  Menu,
  ChevronDown,
  Users,
  LogOut,
  Settings,
} from "lucide-react";

import {
  getAdminSidebar,
  getEmployeeSidebar,
  getTravelDeskSidebar,
  getBookingAgentSidebar,
  type SidebarSection,
} from "./sidebarConfig";

// ------------------------------------------------------
// Helpers
// ------------------------------------------------------

const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return { username: "User" };
  }
};

const getRoleTypes = (): string[] => {
  try {
    const roles = JSON.parse(localStorage.getItem("roles") || "[]");
    return roles.map((r: any) => r.role_type?.toLowerCase()).filter(Boolean) || [];
  } catch {
    return [];
  }
};

const getPrimaryDashboard = (): string => {
  const roleTypes = getRoleTypes();
  if (roleTypes.some(r => ["admin", "manager", "chro", "ceo"].includes(r))) {
    return "/admin/dashboard";
  }
  if (roleTypes.includes("travel_desk")) {
    return "/travel_desk/dashboard";
  }
  if (roleTypes.includes("booking_agent")) {
    return "/desk-agent/travel-bookings";
  }
  const stored = localStorage.getItem("primary_dashboard");
  if (stored) return stored.startsWith("/") ? stored : `/${stored}`;
  return "/employee/dashboard";
};

type UserRoleType = "admin" | "travel_desk" | "booking_agent" | "employee";

const detectUserRoleType = (): UserRoleType => {
  const roleTypes = getRoleTypes();

  // Check admin roles first
  if (roleTypes.some(r => ["admin", "ceo", "chro"].includes(r))) {
    return "admin";
  }
  // Then travel desk
  if (roleTypes.includes("travel_desk")) {
    return "travel_desk";
  }
  // Then booking agent
  if (roleTypes.includes("booking_agent")) {
    return "booking_agent";
  }
  // Default to employee
  return "employee";
};

const getSidebarSections = (roleType: UserRoleType, primaryDashboard: string): SidebarSection[] => {
  switch (roleType) {
    case "admin":
      return getAdminSidebar(primaryDashboard);
    case "travel_desk":
      return getTravelDeskSidebar();
    case "booking_agent":
      return getBookingAgentSidebar();
    case "employee":
    default:
      return getEmployeeSidebar(primaryDashboard);
  }
};

// ------------------------------------------------------
// Logo Component
// ------------------------------------------------------
const Logo = ({ expanded }: { expanded: boolean }) => (
  <div className="flex items-center gap-3">
    <div className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0">
      <img src={OrangeLogo} alt="Orange LOGO" />
    </div>
    <span
      className={cn(
        "text-lg font-semibold text-foreground whitespace-nowrap transition-all duration-300",
        expanded ? "opacity-100 w-auto" : "opacity-0 w-0 overflow-hidden"
      )}
    >
      Orange Travel Expense
    </span>
  </div>
);

// ------------------------------------------------------
// Layout Component
// ------------------------------------------------------

interface UnifiedLayoutProps {
  children: React.ReactNode;
}

export function UnifiedLayout({ children }: UnifiedLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [activeSection, setActiveSection] = useState<string>("");

  const user = useMemo(() => getUser(), []);
  const roleType = useMemo(() => detectUserRoleType(), []);
  const primaryDashboard = useMemo(() => getPrimaryDashboard(), []);
  const sections = useMemo(
    () => getSidebarSections(roleType, primaryDashboard),
    [roleType, primaryDashboard]
  );

  const expanded = !sidebarCollapsed;

  // Auto-open current section based on URL
  useEffect(() => {
    const found = sections.find(
      (s) =>
        s.path === location.pathname ||
        s.items?.some((i) => i.path === location.pathname)
    );
    if (found) {
      setActiveSection(found.title);
      if (found.collapsible) {
        setOpenSections((prev) => ({ ...prev, [found.title]: true }));
      }
    }
  }, [location.pathname, sections]);

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch { }
    navigate(ROUTES.login);
  };

  const navigateTo = (path: string) => navigate(path);

  const toggleSection = (title: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [title]: !prev[title],
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-40 h-screen bg-background border-r border-gray-200 transition-all duration-300",
          expanded ? "w-[280px]" : "w-20"
        )}
      >
        {/* Logo */}
        <div className="flex h-20 items-center px-6 border-b border-gray-200">
          <Logo expanded={expanded} />
        </div>

        <nav className="px-3 py-4 space-y-1 overflow-y-auto overflow-x-hidden h-[calc(100vh-5rem)]">
          {sections.map((section) => {
            const Icon = section.icon;
            const isOpen = openSections[section.title];
            const items = section.items || [];
            const isActive = activeSection === section.title;

            return (
              <div key={section.title}>
                {/* Main Tab */}
                <button
                  onClick={() => {
                    setActiveSection(section.title);
                    if (section.collapsible && items.length) {
                      toggleSection(section.title);
                    } else if (section.path) {
                      navigateTo(section.path);
                    }
                  }}
                  className={cn(
                    "flex w-full items-center rounded-lg py-2.5 transition-all duration-300 focus:outline-none",
                    expanded ? "px-4 gap-3 justify-between" : "px-4 justify-center",
                    isActive
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-gray-600 hover:bg-gray-100"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon
                      className={cn(
                        "h-5 w-5 flex-shrink-0",
                        isActive ? "text-white" : "text-gray-600"
                      )}
                      strokeWidth={2}
                    />
                    {expanded && (
                      <span className="text-sm font-medium whitespace-nowrap truncate">
                        {section.title}
                      </span>
                    )}
                  </div>
                  {expanded && section.collapsible && items.length > 0 && (
                    <ChevronDown
                      size={16}
                      className={cn(
                        "flex-shrink-0 transition-transform duration-300",
                        isOpen ? "rotate-180" : "rotate-0",
                        isActive ? "text-white" : "text-gray-600"
                      )}
                    />
                  )}
                </button>

                {/* Submenu */}
                {expanded && section.collapsible && isOpen && items.length > 0 && (
                  <div className="mt-1 space-y-1 overflow-hidden">
                    {items.map((item) => {
                      const ItemIcon = item.Icon;
                      const isItemActive = location.pathname === item.path;

                      return (
                        <button
                          key={item.path}
                          onClick={() => navigateTo(item.path)}
                          className={cn(
                            "w-full flex items-center gap-3 py-2 pl-12 pr-4 text-sm rounded-lg transition-all duration-300 focus:outline-none min-w-0",
                            isItemActive
                              ? "bg-blue-50 text-blue-700 font-medium"
                              : "text-gray-600 hover:bg-gray-50"
                          )}
                        >
                          <ItemIcon className="h-4 w-4 flex-shrink-0" strokeWidth={2} />
                          <span className="truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Main Area */}
      <div
        className={cn(
          "transition-all duration-300 min-h-screen",
          expanded ? "ml-[280px]" : "ml-20"
        )}
      >
        {/* Header */}
        <header className="sticky top-0 z-30 h-20 bg-background border-b border-gray-200 px-6">
          <div className="flex h-full items-center justify-between">
            <button
              onClick={() => setSidebarCollapsed((prev) => !prev)}
              className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-gray-100 transition-colors focus:outline-none"
            >
              <Menu className="h-6 w-6 text-foreground" />
            </button>

            <div className="flex items-center gap-4">
              {/* Notifications */}
              <button className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-50 hover:bg-gray-100 relative transition-colors">
                <Bell className="h-5 w-5 text-foreground" />
                <span className="absolute top-2 right-2 h-2 w-2 bg-destructive rounded-full"></span>
              </button>

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-3 rounded-lg p-2 hover:bg-gray-100 transition-colors focus:outline-none">
                    <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold">
                      {user.username?.charAt(0)?.toUpperCase() || "U"}
                    </div>
                    <span className="hidden sm:block text-sm font-medium text-foreground">
                      {user.username || "User"}
                    </span>
                  </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  <DropdownMenuItem onClick={() => navigate(ROUTES.profile)}>
                    <Users className="mr-2 h-4 w-4" /> Profile
                  </DropdownMenuItem>

                  <DropdownMenuItem onClick={() => navigate("/settings")}>
                    <Settings className="mr-2 h-4 w-4" /> Settings
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem onClick={logout} className="text-destructive">
                    <LogOut className="mr-2 h-4 w-4" /> Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="min-h-[calc(100vh-5rem)] p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
