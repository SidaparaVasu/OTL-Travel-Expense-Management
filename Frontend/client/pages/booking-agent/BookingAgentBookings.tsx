import React, { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, RefreshCw, CalendarIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookingsTable } from "@/pages/booking-agent/components/BookingsTable";
import { PaginationControls } from "@/pages/booking-agent/components/PaginationControls";
import { StatusFilter } from "@/pages/booking-agent/components/StatusFilter";
import { ViewBookingModal } from "@/pages/booking-agent/components/ViewBookingModal";
import { UpdateStatusModal } from "@/pages/booking-agent/components/UpdateStatusModal";
import { AddNoteModal } from "@/pages/booking-agent/components/AddNoteModal";
import {
  bookingAgentAPI,
  type Booking,
  type BookingsListParams,
} from "@/src/api/bookingAgentAPI";
import { useDebouncedCallback } from "./hooks/useDebouncedCallback";
import { useToast } from "@/hooks/use-toast";
import { travelAPI } from "@/src/api/travel-api";

const BookingAgentBookings: React.FC = () => {
  const { toast } = useToast();
  const [filters, setFilters] = useState<BookingsListParams>({
    page: 1,
    status: "requested",
    search: "",
    date_from: "",
    date_to: "",
  });
  const [searchInput, setSearchInput] = useState("");
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);

  // Debounced search
  const debouncedSearch = useDebouncedCallback((value: string) => {
    setFilters((prev) => ({ ...prev, search: value, page: 1 }));
  }, 300);

  // Fetch bookings list
  const {
    data: bookingsData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["booking-agent-bookings", filters],
    queryFn: async () => {
      const response = await bookingAgentAPI.bookings.list(filters);
      console.log("response", response);
      return {
        bookings: response.data,
        pagination: response.meta?.pagination ?? null,
      };
    },
  });

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);
    debouncedSearch(value);
  };

  const handleStatusChange = (status: string) => {
    setFilters((prev) => ({
      ...prev,
      status: status as BookingsListParams["status"],
      page: 1,
    }));
  };

  const handleDateFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters((prev) => ({ ...prev, date_from: e.target.value, page: 1 }));
  };

  const handleDateToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters((prev) => ({ ...prev, date_to: e.target.value, page: 1 }));
  };

  const handleClearDates = () => {
    setFilters((prev) => ({ ...prev, date_from: "", date_to: "", page: 1 }));
  };

  const handlePageChange = (page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  };
  const handleView = (booking: Booking) => {
    setSelectedBooking(booking);
    setIsViewModalOpen(true);
  };

  const handleUpdateStatus = async (booking: Booking) => {
    const { data } = await bookingAgentAPI.bookings.get(booking.id);
    setSelectedBooking(data);
    setIsStatusModalOpen(true);
  };

  const handleAddNote = (booking: Booking) => {
    setSelectedBooking(booking);
    setIsNoteModalOpen(true);
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

  const handleDownloadPDF = async (booking: Booking) => {
    if (!booking.application_id) {
      toast({
        title: "Download failed",
        description: "No travel application ID available for this booking.",
        variant: "destructive",
      });
      return;
    }

    try {
      toast({
        title: "Generating PDF",
        description: "Please wait while the travel report PDF is being generated...",
      });

      const blob = await travelAPI.downloadTravelApplicationReport(
        booking.application_id
      );

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Travel_Request_${booking.travel_request_id || booking.application_id}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      toast({
        title: "Download complete",
        description: "Travel report PDF downloaded successfully.",
      });
    } catch (error: any) {
      console.error("Failed to download PDF report:", error);
      const msg = error.response?.data?.detail || error.message || "Failed to download report";
      toast({
        title: "Download failed",
        description: msg,
        variant: "destructive",
      });
    }
  };

  const handleSuccess = () => {
    refetch();
  };

  return (
    <div>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">My Bookings</h1>
            <p className="text-muted-foreground">
              View and manage all assigned bookings
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isLoading}
            className="self-start"
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <Card className="shadow-[0_2px_2px_0_rgba(59,130,247,0.30)]">
          <CardContent className="pt-6">
            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
              {/* Search */}
              <div className="col-2 relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by TR ID, Employee, Purpose..."
                  value={searchInput}
                  onChange={handleSearchChange}
                  className="pl-9"
                />
              </div>

              {/* Date Range Filter */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="items-center">
                  <Input
                    type="date"
                    value={filters.date_from || ""}
                    onChange={handleDateFromChange}
                    title="Start date from"
                  />
                </div>
                <span className="text-muted-foreground text-sm">to</span>
                <div className="items-center">
                  <Input
                    type="date"
                    value={filters.date_to || ""}
                    onChange={handleDateToChange}
                    min={filters.date_from || undefined}
                    title="Start date to"
                  />
                </div>
                {(filters.date_from || filters.date_to) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearDates}
                    className="h-9 px-2 text-muted-foreground hover:text-slate-100"
                    title="Clear date filter"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>

              {/* Status Filter */}
              <StatusFilter
                value={filters.status || ""}
                onChange={handleStatusChange}
              />
            </div>
          </CardContent>
        </Card>

        {/* Bookings Table */}
        <Card className="shadow-[0_2px_2px_0_rgba(59,130,247,0.30)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold">
              Bookings:
              {bookingsData?.pagination?.count !== undefined && (
                <span className="ml-2 text-lg font-bold text-blue-600">
                  {bookingsData.pagination.count}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <BookingsTable
              bookings={bookingsData?.bookings || []}
              isLoading={isLoading}
              onView={handleView}
              onUpdateStatus={handleUpdateStatus}
              onAccept={handleAccept}
              onReject={handleReject}
              onAddNote={handleAddNote}
              onDownloadPDF={handleDownloadPDF}
              showTravelRequestId={true}
              showEmployeeName={true}
            />

            {/* Pagination */}
            <PaginationControls
              pagination={bookingsData?.pagination || null}
              onPageChange={handlePageChange}
            />
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      <ViewBookingModal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        booking={selectedBooking}
        onAccept={handleAccept}
        onReject={handleReject}
      />

      <UpdateStatusModal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        booking={selectedBooking}
        onSuccess={handleSuccess}
      />

      <AddNoteModal
        isOpen={isNoteModalOpen}
        onClose={() => setIsNoteModalOpen(false)}
        booking={selectedBooking}
        onSuccess={handleSuccess}
      />
    </div>
  );
};

export default BookingAgentBookings;
