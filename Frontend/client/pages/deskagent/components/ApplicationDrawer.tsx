import React, { useState, useEffect } from "react";
import {
  X,
  XCircle,
  FileText,
  MapPin,
  Calendar,
  Eye,
  Send,
  MessageSquarePlus,
  FileUp,
  Plane,
  Train,
  Car,
  Home,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { ForwardModal, AddNoteModal, ViewBookingModal, CancelModal } from "./";
import { formatDateToDDMMYYYY, formatCurrency } from "../utils/format";
import { travelDeskAPI } from "@/src/api/travel-desk";
import { toast } from "sonner";
import type {
  Application,
  Booking,
  BookingAgent,
} from "@/src/types/travel-desk.types";

interface ApplicationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  applicationId: number | null;
  onRefresh?: () => void;
}

const getBookingIcon = (type: string) => {
  const lower = type.toLowerCase();
  if (lower.includes("flight")) return Plane;
  if (lower.includes("train")) return Train;
  if (lower.includes("car") || lower.includes("pick") || lower.includes("drop"))
    return Car;
  if (
    lower.includes("accommodation") ||
    lower.includes("hotel") ||
    lower.includes("guest")
  )
    return Home;
  return MapPin;
};

const isSelfArranged = (booking: Booking) => {
  const subOptionName = ((booking as any).sub_option_name || "").toLowerCase();
  return (
    subOptionName.includes("self") || subOptionName.includes("self-arranged")
  );
};

