import {
  LayoutDashboard,
  Plane,
  FilePlus,
  ClipboardIcon,
  CircleCheckBig,
  ReceiptIndianRupee,
  CreditCard,
  Settings,
  Database,
  Clock,
  Hotel,
  Car,
  Upload,
  Wallet,
  ClipboardList,
  BadgeIndianRupee,
  User,
  FileX,
  FileXIcon,
  ShieldCheck,
  AlertTriangle,
  FileSpreadsheet,
} from "lucide-react";
import { ROUTES } from "@/routes/routes";

export type SidebarItem = {
  label: string;
  path: string;
  Icon: React.ComponentType<any>;
};

export type SidebarSection = {
  title: string;
  icon: React.ComponentType<any>;
  path?: string;
  collapsible?: boolean;
  items?: SidebarItem[];
};

// Helper to check for finance role dynamically
const checkFinanceRole = (): boolean => {
  try {
    const roles = JSON.parse(localStorage.getItem("roles") || "[]");
    return roles.some((r: any) => r.role_type?.toLowerCase() === "finance");
  } catch (err) {
    console.error("Error parsing roles for sidebar:", err);
    return false;
  }
};

// ------------------------------------------------------
// Admin Sidebar
// ------------------------------------------------------
export const getAdminSidebar = (primaryDashboard: string): SidebarSection[] => [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    path: primaryDashboard,
  },
  {
    title: "Travel",
    icon: Plane,
    collapsible: true,
    items: [
      {
        label: "Create Request",
        path: ROUTES.makeTravelApplicationNew,
        Icon: FilePlus,
      },
      {
        label: "My Applications",
        path: ROUTES.travelApplicationList,
        Icon: ClipboardIcon,
      },
      {
        label: "Approvals",
        path: ROUTES.travelRequestApproval,
        Icon: CircleCheckBig,
      },
    ],
  },
  {
    title: "Cancellation",
    icon: FileXIcon,
    collapsible: true,
    items: [
      {
        label: "Cancel Application",
        path: ROUTES.travelCancellationRequest,
        Icon: FileX,
      },
      // {
      //   label: "Cancellation Approvals",
      //   path: ROUTES.travelCancellationApproval,
      //   Icon: ShieldCheck,
      // },
    ],
  },
  {
    title: "Expense",
    icon: ReceiptIndianRupee,
    collapsible: true,
    items: [
      {
        label: "My Claims",
        path: ROUTES.indexClaimPage,
        Icon: BadgeIndianRupee,
      },
      {
        label: "Claim Application",
        path: ROUTES.claimApplicationPage,
        Icon: CreditCard,
      },
      {
        label: "Claim Approvals",
        path: ROUTES.claimApprovalPage,
        Icon: CircleCheckBig,
      },
    ],
  },
  ...(checkFinanceRole()
    ? [
        {
          title: "Finance",
          icon: Wallet, // choose icon
          collapsible: true,
          items: [
            {
              label: "Advance Workspace",
              path: ROUTES.advanceWorkspacePage,
              Icon: ClipboardList,
            },
            {
              label: "Claims Workspace",
              path: ROUTES.financeActionPage,
              Icon: ClipboardList,
            },
            {
              label: "Claim Report",
              path: ROUTES.claimReportPage,
              Icon: FileSpreadsheet,
            },
          ],
        },
      ]
    : []),
  {
    title: "Settings",
    icon: Settings,
    collapsible: true,
    items: [
      { label: "Masters", path: ROUTES.master, Icon: Database },
      { label: "Import/Export", path: ROUTES.importExport, Icon: Upload },
    ],
  },
];

// ------------------------------------------------------
// Employee Sidebar
// ------------------------------------------------------
export const getEmployeeSidebar = (
  primaryDashboard: string,
): SidebarSection[] => [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    path: primaryDashboard,
  },
  {
    title: "Travel",
    icon: Plane,
    collapsible: true,
    items: [
      {
        label: "Create Request",
        path: ROUTES.makeTravelApplicationNew,
        Icon: FilePlus,
      },
      {
        label: "My Applications",
        path: ROUTES.travelApplicationList,
        Icon: ClipboardIcon,
      },
      {
        label: "Approvals",
        path: ROUTES.travelRequestApproval,
        Icon: CircleCheckBig,
      },
    ],
  },
  {
    title: "Cancellation",
    icon: FileXIcon,
    collapsible: true,
    items: [
      {
        label: "Cancel Application",
        path: ROUTES.travelCancellationRequest,
        Icon: FileX,
      },
      // {
      //   label: "Cancellation Approvals",
      //   path: ROUTES.travelCancellationApproval,
      //   Icon: ShieldCheck,
      // },
    ],
  },
  {
    title: "Expense",
    icon: ReceiptIndianRupee,
    collapsible: true,
    items: [
      {
        label: "My Claims",
        path: ROUTES.indexClaimPage,
        Icon: BadgeIndianRupee,
      },
      {
        label: "Claim Application",
        path: ROUTES.claimApplicationPage,
        Icon: CreditCard,
      },
      {
        label: "Claim Approvals",
        path: ROUTES.claimApprovalPage,
        Icon: CircleCheckBig,
      },
    ],
  },
  ...(checkFinanceRole()
    ? [
        {
          title: "Finance",
          icon: Wallet, // choose icon
          collapsible: true,
          items: [
            {
              label: "Advance Workspace",
              path: ROUTES.advanceWorkspacePage,
              Icon: ClipboardList,
            },
            {
              label: "Claims Workspace",
              path: ROUTES.financeActionPage,
              Icon: ClipboardList,
            },
            {
              label: "Claim Report",
              path: ROUTES.claimReportPage,
              Icon: FileSpreadsheet,
            },
          ],
        },
      ]
    : []),
];

// ------------------------------------------------------
// Booking Agent Sidebar
// ------------------------------------------------------
export const getBookingAgentSidebar = (): SidebarSection[] => [
  // { title: "Travel Bookings", icon: Plane, path: "/booking-agent/travel-bookings" },
  // { title: "Hotel Bookings", icon: Hotel, path: "/booking-agent/hotel-bookings" },
  // { title: "Car Rentals", icon: Car, path: "/booking-agent/car-rentals" },
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    path: ROUTES.bookingAgentDashboard,
  },
  { title: "Pending Requests", icon: Clock, path: ROUTES.pendingBookingsPage },
  // { title: "Analytics", icon: BarChart3, path: "/booking-agent/analytics" },
];

// ------------------------------------------------------
// Travel Desk Sidebar
// ------------------------------------------------------
export const getTravelDeskSidebar = (): SidebarSection[] => [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    path: ROUTES.deskAgentDashboard,
  },
  {
    title: "Booking Agents",
    icon: User,
    path: ROUTES.bookingAgentsFromTravelDesk,
  },
  {
    title: "Duty Slip Generation",
    icon: ReceiptIndianRupee,
    path: ROUTES.dutySlipGeneration,
  },
];
