import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Clock,
  CheckCircle,
  ClipboardList,
  TrendingUp,
  RefreshCw,
  Timer,
  AlertCircle,
  CircleX,
  CircleCheckBig,
  ClockAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/pages/booking-agent/components/StatCard";
import { RecentBookingItem } from "@/pages/booking-agent/components/RecentBookingItems";
import { BookingStatsChart } from "@/pages/booking-agent/components/BookingStatsChart";
import { ViewBookingModal } from "@/pages/booking-agent/components/ViewBookingModal";
import { bookingAgentAPI, type Booking } from "@/src/api/bookingAgentAPI";
import { formatHours } from "./utils/format";
import { ROUTES } from "@/routes/routes";
import { useToast } from "@/hooks/use-toast";

const BookingAgentDashboard: React.FC = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  const {
    data: dashboardData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["booking-agent-dashboard"],
    queryFn: async () => {
      const response = await bookingAgentAPI.dashboard.get();
      console.log(response);
      return response.data;
    },
  });

  const stats = dashboardData?.stats;
  const recentBookings = dashboardData?.recent || [];

  const handleViewBooking = (booking: Booking) => {
    setSelectedBooking(booking);
    setIsViewModalOpen(true);
  };

  const handleAccept = async (booking: Booking) => {
    try {
      await bookingAgentAPI.bookings.accept(booking.id);
      toast({
        title: "Booking Accepted",
        description: "The booking has been moved to in-progress status.",
      });
      refetch();
    } catch (error) {
      toast({
        title: "Acceptance failed",
        description: "Unable to accept booking",
        variant: "destructive",
      });
    }
  };

  const handleReject = async (booking: Booking) => {
    const remarks = window.prompt("Please enter rejection remarks:");
    if (!remarks) return;

    try {
      await bookingAgentAPI.bookings.reject(booking.id, remarks);
      toast({
        title: "Booking Rejected",
        description: "The booking has been successfully rejected.",
      });
      refetch();
    } catch (error) {
      toast({
        title: "Rejection failed",
        description: "Unable to reject booking",
        variant: "destructive",
      });
    }
  };

  return (
    <div>
      <div className="space-y-8 p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-[26px] font-bold text-foreground">
              Dashboard Overview
            </h1>
            <p className="mt-1 text-lg text-muted-foreground">
              Welcome back! Here's your booking summary.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isLoading}
            className="self-start"
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 hover:bg-slate-100 hover:text-slate-600 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>

        {/* Stat Cards */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="rounded-[10px] bg-card p-6 shadow-[0_2px_2px_0_rgba(59,130,247,0.30)] animate-pulse"
              >
                <div className="flex items-center gap-4">
                  <div className="h-[70px] w-[70px] rounded-lg bg-muted" />
                  <div className="space-y-2">
                    <div className="h-4 w-20 bg-muted rounded" />
                    <div className="h-6 w-12 bg-muted rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Pending Bookings"
              value={stats.pending}
              icon={<Clock className="h-9 w-9 text-yellow-600" />}
              bgColor="bg-yellow-50"
            />
            <StatCard
              title="In Progess"
              value={stats.in_progress}
              icon={<Timer className="h-9 w-9 text-blue-600" />}
              bgColor="bg-blue-50"
            />
            <StatCard
              title="Confirmed"
              value={stats.confirmed}
              icon={<CheckCircle className="h-9 w-9 text-green-600" />}
              bgColor="bg-green-50"
            />
            <StatCard
              title="Cancelled"
              value={stats.cancelled}
              icon={<CircleX className="h-9 w-9 text-red-600" />}
              bgColor="bg-red-50"
            />
            <StatCard
              title="Total Assigned"
              value={stats.total_assigned}
              icon={<ClipboardList className="h-9 w-9 text-blue-600" />}
              bgColor="bg-blue-50"
            />
            <StatCard
              title="Overdue"
              value={stats.overdue_pending}
              icon={<AlertCircle className="h-9 w-9 text-orange-600" />}
              bgColor="bg-orange-50"
            />
            {/* <StatCard
            title="Avg Response Hours"
            value={stats.avg_response_hours ? formatHours(stats.avg_response_hours) : "—"}
            icon={<TrendingUp className="h-9 w-9 text-emerald-600" />}
            bgColor="bg-emerald-50"
          />
          <StatCard
            title="Avg Completion Hours"
            value={stats.avg_completion_hours ? formatHours(stats.avg_completion_hours) : "—"}
            icon={<CircleCheckBig className="h-9 w-9 text-emerald-600" />}
            bgColor="bg-emerald-50"
          /> */}
            <StatCard
              title="Avg Confirmation Hours"
              value={
                stats.avg_confirmation_hours
                  ? formatHours(stats.avg_confirmation_hours)
                  : "—"
              }
              icon={<ClockAlert className="h-9 w-9 text-emerald-600" />}
              bgColor="bg-emerald-50"
            />
          </div>
        ) : null}

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Recent Bookings */}
          <div className="rounded-[10px] bg-card p-6 shadow-[0_2px_2px_0_rgba(59,130,247,0.30)]">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground">
                Recent Requested Bookings
              </h2>
              <button
                className="text-base font-bold text-primary underline"
                onClick={() => navigate(ROUTES.pendingBookingsPage)}
              >
                View All
              </button>
            </div>
            <div className="space-y-1">
              {isLoading ? (
                [...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-4 py-4 animate-pulse"
                  >
                    <div className="h-12 w-12 rounded-md bg-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-24 bg-muted rounded" />
                      <div className="h-3 w-32 bg-muted rounded" />
                    </div>
                    <div className="h-6 w-16 bg-muted rounded" />
                  </div>
                ))
              ) : recentBookings.length > 0 ? (
                recentBookings.slice(0, 5).map((booking, index) => (
                  <React.Fragment key={booking.id}>
                    <RecentBookingItem
                      booking={booking}
                      bookingTypeLabel={booking.booking_type_name}
                      onClick={() => handleViewBooking(booking)}
                    />
                    {index < Math.min(recentBookings.length, 5) - 1 && (
                      <div className="h-px bg-border" />
                    )}
                  </React.Fragment>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No recent bookings found.
                </p>
              )}
            </div>
          </div>

          {/* Booking Status Distribution */}
          <div className="rounded-[10px] bg-card p-6 shadow-[0_2px_2px_0_rgba(59,130,247,0.30)]">
            <h2 className="mb-6 text-xl font-bold text-foreground">
              Status Distribution
            </h2>
            {isLoading ? (
              <div className="flex items-center justify-center h-[200px]">
                <div className="h-32 w-32 rounded-full bg-muted animate-pulse" />
              </div>
            ) : stats ? (
              <BookingStatsChart stats={stats} />
            ) : (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                <p>No data available</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* View Modal */}
      <ViewBookingModal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        booking={selectedBooking}
        onAccept={handleAccept}
        onReject={handleReject}
      />
    </div>
  );
};

export default BookingAgentDashboard;
