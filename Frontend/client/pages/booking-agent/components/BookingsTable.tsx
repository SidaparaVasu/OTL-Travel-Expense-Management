import React from 'react';
import { Eye, RefreshCw, MessageSquarePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
// import { StatusBadge } from './StatusBadge';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDateTime, formatCurrency, getBookingTypeLabel, getSubOptionLabel } from '../utils/format';
import type { Booking } from '@/src/api/bookingAgentAPI';

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
              <TableHead>Type</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Estimated Cost</TableHead>
              {/* <TableHead>Created</TableHead> */}
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading ? (
              [...Array(5)].map((_, i) => <TableRowSkeleton key={i} />)
            ) : bookings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                  No bookings found
                </TableCell>
              </TableRow>
            ) : (
              bookings.map((booking) => (
                <TableRow key={booking.id} className="hover:bg-muted/50 transition">

                  {/* Booking ID */}
                  <TableCell>
                    <span className="font-mono text-sm font-medium">
                      BK-{String(booking.id).padStart(5, '0')}
                    </span>
                  </TableCell>

                  {/* Route */}
                  <TableCell>
                    <span className="text-sm max-w-[220px] truncate block" title={getRoute(booking)}>
                      {getRoute(booking)}
                    </span>
                  </TableCell>

                  {/* Type + Suboption */}
                  <TableCell>
                    <p className="text-sm font-medium">
                      {booking.booking_type_name || getBookingTypeLabel(booking.booking_type)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {booking.sub_option_name || getSubOptionLabel(booking.sub_option)}
                    </p>
                  </TableCell>

                  {/* Status */}
                  <TableCell className="text-center">
                    {/* <StatusBadge status={booking.status} /> */}
                    <StatusBadge statusType="booking" status={booking.status} />
                  </TableCell>

                  {/* Estimated Cost */}
                  <TableCell className="text-right">
                    <span className="text-sm font-medium">
                      {formatCurrency(booking.estimated_cost)}
                    </span>
                  </TableCell>

                  {/* Created Date */}
                  {/* <TableCell>
                    <span className="text-sm">
                      {formatDateTime(booking.created_at)}
                    </span>
                  </TableCell> */}

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
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 bg-green-100 hover:bg-green-200 text-green-600 hover:text-green-600"
                            onClick={() => onUpdateStatus(booking)}
                          >
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Update Status</TooltipContent>
                      </Tooltip>

                      {/* Add Note */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 bg-yellow-100 hover:bg-yellow-200 text-yellow-600 hover:text-yellow-700"
                            onClick={() => onAddNote(booking)}
                          >
                            <MessageSquarePlus className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Add Note</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>

        </Table>
      </div>
    </div>
  );
};
