import { Routes, Route } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";

// Employee pages
import EmployeeDashboard from "../pages/employee/Dashboard";
import TravelApplication from "../pages/employee/TravelApplication";
// Admin pages
import AdminDashboard from "../pages/admin/Index";
// import ManageUsers from "../pages/admin/ManageUsers"; // example
import TravelRequestApprovals from "../pages/common/travel/TravelRequestApprovals";
import MyApplicationsPage from "../pages/common/travel/ApplicationView";
// Manager pages
// import ManagerDashboard from "../pages/manager/Dashboard";
// import Approvals from "../pages/manager/Approvals";

// Agent (unified)
// import AgentDashboard from "../pages/agent/Dashboard";
// import AgentRequestList from "../pages/agent/RequestList";
// import AgentRequestDetail from "../pages/agent/RequestDetail";

// Common
import Login from "../pages/common/Login";
import NotFound from "../pages/common/NotFound";
import Profile from "../pages/common/Profile";

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Login />} />
      <Route path="/login" element={<Login />} />
      <Route path="/profile" element={<Profile />} />
      {/* <Route path="/my-applications" element={<MyApplicationsPage />} /> */}

      {/* Employee Routes */}
      <Route element={<ProtectedRoute role={["employee"]} />}>
        <Route path="/employee/dashboard" element={<EmployeeDashboard />} />
        <Route path="/employee/travel-application" element={<TravelApplication />} />
        {/* <Route path="/my-applications" element={<MyApplicationsPage />} /> */}
      </Route>

      {/* Admin Routes */}
      <Route element={<ProtectedRoute role={["admin"]} />}>
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/profile" element={<Profile />} />
        {/* <Route path="/admin/manage-users" element={<ManageUsers />} /> */}
        <Route path="/admin/travel-approvals" element={<TravelRequestApprovals />} />
        <Route path="/my-applications" element={<MyApplicationsPage />} />
      </Route>

      {/* Manager Routes */}
      {/* <Route element={<ProtectedRoute roles={["manager"]} />}>
        <Route path="/manager/dashboard" element={<ManagerDashboard />} />
        <Route path="/manager/approvals" element={<Approvals />} />
      </Route> */}

      {/* Unified Agent Routes */}
      {/* <Route element={<ProtectedRoute roles={["agent"]} />}>
        <Route path="/agent/dashboard" element={<AgentDashboard />} />
        <Route path="/agent/requests" element={<AgentRequestList />} />
        <Route path="/agent/requests/:id" element={<AgentRequestDetail />} />
      </Route> */}

      {/* Catch-all */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
