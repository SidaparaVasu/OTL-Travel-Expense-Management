// App.tsx
import "./global.css";
import { createRoot } from "react-dom/client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import ProtectedRoute from "@/routes/ProtectedRoute";
import { ROUTES } from "@/routes/routes";
import UnauthorizedPage from "./pages/common/UnauthorizedPage";

// Layouts
import { UnifiedLayout } from "@/components/layouts/UnifiedLayout";

// Common Pages
import Login from "./pages/common/Login";
import NotFound from "./pages/common/NotFound";
import Profile from "./pages/common/Profile";
import ChoosePortal from "./pages/common/ChoosePortal";
import DutySlipGeneration from "./pages/deskagent/DutySlipGeneration";

// Dashboards
import AdminIndex from "./pages/admin/Index";
import EmployeeIndex from "./pages/employee/Index";
import TravelDeskDashboard from "./pages/deskagent/TravelDeskDashboard";
import BookingAgentDashboard from "./pages/booking-agent/BookingAgentDashboard";

// Finance Page
import FinancePage from "./pages/finance/FinancePage";
import AdvanceRequisitionPage from "./pages/finance/AdvanceRequisitionPage";
import AdvanceWorkspacePage from "./pages/finance/AdvanceWorkspacePage";

// Booking Agent
import BookingAgentBookings from "./pages/booking-agent/BookingAgentBookings";

// Travel
import MakeTravelApplicationOld from "./pages/common/travel/MakeTravelApplication";
import MakeTravelApplicationNew from "./pages/common/travel/travel-request/Index";
import TravelApplicationList from "./pages/common/travel/TravelApplicationList";
import ApplicationView from "./pages/common/travel/ApplicationView";
import TravelApplicationDetails from "./pages/common/travel/TravelApplicationDetails";
import TravelRequestApprovals from "./pages/common/travel/TravelRequestApprovals";
import TravelCancellationRequest from "./pages/common/travel/TravelCancellationRequest";
import TravelCancellationApproval from "./pages/common/travel/TravelCancellationApproval";
import TravelApplicationExportPage from "./pages/common/master/TravelApplicationExport";

// Expense
import ExpenseIndex from "./pages/common/expense/Index";
import MyClaimsPage from "./pages/common/expense/MyClaimsPage";
import ClaimDetailPage from "./pages/common/expense/ClaimDetailPage";
import CreateClaimApplicationPage from "./pages/common/expense/CreateClaimApplicationPage";
import ClaimApprovalPage from "./pages/common/expense/ClaimApprovalPage";

// Master Import/Export
import ImportExportMaster from "./pages/common/master/ImportExportMaster";

// Master Pages (Admin Only)
import MasterPage from "./pages/common/master/MasterIndex";
import UsersPage from "./pages/common/master/users/Index";
import GuestHouseMaster from "./pages/common/master/guest-house/Index";
import ARCHotelMaster from "./pages/common/master/arc-hotel/Index";
import LocationSPOCMasterPage from "./pages/common/master/LocationSPOCMaster";
import SPOCAssignmentList from "./pages/common/master/SPOC-management";
import GeographyMasters from "./pages/common/master/GeographyMaster";
import CityCategoriesMaster from "./pages/common/master/CityCategoriesMaster";
import LocationMasterPage from "./pages/common/master/LocationMaster";
import OrganizationMasters from "./pages/common/master/OrganizationMaster";
import EmployeeTypeMaster from "./pages/common/master/EmployeeTypeMaster";
import GLCodeMaster from "./pages/common/master/GLCodeMaster";
import TravelModeMaster from "./pages/common/master/TravelModeMaster";
import GradeEntitlementMaster from "./pages/common/master/GradeEntitlementMaster";
import GradeMasterPage from "./pages/common/master/GradeMaster";
import ApprovalMatrixMasterPage from "./pages/common/master/ApprovalMatrixMaster";
import DAIncidentalMasterPage from "./pages/common/master/DAIncidentalsMaster";
import ConveyanceRateMasterPage from "./pages/common/master/ConveyanceRateMaster";
import ExpenseTypesMasterPage from "./pages/common/master/ExpenseTypeMaster";
import ClaimStatusMasterPage from "./pages/common/master/ClaimStatusMaster";
import BookingAgentList from "./pages/common/master/booking-agent/BookingAgentList";
import VehicleCategoryMasterPage from "./pages/common/master/VehicleCategoryMaster";
import VehicleTypeMasterPage from "./pages/common/master/VehicleTypeMaster";
import UserRoleAssignPage from "./pages/common/master/UserRoleAssigner";
import BackdatedAllowanceManager from "./pages/common/master/BackdatedAllowanceManager";

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SSOHandler } from "@/src/components/SSOHandler";
import { EditModeProvider } from "@/src/contexts/EditModeContext";