export const ApplicationDrawer: React.FC<ApplicationDrawerProps> = ({
  isOpen,
  onClose,
  applicationId,
  onRefresh,
}) => {
  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedBookings, setSelectedBookings] = useState<number[]>([]);
  const [agents, setAgents] = useState<BookingAgent[]>([]);

  const [forwardModalOpen, setForwardModalOpen] = useState(false);
  const [forwardType, setForwardType] = useState<"forward" | "reassign">(
    "forward",
  );
  const [selectedBookingForAction, setSelectedBookingForAction] =
    useState<Booking | null>(null);
  const [addNoteModalOpen, setAddNoteModalOpen] = useState(false);
  const [viewBookingModalOpen, setViewBookingModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (isOpen && applicationId) {
      fetchApplicationDetails();
      fetchAgents();
    }
  }, [isOpen, applicationId]);

  const fetchApplicationDetails = async () => {
    if (!applicationId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await travelDeskAPI.applications.detail(applicationId);
      console.log("In Drawer: ", res);
      setApplication(res.data);
    } catch (err: any) {
      setError(err.message || "Failed to load application details");
      toast.error("Failed to load application details");
    } finally {
      setLoading(false);
    }
  };

  const fetchAgents = async () => {
    try {
      const res = await travelDeskAPI.agents.list();
      setAgents(res.data || []);
    } catch {
      setAgents([]);
    }
  };

  const getAllBookings = (): Booking[] => {
    return application?.trips?.flatMap((trip) => trip.bookings) ?? [];
  };

  const getSelectedBookingTypes = (): Set<string> => {
    const bookings = selectedBookingForAction
      ? [selectedBookingForAction]
      : getAllBookings().filter((b) => selectedBookings.includes(b.id));

    return new Set(bookings.map((b) => b.booking_type_name.toLowerCase()));
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedBookings(getAllBookings().map((b) => b.id));
    } else {
      setSelectedBookings([]);
    }
  };

  const handleSelectBooking = (bookingId: number, checked: boolean) => {
    setSelectedBookings((prev) =>
      checked ? [...prev, bookingId] : prev.filter((id) => id !== bookingId),
    );
  };

  const handleViewBooking = (booking: Booking) => {
    setSelectedBookingForAction(booking);
    setViewBookingModalOpen(true);
  };

  const handleForwardBooking = async (booking: Booking) => {
    setSelectedBookingForAction(booking);
    setForwardType(booking.status === "pending" ? "forward" : "reassign");
    setForwardModalOpen(true);
  };

  const handleAddNote = (booking: Booking) => {
    setSelectedBookingForAction(booking);
    setAddNoteModalOpen(true);
  };

  const handleCancelBooking = (booking: Booking) => {
    setSelectedBookingForAction(booking);
    setCancelModalOpen(true);
  };

  const handleBulkForward = async () => {
    if (selectedBookings.length === 0) {
      toast.error("Please select at least one booking");
      return;
    }
    setSelectedBookingForAction(null);
    setForwardType("forward");
    setForwardModalOpen(true);
  };

  const confirmForward = async (agentId: number, note: string) => {
    setActionLoading(true);

    try {
      const ids = selectedBookingForAction
        ? [selectedBookingForAction.id]
        : selectedBookings;

      if (forwardType === "reassign" && selectedBookingForAction) {
        await travelDeskAPI.bookings.reassign(selectedBookingForAction.id, {
          new_agent_id: agentId,
        });
      } else {
        await travelDeskAPI.bookings.assign({
          booking_ids: ids,
          booking_agent_id: agentId,
          scope: ids.length === 1 ? "single_booking" : "full_application",
          note: note || undefined,
        });
      }

      toast.success("Booking forwarded successfully");
      setForwardModalOpen(false);
      setSelectedBookings([]);
      setSelectedBookingForAction(null);
      await fetchApplicationDetails();
      onRefresh?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to forward booking");
    } finally {
      setActionLoading(false);
    }
  };

  // const confirmForward = async (agentId: number, note: string) => {
  //   setActionLoading(true);
  //   try {
  //     const ids = selectedBookingForAction ? [selectedBookingForAction.id] : selectedBookings;

  //     if (forwardType === 'reassign' && selectedBookingForAction) {
  //       await travelDeskAPI.bookings.reassign(selectedBookingForAction.id, {
  //         new_agent_id: agentId,
  //       });
  //     } else {
  //       await travelDeskAPI.bookings.assign({
  //         booking_ids: ids,
  //         scope: ids.length === 1 ? 'single_booking' : 'full_application',
  //         booking_agent_id: agentId,
  //         note: note || undefined,
  //       });
  //     }

  //     setForwardModalOpen(false);
  //     setSelectedBookings([]);
  //     fetchApplicationDetails();
  //     onRefresh?.();
  //     toast.success('Booking updated');
  //   } catch (err: any) {
  //     toast.error(err.message || 'Failed to process booking');
  //   } finally {
  //     setActionLoading(false);
  //   }
  // };

  const confirmAddNote = async (note: string) => {
    if (!selectedBookingForAction) return;

    setActionLoading(true);
    try {
      await travelDeskAPI.bookings.addNote(selectedBookingForAction.id, {
        note,
      });
      toast.success("Note added");
      setAddNoteModalOpen(false);
      fetchApplicationDetails();
    } catch (err: any) {
      toast.error(err.message || "Failed to add note");
    } finally {
      setActionLoading(false);
    }
  };

  const confirmCancelBooking = async (reason: string) => {
    if (!selectedBookingForAction) return;
    setActionLoading(true);
    try {
      await travelDeskAPI.bookings.cancel(selectedBookingForAction.id, {
        reason,
      });
      toast.success("Booking cancelled");
      setCancelModalOpen(false);
      setSelectedBookingForAction(null);
      fetchApplicationDetails();
      onRefresh?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel booking");
    } finally {
      setActionLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedBookings([]);
    setApplication(null);
    onClose();
  };

  if (!isOpen) return null;

  const allBookings = getAllBookings();
  const totalBookings = allBookings.length;
  const allSelected =
    allBookings.length > 0 && selectedBookings.length === allBookings.length;
  const someSelected =
    selectedBookings.length > 0 && selectedBookings.length < allBookings.length;
  const completedBookings = allBookings.filter(
    (b) => b.status === "completed" || b.status === "confirmed",
  ).length;
  const isAllCompleted =
    totalBookings > 0 && completedBookings === totalBookings;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" />

      <div
        className="
          fixed top-0 right-0 h-full w-2/3 md:w-full bg-white 
          shadow-xl z-50 overflow-hidden flex flex-col
          animate-slide-in-right
        "
      >
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-blue-600" />
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold">
                {application?.travel_request_id || "Loading..."}
              </h2>

              <Badge variant="outline">
                Bookings: {completedBookings} / {totalBookings} completed
              </Badge>

              {isAllCompleted && (
                <Badge className="bg-green-100 text-green-700 border-green-300">
                  Completed
                </Badge>
              )}
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="hover:bg-slate-100 hover:text-black"
            onClick={handleClose}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="text-center">
                <div className="animate-spin w-12 h-12 rounded-full border-b-2 border-blue-600 mx-auto mb-3" />
                <p className="text-muted-foreground">Loading application...</p>
              </div>
            </div>
          ) : error ? (
            <div className="p-4 border border-red-300 bg-red-50 rounded-lg text-red-600">
              {error}
            </div>
          ) : application ? (
            <>
              <Card className="border shadow-sm">
                <CardHeader className="pb-3 border-b bg-slate-50">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Info className="w-4 h-4 text-blue-600" />
                    Application Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Purpose</p>
                      <p className="text-sm font-medium break-words">
                        {application.purpose}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Internal Order
                      </p>
                      <p className="text-sm font-medium">
                        {application.internal_order}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Estimated Cost
                      </p>
                      <p className="text-sm font-semibold text-blue-600">
                        {formatCurrency(application.estimated_total_cost)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Advance Amount
                      </p>
                      <p className="text-sm font-semibold text-blue-600">
                        {formatCurrency(application.advance_amount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Sanction Number
                      </p>
                      <p className="text-sm font-medium">
                        {application.sanction_number || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Status</p>
                      <p className="text-sm font-medium">
                        {application.status_label || application.status}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Submitted On
                      </p>
                      <p className="text-sm font-medium">
                        {application.submitted_at
                          ? new Date(application.submitted_at).toLocaleString(
                              "en-IN",
                              {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )
                          : "—"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {application.trips?.map((trip) => (
                <Card key={trip.id} className="border shadow-sm">
                  <CardHeader className="pb-3 border-b bg-slate-50">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-blue-600" />
                        {trip.from_location_name} → {trip.to_location_name}
                      </CardTitle>

                      <div className="flex items-center gap-2">
                        <Badge variant="default">
                          <Calendar className="w-3 h-3 mr-1" />
                          {formatDateToDDMMYYYY(trip.departure_date)} -{" "}
                          {formatDateToDDMMYYYY(trip.return_date)}
                        </Badge>
                        <Badge variant="outline">
                          {trip.duration_days} days
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-4">
                    {selectedBookings.length > 0 && !isAllCompleted && (
                      <div className="p-3 mb-4 bg-blue-50 border border-blue-200 rounded-lg flex justify-between items-center">
                        <span className="text-sm font-medium">
                          {selectedBookings.length} booking(s) selected
                        </span>
                        <Button size="sm" onClick={handleBulkForward}>
                          <Send className="w-4 h-4 mr-2" />
                          Forward Selected
                        </Button>
                      </div>
                    )}

                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-100">
                            <TableHead className="w-[50px]">
                              <Checkbox
                                checked={allSelected}
                                disabled={isAllCompleted}
                                onCheckedChange={handleSelectAll}
                                aria-label="select all"
                                className={
                                  someSelected
                                    ? "data-[state=checked]:bg-blue-500/60 data-[state=checked]:border-blue-500"
                                    : ""
                                }
                              />
                            </TableHead>
                            <TableHead className="w-[50px]">#</TableHead>
                            <TableHead>Booking Type &amp; Sub Option</TableHead>
                            <TableHead>Origin → Destination</TableHead>
                            <TableHead>Departure → Arrival</TableHead>
                            <TableHead className="text-right">
                              Estimated Cost
                            </TableHead>
                            <TableHead className="text-center">
                              Status
                            </TableHead>
                            <TableHead className="text-center">
                              Actions
                            </TableHead>
                          </TableRow>
                        </TableHeader>

                        <TableBody>
                          {trip.bookings.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={8}
                                className="text-center py-8 text-muted-foreground"
                              >
                                No bookings found
                              </TableCell>
                            </TableRow>
                          ) : (
                            trip.bookings.map((booking, index) => {
                              const Icon = getBookingIcon(
                                booking.booking_type_name,
                              );
                              const d = (booking as any).booking_details || {};
                              const type =
                                booking.booking_type_name?.toLowerCase() || "";

                              return (
                                <TableRow
                                  key={booking.id}
                                  className="hover:bg-slate-50"
                                >
                                  <TableCell>
                                    <Checkbox
                                      checked={selectedBookings.includes(
                                        booking.id,
                                      )}
                                      disabled={
                                        isAllCompleted ||
                                        isSelfArranged(booking)
                                      }
                                      onCheckedChange={(checked) =>
                                        handleSelectBooking(
                                          booking.id,
                                          checked as boolean,
                                        )
                                      }
                                      aria-label={`select booking ${booking.id}`}
                                    />
                                  </TableCell>

                                  <TableCell className="font-medium">
                                    {index + 1}
                                  </TableCell>

                                  <TableCell>
                                    <div className="flex items-start gap-2">
                                      <Icon className="w-4 h-4 mt-1 text-blue-600" />
                                      <div className="space-y-0.5">
                                        <p className="font-medium text-sm">
                                          {booking.booking_type_name}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {booking.sub_option_name || "—"}
                                        </p>
                                        {(booking.booking_reference ||
                                          booking.vendor_reference ||
                                          booking.booking_file ||
                                          booking.special_instruction) && (
                                          <p className="text-[11px] text-slate-500">
                                            {booking.booking_reference && (
                                              <span>
                                                Ref: {booking.booking_reference}
                                              </span>
                                            )}
                                            {booking.vendor_reference && (
                                              <span>
                                                {booking.booking_reference
                                                  ? " • "
                                                  : ""}
                                                Vendor:{" "}
                                                {booking.vendor_reference}
                                              </span>
                                            )}
                                            {booking.booking_file && (
                                              <span>
                                                {(booking.booking_reference ||
                                                  booking.vendor_reference) &&
                                                  " • "}
                                                File attached
                                              </span>
                                            )}
                                            {booking.special_instruction && (
                                              <span>
                                                {(booking.booking_reference ||
                                                  booking.vendor_reference ||
                                                  booking.booking_file) &&
                                                  " • "}
                                                Note:{" "}
                                                {booking.special_instruction}
                                              </span>
                                            )}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </TableCell>

                                  <TableCell className="text-sm">
                                    {(() => {
                                      if (
                                        type.includes("flight") ||
                                        type.includes("train")
                                      ) {
                                        const from =
                                          d.from_location_name ||
                                          d.from_location ||
                                          trip.from_location_name ||
                                          "—";
                                        const to =
                                          d.to_location_name ||
                                          d.to_location ||
                                          trip.to_location_name ||
                                          "—";
                                        return (
                                          <span>
                                            {from} → {to}
                                          </span>
                                        );
                                      }

                                      if (type.includes("accommodation")) {
                                        const place =
                                          d.place_name ||
                                          d.place ||
                                          trip.to_location_name ||
                                          "—";
                                        const segment =
                                          booking.trip_segment ||
                                          `${trip.from_location_name} → ${trip.to_location_name}`;
                                        return (
                                          <div className="flex flex-col">
                                            <span className="text-xs text-muted-foreground mb-0.5">
                                              {segment}
                                            </span>
                                            <span>{place}</span>
                                          </div>
                                        );
                                      }

                                      if (
                                        type.includes("car") ||
                                        type.includes("cab") ||
                                        type.includes("conveyance")
                                      ) {
                                        const from =
                                          d.from_location || "Pickup";
                                        const to =
                                          d.drop_location ||
                                          d.to_location ||
                                          "Drop";
                                        return (
                                          <span>
                                            {from} → {to}
                                          </span>
                                        );
                                      }

                                      return (
                                        <span>
                                          {booking.trip_segment || "—"}
                                        </span>
                                      );
                                    })()}
                                  </TableCell>

                                  <TableCell className="text-sm">
                                    {(() => {
                                      if (
                                        type.includes("flight") ||
                                        type.includes("train")
                                      ) {
                                        const dep =
                                          d.departure_date ||
                                          trip.departure_date ||
                                          null;
                                        const arr =
                                          d.arrival_date ||
                                          trip.return_date ||
                                          null;
                                        return (
                                          <span>
                                            {dep
                                              ? formatDateToDDMMYYYY(dep)
                                              : "—"}{" "}
                                            →{" "}
                                            {arr
                                              ? formatDateToDDMMYYYY(arr)
                                              : "—"}
                                          </span>
                                        );
                                      }

                                      if (type.includes("accommodation")) {
                                        const inDate = d.check_in_date || null;
                                        const outDate =
                                          d.check_out_date || null;
                                        return (
                                          <span>
                                            {inDate
                                              ? formatDateToDDMMYYYY(inDate)
                                              : "—"}{" "}
                                            →{" "}
                                            {outDate
                                              ? formatDateToDDMMYYYY(outDate)
                                              : "—"}
                                          </span>
                                        );
                                      }

                                      if (
                                        type.includes("car") ||
                                        type.includes("cab") ||
                                        type.includes("conveyance")
                                      ) {
                                        const start =
                                          d.start_date ||
                                          trip.departure_date ||
                                          null;
                                        return (
                                          <span>
                                            {start
                                              ? formatDateToDDMMYYYY(start)
                                              : "—"}
                                          </span>
                                        );
                                      }

                                      return (
                                        <span>
                                          {trip.departure_date
                                            ? formatDateToDDMMYYYY(
                                                trip.departure_date,
                                              )
                                            : "—"}{" "}
                                          →{" "}
                                          {trip.return_date
                                            ? formatDateToDDMMYYYY(
                                                trip.return_date,
                                              )
                                            : "—"}
                                        </span>
                                      );
                                    })()}
                                  </TableCell>

                                  <TableCell className="text-right font-medium">
                                    {formatCurrency(booking.estimated_cost)}
                                  </TableCell>

                                  <TableCell className="text-center">
                                    {/* <StatusBadge status={booking.status} /> */}
                                    <StatusBadge
                                      statusType="booking"
                                      status={booking.status}
                                    />
                                  </TableCell>

                                  <TableCell className="text-center">
                                    <div className="flex justify-center gap-1">
                                      {/* View is always allowed */}
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="bg-blue-100 text-blue-600 hover:bg-blue-200 hover:text-blue-800"
                                            onClick={() =>
                                              handleViewBooking(booking)
                                            }
                                          >
                                            <Eye className="w-4 h-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>View</TooltipContent>
                                      </Tooltip>

                                      {/* Actions disabled if fully completed */}
                                      {!isAllCompleted && (
                                        <>
                                          {isSelfArranged(booking) ? (
                                            <Badge
                                              variant="outline"
                                              className="bg-yellow-50 text-yellow-700 border-yellow-200"
                                            >
                                              Self Arranged
                                            </Badge>
                                          ) : (
                                            <>
                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <span>
                                                    <Button
                                                      variant="ghost"
                                                      size="sm"
                                                      className="bg-green-100 text-green-600 hover:bg-green-200 hover:text-green-800 disabled:opacity-50 disabled:cursor-not-allowed"
                                                      onClick={() =>
                                                        handleForwardBooking(
                                                          booking,
                                                        )
                                                      }
                                                      disabled={
                                                        !booking.can_reassign
                                                      }
                                                    >
                                                      {booking.status ===
                                                      "pending" ? (
                                                        <Send className="w-4 h-4" />
                                                      ) : (
                                                        <FileUp className="w-4 h-4" />
                                                      )}
                                                    </Button>
                                                  </span>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                  {!booking.can_reassign
                                                    ? "Cannot reassign active/completed booking"
                                                    : booking.status ===
                                                        "pending"
                                                      ? "Forward"
                                                      : "Reassign"}
                                                </TooltipContent>
                                              </Tooltip>

                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="bg-yellow-100 text-yellow-600 hover:bg-yellow-200 hover:text-yellow-800"
                                                    onClick={() =>
                                                      handleAddNote(booking)
                                                    }
                                                  >
                                                    <MessageSquarePlus className="w-4 h-4" />
                                                  </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                  Add Note
                                                </TooltipContent>
                                              </Tooltip>

                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="bg-orange-100 text-orange-600 hover:bg-orange-200 hover:text-orange-800"
                                                    onClick={() =>
                                                      handleCancelBooking(
                                                        booking,
                                                      )
                                                    }
                                                  >
                                                    <XCircle className="w-4 h-4" />
                                                  </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                  Cancel Booking
                                                </TooltipContent>
                                              </Tooltip>
                                            </>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          ) : null}
        </div>
      </div>

      <ForwardModal
        isOpen={forwardModalOpen}
        onClose={() => {
          setForwardModalOpen(false);
        }}
        onConfirm={confirmForward}
        title={
          selectedBookingForAction
            ? forwardType === "forward"
              ? `Forward Booking #${selectedBookingForAction.id}`
              : `Reassign Booking #${selectedBookingForAction.id}`
            : `Forward ${selectedBookings.length} Booking(s)`
        }
        isLoading={actionLoading}
        type={forwardType}
      />

      <AddNoteModal
        isOpen={addNoteModalOpen}
        onClose={() => setAddNoteModalOpen(false)}
        onConfirm={confirmAddNote}
        bookingId={selectedBookingForAction?.id ?? null}
        isLoading={actionLoading}
      />

      <CancelModal
        isOpen={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        onConfirm={confirmCancelBooking}
        applicationId={selectedBookingForAction?.id ?? null}
        isLoading={actionLoading}
      />

      <ViewBookingModal
        isOpen={viewBookingModalOpen}
        onClose={() => setViewBookingModalOpen(false)}
        booking={selectedBookingForAction}
      />
    </>
  );
};
