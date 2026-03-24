import React from "react";
import { Eye, Send, XCircle, ChevronDown } from "lucide-react";
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
import { StatusBadge } from "@/components/StatusBadge";
import { formatFullDate, formatCurrency } from "../utils/format";

const TableRowSkeleton = () => (
  <TableRow>
    {[...Array(8)].map((_, i) => (
      <TableCell key={i}>
        <div className="h-4 bg-muted rounded animate-pulse w-full" />
      </TableCell>
    ))}
  </TableRow>
);

const getBookingProgress = (bookings: any[]) => {
  const total = bookings.length;
  const completed = bookings.filter((b) => b.status === "completed").length;
  return { total, completed };
};

export const ApplicationsTable = ({
  applications,
  isLoading,
  expandedRow,
  onExpandRow,
  onView,
  // onForward,
  onCancel,
}) => {
  return (
    <div className="bg-white rounded-md border shadow-[0_2px_2px_0_rgba(59,130,247,0.30)] overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-white text-blue-500 whitespace-nowrap">
              <TableHead className="text-blue-500">Travel Request ID & Purpose</TableHead>
              <TableHead className="text-blue-500">Employee & Route</TableHead>
              <TableHead className="text-blue-500">Departure</TableHead>
              <TableHead className="text-center text-blue-500">TR Lifecycle</TableHead>
              <TableHead className="text-center text-blue-500">Bookings</TableHead>
              <TableHead className="text-center text-blue-500 ">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading ? (
              [...Array(5)].map((_, i) => <TableRowSkeleton key={i} />)
            ) : applications.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center py-10 text-muted-foreground"
                >
                  No applications found
                </TableCell>
              </TableRow>
            ) : (
              applications.map((app) => (
                <React.Fragment key={app.id}>
                  <TableRow className="hover:bg-muted/50 transition whitespace-nowrap">
                    <TableCell>
                      <div className="flex flex-col">
                        <p className="text-sm font-semibold">
                          {app.travel_request_id ||
                            `TR/TSF/2025/${String(app.id).padStart(7, "0")}`}
                        </p>
                        <p className="text-sm truncate max-w-[300px]">{app.purpose}</p>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-col">
                        <p className="font-medium">{app.employee_name}</p>
                        <div className="text-sm">
                          <p>
                            {app.from_location}
                            <span className="mx-2 text-muted-foreground">→</span>
                            {app.to_location}
                          </p>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <span className="text-sm">
                        {formatFullDate(app.departure_date)}
                      </span>
                    </TableCell>

                    <TableCell className="text-center">
                      <StatusBadge statusType="travel" status={app.status} />
                    </TableCell>

                    <TableCell className="text-center">
                      <div className="flex flex-row items-center gap-1">
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 text-sm font-semibold">
                          {app.booked_bookings} / {app.total_bookings}
                        </span>
                        <span
                          className={`text-[11px] ${
                            app.pending_bookings > 0
                              ? "text-blue-400"
                              : "text-muted-foreground"
                          }`}
                        >
                          Completed
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="text-center">
                      <div className="flex justify-center gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="bg-blue-100 hover:bg-blue-100 text-blue-600 hover:text-blue-600"
                              onClick={() => onView(app)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>View</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>

                  {expandedRow === app.id && (
                    <TableRow>
                      <TableCell colSpan={8} className="bg-muted/30 p-4">
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {app.trip_details?.[0]?.bookings?.map((booking) => (
                              <div
                                key={booking.id}
                                className="bg-white p-4 rounded-xl border shadow-sm hover:shadow-md transition"
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <p className="font-medium text-sm">
                                      {booking.booking_type_name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {booking.sub_option_name}
                                    </p>
                                  </div>

                                  <p className="text-sm font-semibold">
                                    ₹
                                    {parseFloat(
                                      booking.estimated_cost,
                                    ).toLocaleString()}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