const queryClient = new QueryClient();

/**
 * Basic Auth Guard (employee/admin)
 */
function AuthOnly({ children }: { children: JSX.Element }) {
  return localStorage.getItem("access_token") ? (
    children
  ) : (
    <Navigate to={ROUTES.login} replace />
  );
}

const isAdminUser = () => {
  const roles = JSON.parse(localStorage.getItem("roles") || "[]");
  return roles.some((r: any) =>
    ["admin", "manager", "chro", "ceo"].includes(r.role_type?.toLowerCase()),
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />

      <EditModeProvider>
        <BrowserRouter>
          <SSOHandler />
          <Routes>
            {/* ---------------- UNAUTHORIZED / 404 ---------------- */}
            <Route path="/unauthorized" element={<UnauthorizedPage />} />
            <Route path="*" element={<NotFound />} />

            {/* ---------------- AUTH ---------------- */}
            <Route path="/" element={<Login />} />
            <Route path={ROUTES.login} element={<Login />} />
            <Route
              path={ROUTES.choosePortal}
              element={
                <AuthOnly>
                  <ChoosePortal />
                </AuthOnly>
              }
            />

            {/* ---------------- EMPLOYEE DASHBOARD ---------------- */}
            <Route
              path={ROUTES.employeeDashboard}
              element={
                <AuthOnly>
                  <UnifiedLayout>
                    <EmployeeIndex />
                  </UnifiedLayout>
                </AuthOnly>
              }
            />

            {/* ---------------- ADMIN DASHBOARD ---------------- */}
            <Route
              path={ROUTES.adminDashboard}
              element={
                <ProtectedRoute requiredDashboard="admin">
                  <UnifiedLayout>
                    <AdminIndex />
                  </UnifiedLayout>
                </ProtectedRoute>
              }
            />

            {/* ---------------- DESK AGENT DASHBOARD ---------------- */}
            <Route
              path={ROUTES.deskAgentDashboard}
              element={
                <ProtectedRoute requiredDashboard="travel_desk">
                  <UnifiedLayout>
                    <TravelDeskDashboard />
                  </UnifiedLayout>
                </ProtectedRoute>
              }
            />

            {/* ---------------- BOOKING AGENT DASHBOARD ---------------- */}
            <Route
              path={ROUTES.bookingAgentDashboard}
              element={
                <ProtectedRoute requiredDashboard="booking_agent">
                  <UnifiedLayout>
                    <BookingAgentDashboard />
                  </UnifiedLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path={ROUTES.pendingBookingsPage}
              element={
                <ProtectedRoute requiredDashboard="booking_agent">
                  <UnifiedLayout>
                    <BookingAgentBookings />
                  </UnifiedLayout>
                </ProtectedRoute>
              }
            />

            {/* ---------------- PROFILE ---------------- */}
            <Route
              path={ROUTES.profile}
              element={
                <AuthOnly>
                  <UnifiedLayout>
                    <Profile />
                  </UnifiedLayout>
                </AuthOnly>
              }
            />

            {/* ---------------- FINANCE PAGE ---------------- */}
            <Route
              path={ROUTES.financeActionPage}
              element={
                <AuthOnly>
                  <UnifiedLayout>
                    <FinancePage />
                  </UnifiedLayout>
                </AuthOnly>
              }
            />
            <Route
              path={ROUTES.advanceWorkspacePage}
              element={
                <AuthOnly>
                  <UnifiedLayout>
                    <AdvanceWorkspacePage />
                  </UnifiedLayout>
                </AuthOnly>
              }
            />
            <Route
              path={ROUTES.advanceRequisitionPage(":id")}
              element={
                <AuthOnly>
                  <UnifiedLayout>
                    <AdvanceRequisitionPage />
                  </UnifiedLayout>
                </AuthOnly>
              }
            />

            {/* ---------------- DUTY SLIP GENERATION ---------------- */}
            <Route
              path={ROUTES.dutySlipGeneration}
              element={
                <AuthOnly>
                  <UnifiedLayout>
                    <DutySlipGeneration />
                  </UnifiedLayout>
                </AuthOnly>
              }
            />

            {/* ---------------- TRAVEL (EMPLOYEE + ADMIN) ---------------- */}
            <Route
              path={ROUTES.makeTravelApplicationOld}
              element={
                <AuthOnly>
                  <UnifiedLayout>
                    <MakeTravelApplicationOld />
                  </UnifiedLayout>
                </AuthOnly>
              }
            />

            <Route
              path={ROUTES.makeTravelApplicationNew}
              element={
                <AuthOnly>
                  <UnifiedLayout>
                    <MakeTravelApplicationNew />
                  </UnifiedLayout>
                </AuthOnly>
              }
            />

            <Route
              path={ROUTES.travelApplicationList}
              element={
                <AuthOnly>
                  <UnifiedLayout>
                    <TravelApplicationList />
                  </UnifiedLayout>
                </AuthOnly>
              }
            />

            <Route
              path={ROUTES.travelRequestApproval}
              element={
                <AuthOnly>
                  <UnifiedLayout>
                    <TravelRequestApprovals />
                  </UnifiedLayout>
                </AuthOnly>
              }
            />

            <Route
              path={ROUTES.travelCancellationRequest}
              element={
                <AuthOnly>
                  <UnifiedLayout>
                    <TravelCancellationRequest />
                  </UnifiedLayout>
                </AuthOnly>
              }
            />

            <Route
              path={ROUTES.travelCancellationApproval}
              element={
                <AuthOnly>
                  <UnifiedLayout>
                    <TravelCancellationApproval />
                  </UnifiedLayout>
                </AuthOnly>
              }
            />

            <Route
              path={ROUTES.travelApplicationView(":id")}
              element={
                <AuthOnly>
                  <UnifiedLayout>
                    <ApplicationView />
                  </UnifiedLayout>
                </AuthOnly>
              }
            />

            <Route
              path={ROUTES.travelApplicationDetails(":id")}
              element={
                <AuthOnly>
                  <UnifiedLayout>
                    <TravelApplicationDetails />
                  </UnifiedLayout>
                </AuthOnly>
              }
            />

            <Route
              path={ROUTES.travelApplicationExport}
              element={
                <ProtectedRoute requiredDashboard="admin">
                  <UnifiedLayout>
                    <TravelApplicationExportPage />
                  </UnifiedLayout>
                </ProtectedRoute>
              }
            />

            {/* ---------------- EXPENSE (EMPLOYEE + ADMIN) ---------------- */}
            <Route
              path={ROUTES.indexExpense}
              element={
                <AuthOnly>
                  <UnifiedLayout>
                    <ExpenseIndex />
                  </UnifiedLayout>
                </AuthOnly>
              }
            />

            <Route
              path={ROUTES.indexClaimPage}
              element={
                <AuthOnly>
                  <UnifiedLayout>
                    <MyClaimsPage />
                  </UnifiedLayout>
                </AuthOnly>
              }
            />

            <Route
              path={ROUTES.claimDetailPage(":id")}
              element={
                <AuthOnly>
                  <UnifiedLayout>
                    <ClaimDetailPage />
                  </UnifiedLayout>
                </AuthOnly>
              }
            />

            <Route
              path={ROUTES.claimApplicationPage}
              element={
                <AuthOnly>
                  <UnifiedLayout>
                    <CreateClaimApplicationPage />
                  </UnifiedLayout>
                </AuthOnly>
              }
            />

            <Route
              path={ROUTES.editClaimPage(":id")}
              element={
                <AuthOnly>
                  <UnifiedLayout>
                    <CreateClaimApplicationPage />
                  </UnifiedLayout>
                </AuthOnly>
              }
            />

            <Route
              path={ROUTES.claimApprovalPage}
              element={
                <AuthOnly>
                  <UnifiedLayout>
                    <ClaimApprovalPage />
                  </UnifiedLayout>
                </AuthOnly>
              }
            />

            {/* MASTER IMPORT/EXPORT PAGES */}
            <Route
              path={ROUTES.importExport}
              element={
                <ProtectedRoute requiredDashboard="admin">
                  <UnifiedLayout>
                    <ImportExportMaster />
                  </UnifiedLayout>
                </ProtectedRoute>
              }
            />

            {/* ---------------- MASTER PAGES (ADMIN ONLY) ---------------- */}
            <Route
              path={ROUTES.master}
              element={
                <ProtectedRoute requiredDashboard="admin">
                  <UnifiedLayout>
                    <MasterPage />
                  </UnifiedLayout>
                </ProtectedRoute>
              }
            />

            {/* All other master routes */}
            <Route
              path={ROUTES.users}
              element={
                <ProtectedRoute requiredDashboard="admin">
                  <UnifiedLayout>
                    <UsersPage />
                  </UnifiedLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path={ROUTES.orgMaster}
              element={
                <ProtectedRoute requiredDashboard="admin">
                  <UnifiedLayout>
                    <OrganizationMasters />
                  </UnifiedLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path={ROUTES.employeeTypeMaster}
              element={
                <ProtectedRoute requiredDashboard="admin">
                  <UnifiedLayout>
                    <EmployeeTypeMaster />
                  </UnifiedLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path={ROUTES.geographyMaster}
              element={
                <ProtectedRoute requiredDashboard="admin">
                  <UnifiedLayout>
                    <GeographyMasters />
                  </UnifiedLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path={ROUTES.cityCategoryMaster}
              element={
                <ProtectedRoute requiredDashboard="admin">
                  <UnifiedLayout>
                    <CityCategoriesMaster />
                  </UnifiedLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path={ROUTES.locationMaster}
              element={
                <ProtectedRoute requiredDashboard="admin">
                  <UnifiedLayout>
                    <LocationMasterPage />
                  </UnifiedLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path={ROUTES.gradeMaster}
              element={
                <ProtectedRoute requiredDashboard="admin">
                  <UnifiedLayout>
                    <GradeMasterPage />
                  </UnifiedLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path={ROUTES.approvalMatrixMaster}
              element={
                <ProtectedRoute requiredDashboard="admin">
                  <UnifiedLayout>
                    <ApprovalMatrixMasterPage />
                  </UnifiedLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path={ROUTES.daIncidentalMaster}
              element={
                <ProtectedRoute requiredDashboard="admin">
                  <UnifiedLayout>
                    <DAIncidentalMasterPage />
                  </UnifiedLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path={ROUTES.conveyanceRateMaster}
              element={
                <ProtectedRoute requiredDashboard="admin">
                  <UnifiedLayout>
                    <ConveyanceRateMasterPage />
                  </UnifiedLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path={ROUTES.glCodeMaster}
              element={
                <ProtectedRoute requiredDashboard="admin">
                  <UnifiedLayout>
                    <GLCodeMaster />
                  </UnifiedLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path={ROUTES.travelModeMaster}
              element={
                <ProtectedRoute requiredDashboard="admin">
                  <UnifiedLayout>
                    <TravelModeMaster />
                  </UnifiedLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path={ROUTES.gradeEntitlementMaster}
              element={
                <ProtectedRoute requiredDashboard="admin">
                  <UnifiedLayout>
                    <GradeEntitlementMaster />
                  </UnifiedLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path={ROUTES.guestHouseMaster}
              element={
                <ProtectedRoute requiredDashboard="admin">
                  <UnifiedLayout>
                    <GuestHouseMaster />
                  </UnifiedLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path={ROUTES.arcHotelMaster}
              element={
                <ProtectedRoute requiredDashboard="admin">
                  <UnifiedLayout>
                    <ARCHotelMaster />
                  </UnifiedLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path={ROUTES.locationSPOCMaster}
              element={
                <ProtectedRoute requiredDashboard="admin">
                  <UnifiedLayout>
                    <LocationSPOCMasterPage />
                  </UnifiedLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path={ROUTES.spocAssignmentMaster}
              element={
                <ProtectedRoute requiredDashboard="admin">
                  <UnifiedLayout>
                    <SPOCAssignmentList />
                  </UnifiedLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path={ROUTES.expenseTypeMaster}
              element={
                <ProtectedRoute requiredDashboard="admin">
                  <UnifiedLayout>
                    <ExpenseTypesMasterPage />
                  </UnifiedLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path={ROUTES.claimStatusMaster}
              element={
                <ProtectedRoute requiredDashboard="admin">
                  <UnifiedLayout>
                    <ClaimStatusMasterPage />
                  </UnifiedLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path={ROUTES.bookingAgents}
              element={
                <ProtectedRoute requiredDashboard="admin">
                  <UnifiedLayout>
                    <BookingAgentList />
                  </UnifiedLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path={ROUTES.bookingAgentsFromTravelDesk}
              element={
                <ProtectedRoute requiredDashboard="travel_desk">
                  <UnifiedLayout>
                    <BookingAgentList />
                  </UnifiedLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path={ROUTES.vehicleCategoryMaster}
              element={
                <ProtectedRoute requiredDashboard="admin">
                  <UnifiedLayout>
                    <VehicleCategoryMasterPage />
                  </UnifiedLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path={ROUTES.vehicleTypeMaster}
              element={
                <ProtectedRoute requiredDashboard="admin">
                  <UnifiedLayout>
                    <VehicleTypeMasterPage />
                  </UnifiedLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path={ROUTES.userRoleAssigner}
              element={
                <ProtectedRoute requiredDashboard="admin">
                  <UnifiedLayout>
                    <UserRoleAssignPage />
                  </UnifiedLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path={ROUTES.backdatedTRAllowance}
              element={
                <ProtectedRoute requiredDashboard="admin">
                  <UnifiedLayout>
                    <BackdatedAllowanceManager />
                  </UnifiedLayout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </EditModeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

import { HelmetProvider } from "react-helmet-async";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <App />
    </LocalizationProvider>
  </HelmetProvider>,
);
