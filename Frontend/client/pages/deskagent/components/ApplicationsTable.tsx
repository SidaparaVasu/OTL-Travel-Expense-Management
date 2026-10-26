import React from "react";
import { Eye, Mail, MailCheck, ChevronDown } from "lucide-react";
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
import { cn } from "@/lib/utils";

const TableRowSkeleton = () => (
  <TableRow>
    {[...Array(7)].map((_, i) => (
      <TableCell key={i}>
        <div className="h-4 bg-muted rounded animate-pulse w-full" />
      </TableCell>
    ))}
  </TableRow>
);

export const ApplicationsTable = ({
  applications,
  isLoading,
  expandedRow,
  onExpandRow,
  onView,
  onCancel,
  onToggleRead,
}: any) => {
  return (
    <div className="bg-white rounded-md border shadow-[0_2px_2px_0_rgba(59,130,247,0.30)] overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-white text-blue-500 whitespace-nowrap">
              <TableHead className="w-6 px-3"></TableHead>
              <TableHead className="text-blue-500">Travel Request ID & Purpose</TableHead>
              <TableHead className="text-blue-500">Employee & Route</TableHead>
              <TableHead className="text-blue-500">Departure</TableHead>
              <TableHead className="text-center text-blue-500">Action Status</TableHead>
              <TableHead className="text-center text-blue-500">Bookings</TableHead>
              <TableHead className="text-center text-blue-500">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading ? (
              [...Array(5)].map((_, i) => <TableRowSkeleton key={i} />)
            ) : applications.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center py-10 text-muted-foreground"
                >
                  No applications found
                </TableCell>
              </TableRow>
            ) : (
              applications.map((app: any) => {
                const isUnread = !app.is_read;

                return (
                  <React.Fragment key={app.id}>
                    <TableRow
                      className={cn(
                        "hover:bg-muted/50 transition whitespace-nowrap",
                        isUnread && "bg-blue-50/20 font-medium"
                      )}
                    >
                      {/* Unread Indicator Dot */}
                      <TableCell className="w-6 px-3 text-center">
                        {isUnread ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-600 ring-2 ring-blue-100" />
                            </TooltipTrigger>
                            <TooltipContent>Unread application</TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="inline-block h-2.5 w-2.5" />
                        )}
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <p
                              className={cn(
                                "text-sm",
                                isUnread
                                  ? "font-bold text-slate-900"
                                  : "font-semibold text-slate-800"
                              )}
                            >
                              {app.travel_request_id ||
                                `TR/TSF/2025/${String(app.id).padStart(7, "0")}`}
                            </p>
                            {isUnread && (
                              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-blue-100 text-blue-700 rounded">
                                UNREAD
                              </span>
                            )}
                          </div>
                          <p className="text-sm truncate max-w-[300px] text-slate-600">
                            {app.purpose}
                          </p>
                          {/* IO Number, GL Code, Sanction Number Tag display */}
                          {(app.internal_order || app.gl_code || app.sanction_number) && (
                            <div className="flex items-center gap-1.5 flex-wrap mt-1">
                              {app.internal_order && (
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                  IO: {app.internal_order}
                                </span>
                              )}
                              {app.gl_code && (
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                  GL: {app.gl_code}
                                </span>
                              )}
                              {app.sanction_number && (
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                  SN: {app.sanction_number}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col">
                          <p className="font-medium text-slate-900">{app.employee_name}</p>
                          <div className="text-sm text-slate-600">
                            <p>
                              {app.from_location}
                              <span className="mx-2 text-muted-foreground">→</span>
                              {app.to_location}
                            </p>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <span className="text-sm text-slate-700">
                          {formatFullDate(app.departure_date)}
                        </span>
                      </TableCell>

                      <TableCell className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          {app.booking_action_status && app.booking_action_status !== "none" ? (
                            <StatusBadge statusType="booking" status={app.booking_action_status} />
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="text-center">
                        <div className="flex flex-row items-center justify-center gap-1">
                          <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 text-sm font-semibold">
                            {app.booked_bookings} / {app.total_bookings}
                          </span>
                          <span
                            className={`text-[11px] ${
                              app.pending_bookings > 0
                                ? "text-blue-500 font-medium"
                                : "text-muted-foreground"
                            }`}
                          >
                            Completed
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="text-center">
                        <div className="flex justify-center items-center gap-1.5">
                          {/* Toggle Read / Unread quick action button */}
                          {onToggleRead && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className={cn(
                                    "h-8 w-8 p-0 rounded-md transition-colors",
                                    isUnread
                                      ? "bg-blue-50 text-blue-600 hover:bg-blue-100"
                                      : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                  )}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleRead(app);
                                  }}
                                >
                                  {isUnread ? (
                                    <Mail className="w-4 h-4" />
                                  ) : (
                                    <MailCheck className="w-4 h-4" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {isUnread ? "Mark as read" : "Mark as unread"}
                              </TooltipContent>
                            </Tooltip>
                          )}

                          {/* View details button */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 bg-blue-100 hover:bg-blue-200 text-blue-600 hover:text-blue-700"
                                onClick={() => onView(app)}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>View Application</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>

                    {expandedRow === app.id && (
                      <TableRow>
                        <TableCell colSpan={7} className="bg-muted/30 p-4">
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {app.trip_details?.[0]?.bookings?.map((booking: any) => (
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
                                        booking.estimated_cost
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
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
