import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  KPICards,
  SearchFilterBar,
  ApplicationsTable,
  PaginationControls,
  ApplicationDrawer,
  CancelModal,
  ForwardModal,
} from './components/';
import { travelDeskAPI } from '@/src/api/travel-desk';
import type {
  DashboardStats,
  DashboardApplication,
  Pagination,
  BookingAgent,
  RecommendedAgentsResponse,
} from '@/src/types/travel-desk.types';

const TravelDeskDashboard: React.FC = () => {
  // State
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [applications, setApplications] = useState<DashboardApplication[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [agents, setAgents] = useState<BookingAgent[]>([]);

  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('urgency');
  const [statusFilter, setStatusFilter] = useState('pending_travel_desk');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [activeForwardedIds, setActiveForwardedIds] = useState<
    number[] | undefined
  >(undefined);

  // Modal/Drawer states
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedApplicationId, setSelectedApplicationId] = useState<number | null>(null);
  const [forwardModalOpen, setForwardModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<DashboardApplication | null>(null);
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
      console.error('Failed to fetch dashboard:', err);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch applications
  const fetchApplications = useCallback(async () => {
    try {
      setLoading(true);

      const response = await travelDeskAPI.applications.list({
        page: currentPage,
        status: statusFilter,
        search: searchQuery,
      });

      if (response.success) {
        setApplications(response.data);
        setPagination(response.meta?.pagination || null);
      }
    } catch (err) {
      console.error('Failed to fetch applications:', err);
      toast.error('Failed to load applications');
    } finally {
      setLoading(false);
    }
  }, [currentPage, statusFilter, searchQuery]);

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

  // Initial load
  useEffect(() => {
    fetchDashboard();
    fetchApplications();
    fetchAgents();
  }, [fetchDashboard, fetchApplications, fetchAgents]);

  // Filter and sort applications
  const getFilteredApplications = useCallback(() => {
    let filtered = [...applications];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(app =>
          app.employee_name.toLowerCase().includes(query) ||
        `TSF-TR-2025-${String(app.id).padStart(6, '0')}`.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(app => app.status === statusFilter);
    }

    // Sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'urgency':
          // Sort by departure date ascending (most urgent first)
          return new Date(a.departure_date).getTime() - new Date(b.departure_date).getTime();
        case 'date_asc':
          return new Date(a.departure_date).getTime() - new Date(b.departure_date).getTime();
        case 'date_desc':
          return new Date(b.departure_date).getTime() - new Date(a.departure_date).getTime();
        case 'submitted_asc':
          return new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime();
        case 'submitted_desc':
          return new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime();
        default:
          return 0;
      }
    });

    return filtered;
  }, [applications, searchQuery, statusFilter, sortBy]);

  // Handlers
  const handleView = (app: DashboardApplication) => {
    setSelectedApplicationId(app.id);
    setActiveForwardedIds(app.forwarded_booking_ids);
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
      await travelDeskAPI.applications.cancel(selectedApplication.id, { reason });

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

        {/* Search & Filters */}
        <SearchFilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          sortBy={sortBy}
          onSortChange={setSortBy}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
        />

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
