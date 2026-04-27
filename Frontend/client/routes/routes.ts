export const ROUTES = {
  // ---------------- AUTH ----------------
  login: "/login",
  choosePortal: "/choose-portal",
  root: "/",

  // ---------------- DASHBOARDS ----------------
  adminDashboard: "/admin_fe/dashboard",
  employeeDashboard: "/employee_fe/dashboard",
  deskAgentDashboard: "/travel_desk_fe/dashboard",
  bookingAgentDashboard: "/booking_agent_fe/dashboard",

  // ---------------- FINANCE ----------------
  financeActionPage: "/dashboard/finance/",
  advanceRequisitionPage: (id?: number | string) =>
    id
      ? `/dashboard/finance/advance-requisition/${id}`
      : `/dashboard/finance/advance-requisition`,
  advanceWorkspacePage: "/dashboard/finance/advance-workspace",

  // ---------------- PROFILE ----------------
  profile: "/profile",

  // ---------------- TRAVEL (Employee/Admin) ----------------
  makeTravelApplicationOld: "/travel/make-travel-application-old",
  // makeTravelApplication: (id?:number | string) => id ? `/travel/make-travel-application/${id}` : `/travel/make-travel-application`,
  makeTravelApplicationNew: "/travel/create-travel-application",
  editTravelApplication: (id: number | string) =>
    `/travel/create-travel-application?edit=${id}`,
  travelApplicationList: "/travel/travel-application-list",
  travelApplicationView: (id: number | string) =>
    `/travel/travel-application/${id}/`,
  // travelApplicationViewForFinance: (id: number | string) =>
  //   `/travel/travel-application/${id}/`,
  travelApplicationDetails: (id: number | string) =>
    `/travel/travel-application/${id}/details`,
  travelApplicationViewForFinance: (id: number | string) =>
    `/travel/travel-application/${id}/details`,
  // travelApplicationDetails: "/travel/travel-application/details",
  travelRequestApproval: "/travel/travel-request-approval",
  travelCancellationRequest: "/travel/cancellation-request",
  travelCancellationApproval: "/travel/cancellation-approval",

  // ---------------- EXPENSE MANAGEMENT ----------------
  indexExpense: "/expense",
  indexClaimPage: "/expense/my-claims",
  claimApplicationPage: "/expense/submit-claim",
  editClaimPage: (id: number | string) => `/expense/claims/${id}/edit`,
  claimDetailPage: (id: number | string) => `/expense/claims/${id}`,
  claimApprovalPage: "/expense/claim-approvals",

  // ---------------- BOOKING AGENT ----------------
  pendingBookingsPage: "/booking_agent_fe/pending-requests",

  // ---------------- ADMIN: MASTER PAGES ----------------
  master: "/masters",
  importExport: "/masters/import-export",

  // User Management Master
  userManagement: "/masters/user-management",
  users: "/masters/users",
  bookingAgents: "/masters/booking-agents",
  bookingAgentsFromTravelDesk: "/agents/booking-agents",

  // Employee Master
  employeeMasterPage: "/masters/employees",
  employeeMasterForm: "/masters/add-employee",

  // Organization Masters
  orgMaster: "/masters/organizations",
  employeeTypeMaster: "/masters/employee-type",

  // Geography Masters
  geographyMaster: "/masters/geography",
  cityCategoryMaster: "/masters/city-categories",
  locationMaster: "/masters/location",

  // Grade Master
  gradeMaster: "/masters/grade",

  // Travel Master
  gradeEntitlementMaster: "/masters/grade-entitlement",
  travelApplicationExport: "/masters/export-travel-applications",

  // Approval Matrix
  approvalMatrixMaster: "/masters/approval-matrix",

  // Accommodation Masters
  guestHouseMaster: "/masters/guest-house",
  guestHouseMasterForm: "/masters/create-guest-house",
  arcHotelMaster: "/masters/arc-hotel",
  arcHotelMasterForm: "/masters/create-arc-hotel",

  // SPOC
  locationSPOCMaster: "/masters/location-spoc",
  spocAssignmentMaster: "/masters/spoc-assignment",

  // User Role Assign
  userRoleAssigner: "/masters/user-role-assigner",

  // Conveyance Rate
  conveyanceRateMaster: "/masters/conveyance-rate",

  // DA Incidentals
  daIncidentalMaster: "/masters/da-incidentals",

  // Backdated Allowance
  backdatedTRAllowance: "/masters/backdated-allowance",

  // Travel Master
  glCodeMaster: "/masters/gl-code",
  travelModeMaster: "/masters/travel-mode",

  // Expense Master
  expenseTypeMaster: "/masters/expense-type",
  claimStatusMaster: "/masters/claim-status",

  // Vehicle Category Master
  vehicleCategoryMaster: "/masters/vehicle-category",
  vehicleTypeMaster: "/masters/vehicle-type",

  // ---------------- DUTY SLIP GENERATION ----------------
  dutySlipGeneration: "/travel-desk/duty-slip",

  // ---------------- SETTINGS / REPORTS ----------------
  settings: "/settings",
  reports: "/reports",
};
