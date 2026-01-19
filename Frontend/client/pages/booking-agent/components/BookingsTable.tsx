import React from "react";
import { Eye, RefreshCw, MessageSquarePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
// import { StatusBadge } from './StatusBadge';
import { StatusBadge } from "@/components/StatusBadge";
import {
  formatDateTime,
  formatCurrency,
  getBookingTypeLabel,
  getSubOptionLabel,
} from "../utils/format";
import type { Booking } from "@/src/api/bookingAgentAPI";

interface BookingsTableProps {
  bookings: Booking[];
  isLoading: boolean;
  onView: (booking: Booking) => void;
  onUpdateStatus: (booking: Booking) => void;
  onAddNote: (booking: Booking) => void;
  showTravelRequestId: boolean;
  showEmployeeName: boolean;
}

const TableRowSkeleton: React.FC = () => (
  <TableRow>
    {[...Array(7)].map((_, i) => (
      <TableCell key={i}>
        <div className="h-4 bg-muted rounded animate-pulse w-full" />
      </TableCell>
    ))}
  </TableRow>
);

export const BookingsTable: React.FC<BookingsTableProps> = ({
  bookings,
  isLoading,
  onView,
  onUpdateStatus,
  onAddNote,
  showTravelRequestId,
  showEmployeeName,
}) => {
  /** ------------------------------
   *  SMART ROUTE BUILDER (All types)
   *  ------------------------------ */
  const getRoute = (booking: Booking): string => {
    if (booking.trip_segment) {
      return booking.trip_segment;
    }

    const d = booking.booking_details || {};

    // Flight / Train
    if (d.from_location_name && d.to_location_name) {
      return `${d.from_location_name} → ${d.to_location_name}`;
    }

    // Accommodation
    if (d.place) {
      return d.place;
    }

    // Conveyance strings
    if (d.from_location && d.to_location) {
      return `${d.from_location} → ${d.to_location}`;
    }

    return "—";
  };

  return (
    <div className="bg-card rounded-md border shadow-md overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Booking ID</TableHead>
              <TableHead>Route</TableHead>
              <TableHead>Booking Type</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Actual Cost</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading ? (
              [...Array(5)].map((_, i) => <TableRowSkeleton key={i} />)
            ) : bookings.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center py-10 text-muted-foreground"
                >
                  No bookings found
                </TableCell>
              </TableRow>
            ) : (
              bookings.map((booking) => {
                const isOnHold =
                  booking.travel_application_status ===
                  "cancellation_requested";
                const isCancelled =
                  booking.travel_application_status === "cancelled";

                return (
                  <TableRow
                    key={booking.id}
                    className={cn(
                      "hover:bg-muted/50 transition",
                      isOnHold && "bg-amber-50/30",
                      isCancelled && "bg-red-50/30",
                    )}
                  >
                    {/* Booking ID */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {isOnHold && (
                          <svg
                            className="h-4 w-4 text-amber-600 flex-shrink-0"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                        )}
                        {isCancelled && (
                          <svg
                            className="h-4 w-4 text-red-600 flex-shrink-0"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                        )}
                        <span className="font-mono text-sm font-medium">
                          BK-{String(booking.id).padStart(5, "0")}
                        </span>
                      </div>
                    </TableCell>

                    {/* Route */}
                    <TableCell>
                      <span
                        className="text-sm max-w-[220px] truncate block"
                        title={getRoute(booking)}
                      >
                        {getRoute(booking)}
                      </span>
                    </TableCell>

                    {/* Type + Suboption */}
                    <TableCell>
                      <p className="text-sm font-medium">
                        {booking.booking_type_name ||
                          getBookingTypeLabel(booking.booking_type)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {booking.sub_option_name ||
                          getSubOptionLabel(booking.sub_option)}
                      </p>
                    </TableCell>

                    {/* Status */}
                    <TableCell className="text-center">
                      {/* <StatusBadge status={booking.status} /> */}
                      <StatusBadge
                        statusType="booking"
                        status={booking.status}
                      />
                    </TableCell>

                    {/* Actual Cost */}
                    <TableCell className="text-right">
                      <span className="text-sm font-medium">
                        {formatCurrency(booking.actual_cost)}
                      </span>
                    </TableCell>

                    {/* Actions */}
                    <TableCell>
                      <div className="flex justify-center gap-2">
                        {/* View Button */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 bg-blue-100 hover:bg-blue-200 text-blue-600 hover:text-blue-600"
                              onClick={() => onView(booking)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>View Details</TooltipContent>
                        </Tooltip>

                        {/* Update Status */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 bg-green-100 hover:bg-green-200 text-green-600 hover:text-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={() => onUpdateStatus(booking)}
                                disabled={isOnHold || isCancelled}
                              >
                                <RefreshCw className="w-4 h-4" />
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {isOnHold
                              ? "Actions disabled - Cancellation pending"
                              : isCancelled
                                ? "Actions disabled - Application cancelled"
                                : "Update Status"}
                          </TooltipContent>
                        </Tooltip>

                        {/* Add Note */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 bg-yellow-100 hover:bg-yellow-200 text-yellow-600 hover:text-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              onClick={() => onAddNote(booking)}
                              disabled={isCancelled}
                            >
                              <MessageSquarePlus className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {isCancelled
                              ? "Actions disabled - Application cancelled"
                              : "Add Note"}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
