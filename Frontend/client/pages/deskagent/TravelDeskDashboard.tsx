import React, { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Briefcase, Share2 } from "lucide-react";
import { ROUTES } from "@/routes/routes";
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
  const [statusFilter, setStatusFilter] = useState("all");
  const [bookingActionStatus, setBookingActionStatus] = useState("pending");
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [activeForwardedIds, setActiveForwardedIds] = useState<
    number[] | undefined
  >(undefined);
  const [activeTab, setActiveTab] = useState("my_requests");
  const [locationFilter, setLocationFilter] = useState("all");
  const [assignedLocations, setAssignedLocations] = useState<string[]>([]);
  const [isGlobalSearch, setIsGlobalSearch] = useState(false);
  const [isReadonlyGlobal, setIsReadonlyGlobal] = useState(false);

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
          booking_action_status: bookingActionStatus === "all" ? undefined : bookingActionStatus,
          search: debouncedSearchQuery,
          is_global: isReadonlyGlobal ? undefined : isGlobalSearch,
          is_readonly_global: isReadonlyGlobal ? true : undefined,
          tab: (isGlobalSearch || isReadonlyGlobal) ? undefined : activeTab,
          location: (isGlobalSearch || isReadonlyGlobal) ? undefined : locationFilter,
          sort_by: sortBy,
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
      setLoading(false);
    }
  }, [currentPage, statusFilter, bookingActionStatus, debouncedSearchQuery, isGlobalSearch, isReadonlyGlobal, activeTab, locationFilter, sortBy]);

  // Reset to page 1 when tab, location, or sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, locationFilter, sortBy]);

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

  // Handlers
  const handleView = (app: DashboardApplication) => {
    if (isReadonlyGlobal) {
      // Read-only mode: open full details page in a new tab (no action buttons)
      window.open(ROUTES.travelApplicationDetails(app.id), "_blank");
      return;
    }
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

  const filteredApplications = applications;

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
              },
              {
                id: "forwarded",
                label: "Forwarded Out / Delegated",
                icon: Share2,
              },
            ]}
          />

          {/* Search & Filters */}
          <SearchFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            isGlobalSearch={isGlobalSearch}
            onGlobalSearchChange={(val: boolean) => {
              setIsGlobalSearch(val);
              if (val) setIsReadonlyGlobal(false);
            }}
            isReadonlyGlobal={isReadonlyGlobal}
            onReadonlyGlobalChange={(val: boolean) => {
              setIsReadonlyGlobal(val);
              if (val) setIsGlobalSearch(false);
            }}
            sortBy={sortBy}
            onSortChange={setSortBy}
            // statusFilter={statusFilter}
            // onStatusFilterChange={setStatusFilter}
            bookingActionStatus={bookingActionStatus}
            onBookingActionStatusChange={setBookingActionStatus}
            locationFilter={locationFilter}
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
