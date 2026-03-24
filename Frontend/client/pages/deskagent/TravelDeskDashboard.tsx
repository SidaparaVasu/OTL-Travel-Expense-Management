import React, { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Briefcase, Share2 } from "lucide-react";
import {
  KPICards,
  SearchFilterBar,
  ApplicationsTable,
  PaginationControls,
  ApplicationDrawer,
  CancelModal,
  ForwardModal,
  DashboardTabs,
} from "./components/";
import { travelDeskAPI } from "@/src/api/travel-desk";
import type {
  DashboardStats,
  DashboardApplication,
  Pagination,
  BookingAgent,
  RecommendedAgentsResponse,
} from "@/src/types/travel-desk.types";

const TravelDeskDashboard: React.FC = () => {
  // State
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [applications, setApplications] = useState<DashboardApplication[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [agents, setAgents] = useState<BookingAgent[]>([]);

  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("urgency");
  const [statusFilter, setStatusFilter] = useState("pending_travel_desk");
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [activeForwardedIds, setActiveForwardedIds] = useState<
    number[] | undefined
  >(undefined);
  const [activeTab, setActiveTab] = useState("my_requests");
  const [locationFilter, setLocationFilter] = useState("all");
  const [assignedLocations, setAssignedLocations] = useState<string[]>([]);
  const [isGlobalSearch, setIsGlobalSearch] = useState(false);

  // Fetch assigned locations
  const fetchLocations = useCallback(async () => {
    try {
      const response = await travelDeskAPI.locations.list();
      if (response.success && response.data) {
        setAssignedLocations(response.data.map((l: any) => l.name));
      } else if (Array.isArray(response)) {
        setAssignedLocations(response.map((l: any) => l.name));
      }
    } catch (err) {
      console.error("Failed to fetch locations:", err);
    }
  }, []);

  // Modal/Drawer states
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedApplicationId, setSelectedApplicationId] = useState<
    number | null
  >(null);
  const [forwardModalOpen, setForwardModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] =
    useState<DashboardApplication | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch dashboard data
  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const response = await travelDeskAPI.dashboard.get();

      if (response.success) {
        setStats(response.data.stats);
        // setApplications(response.data.recent_applications);
      }
    } catch (err: any) {
      console.error("Failed to fetch dashboard:", err);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search query logic
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);
  
  useEffect(() => {
    // Trigger update only if query is empty (reset) or at least 2 chars
    if (searchQuery.length > 0 && searchQuery.length < 2) return;

    // Use shorter delay for clearing results to make UI feel snappier
    const delay = searchQuery.length === 0 ? 0 : 500;

    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      // Reset to page 1 when search changes to ensure we see the first results
      setCurrentPage(1);
    }, delay);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch applications
  const fetchApplications = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoading(true);

      const response = await travelDeskAPI.applications.list(
        {
          page: currentPage,
          status: statusFilter,
          search: debouncedSearchQuery,
          is_global: isGlobalSearch,
        },
        { signal },
      );

      if (response.success) {
        setApplications(response.data);
        setPagination(response.meta?.pagination || null);
      }
    } catch (err: any) {
      // Ignore abort errors as they are intentional
      if (err.name === "CanceledError" || err.name === "AbortError") return;
      console.error("Failed to fetch applications:", err);
      toast.error("Failed to load applications");
    } finally {
      // Only stop loading if the component is still mounted and it's not a cancelled request
      // (in a real scenario we'd check if this was the latest request, 
      // but AbortController + state updates is generally safe for simple dashboards)
      setLoading(false);
    }
  }, [currentPage, statusFilter, debouncedSearchQuery, isGlobalSearch]);

  // Fetch agents for dropdowns
  const fetchAgents = useCallback(async () => {
    try {
      const response = await travelDeskAPI.agents.list();
      setAgents(response.data || []);
    } catch (err) {
      // Silently fail - agents list may not be available
      setAgents([]);
    }
  }, []);

  // Application Data Fetching (Triggers on filter/page changes)
  useEffect(() => {
    const controller = new AbortController();
    fetchApplications(controller.signal);
    return () => controller.abort();
  }, [fetchApplications]);

  // Metadata/Initial load
  useEffect(() => {
    fetchDashboard();
    fetchLocations();
    fetchAgents();
  }, [fetchDashboard, fetchAgents, fetchLocations]);

  // Filter and sort applications
  const getFilteredApplications = useCallback(() => {
    let filtered = [...applications];

    // Tab Filter — skip for terminal statuses (booked/completed have no actionable bookings by design)
    // ALSO SKIP if global search is active
    const isTerminalStatus =
      statusFilter === "booked" || statusFilter === "completed";

    if (!isTerminalStatus && !isGlobalSearch) {
      if (activeTab === "my_requests") {
        filtered = filtered.filter(
          (app) =>
            app.actionable_booking_ids && app.actionable_booking_ids.length > 0,
        );
      } else if (activeTab === "forwarded") {
        filtered = filtered.filter(
          (app) =>
            (!app.actionable_booking_ids ||
              app.actionable_booking_ids.length === 0) &&
            app.delegated_booking_ids &&
            app.delegated_booking_ids.length > 0,
        );
      }
    }

    // Location Filter - skip if global search is active
    if (locationFilter && locationFilter !== "all" && !isGlobalSearch) {
      filtered = filtered.filter(
        (app) => app.employee_location === locationFilter,
      );
    }

    // Search filter - Skip CLIENT-SIDE re-filter if it's already filtered by backend
    // This allows backend-only logic (like regex/ID matching) to work correctly
    // If not global, we might still want local quick filter, but for now let's trust backend
    // if (searchQuery) { ... }

    // Note: status filtering is already done by the API via the statusFilter param.
    // No client-side re-filter needed here.

    // Sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "urgency":
          // Sort by departure date ascending (most urgent first)
          return (
            new Date(a.departure_date).getTime() -
            new Date(b.departure_date).getTime()
          );
        case "date_asc":
          return (
            new Date(a.departure_date).getTime() -
            new Date(b.departure_date).getTime()
          );
        case "date_desc":
          return (
            new Date(b.departure_date).getTime() -
            new Date(a.departure_date).getTime()
          );
        case "submitted_asc":
          return (
            new Date(a.submitted_at).getTime() -
            new Date(b.submitted_at).getTime()
          );
        case "submitted_desc":
          return (
            new Date(b.submitted_at).getTime() -
            new Date(a.submitted_at).getTime()
          );
        default:
          return 0;
      }
    });

    return filtered;
  }, [
    applications,
    searchQuery,
    statusFilter,
    sortBy,
    activeTab,
    locationFilter,
    isGlobalSearch,
  ]);

  // Handlers
  const handleView = (app: DashboardApplication) => {
    setSelectedApplicationId(app.id);
    setActiveForwardedIds(app.delegated_booking_ids);
    setDrawerOpen(true);
  };

  const handleCancel = (app: DashboardApplication) => {
    setSelectedApplication(app);
    setCancelModalOpen(true);
    fetchApplications();
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // const confirmForward = async (agentId: number, note: string) => {
  //   if (!selectedApplication) return;

  //   setActionLoading(true);

  //   try {
  //     await travelDeskAPI.applications.forward(selectedApplication.id, {
  //       agent_id: agentId,
  //     });

  //     toast.success('Application forwarded successfully');
  //     setForwardModalOpen(false);
  //     setSelectedApplication(null);
  //     fetchDashboard();
  //   } catch (err: any) {
  //     toast.error(err.message || 'Failed to forward application');
  //   } finally {
  //     setActionLoading(false);
  //   }
  // };

  const confirmForward = async (
    assignments: { agent_id: number; booking_ids: number[] }[],
    note: string,
  ) => {
    if (!selectedApplication) return;

    setActionLoading(true);

    try {
      for (const item of assignments) {
        await travelDeskAPI.bookings.assign({
          booking_ids: item.booking_ids,
          booking_agent_id: item.agent_id,
          scope: "single_booking",
          note,
        });
      }

      toast.success("Bookings forwarded successfully");
      setForwardModalOpen(false);
      setSelectedApplication(null);
      fetchApplications();
      fetchDashboard();
    } catch (err: any) {
      toast.error(err.message || "Failed to forward bookings");
    } finally {
      setActionLoading(false);
    }
  };

  const confirmCancel = async (reason: string) => {
    if (!selectedApplication) return;

    setActionLoading(true);

    try {
      await travelDeskAPI.applications.cancel(selectedApplication.id, {
        reason,
      });

      toast.success("Application cancelled successfully");
      setCancelModalOpen(false);
      setSelectedApplication(null);
      fetchDashboard();
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel application");
    } finally {
      setActionLoading(false);
    }
  };

  const filteredApplications = getFilteredApplications();

  return (
    <div className="min-h-screen">
      <div className="space-y-6">
        {/* KPI Cards */}
        <KPICards stats={stats} isLoading={loading} />

        <div>
          <DashboardTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            tabs={[
              {
                id: "my_requests",
                label: "Action Required",
                icon: Briefcase,
                count: applications.filter(
                  (app) =>
                    app.actionable_booking_ids &&
                    app.actionable_booking_ids.length > 0,
                ).length,
              },
              {
                id: "forwarded",
                label: "Forwarded Out / Delegated",
                icon: Share2,
                count: applications.filter(
                  (app) =>
                    (!app.actionable_booking_ids ||
                      app.actionable_booking_ids.length === 0) &&
                    app.delegated_booking_ids &&
                    app.delegated_booking_ids.length > 0,
                ).length,
              },
            ]}
          />

          {/* Search & Filters */}
          <SearchFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            isGlobalSearch={isGlobalSearch}
            onGlobalSearchChange={setIsGlobalSearch}
            sortBy={sortBy}
            onSortChange={setSortBy}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            locationFilter={locationFilter} // Ensure these are defined in state if not already
            onLocationFilterChange={setLocationFilter}
            locations={assignedLocations}
          />
        </div>

        {/* Applications Table */}
        <ApplicationsTable
          applications={filteredApplications}
          isLoading={loading}
          expandedRow={expandedRow}
          onExpandRow={setExpandedRow}
          onView={handleView}
          // onForward={handleForward}
          onCancel={handleCancel}
        />

        {/* Pagination */}
        {pagination && (
          <PaginationControls
            pagination={pagination}
            onPageChange={handlePageChange}
          />
        )}
      </div>

      {/* Application Drawer */}
      <ApplicationDrawer
        isOpen={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedApplicationId(null);
          setActiveForwardedIds(undefined);
        }}
        applicationId={selectedApplicationId}
        forwardedBookingIds={activeForwardedIds}
        onRefresh={fetchDashboard}
      />

      {/* Forward Application Modal */}
      {/* Removed */}

      {/* Cancel Application Modal */}
      {/* <CancelModal
        isOpen={cancelModalOpen}
        onClose={() => {
          setCancelModalOpen(false);
          setSelectedApplication(null);
        }}
        onConfirm={confirmCancel}
        applicationId={selectedApplication?.id || null}
        isLoading={actionLoading}
      /> */}
    </div>
  );
};

export default TravelDeskDashboard;
