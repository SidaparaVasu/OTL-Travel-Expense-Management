import React, { useState } from "react";
import {
  X,
  Plane,
  Train,
  Car,
  Home,
  MapPin,
  Calendar,
  Clock,
  User,
  UserCheck,
  FileText,
  Download,
  IndianRupee,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import {
  formatDateToDDMMYYYY,
  formatTime,
  formatCurrency,
  formatDateTime,
  getBookingTypeLabel,
  getSubOptionLabel,
} from "../utils/format";
import type { Booking } from "@/src/api/bookingAgentAPI";
import { docViewer } from "@/src/api/document_viewer";
import { BulkFilePreviewDrawer } from "@/pages/common/travel/components/BulkFilePreviewDrawer";

interface ViewBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  onAccept?: (booking: Booking) => void;
  onReject?: (booking: Booking) => void;
}

const getBookingIcon = (type: number | string) => {
  const t =
    typeof type === "string"
      ? type.toLowerCase()
      : getBookingTypeLabel(type).toLowerCase();
  if (t.includes("flight")) return Plane;
  if (t.includes("train")) return Train;
  if (t.includes("car") || t.includes("conveyance") || t.includes("taxi"))
    return Car;
  if (t.includes("accommodation") || t.includes("hotel") || t.includes("guest"))
    return Home;
  if (t.includes("bulk booking")) return FileText;
  return MapPin;
};

const getBookingColor = (type: number | string) => {
  const t =
    typeof type === "string"
      ? type.toLowerCase()
      : getBookingTypeLabel(type).toLowerCase();
  if (t.includes("flight")) return "text-primary bg-primary/10";
  if (t.includes("train")) return "text-primary bg-primary/10";
  if (t.includes("car") || t.includes("conveyance"))
    return "text-red-600 bg-red-600/10";
  if (t.includes("accommodation") || t.includes("hotel"))
    return "text-emerald-600 bg-emerald-600/10";
  if (t.includes("bulk booking")) return "text-blue-600 bg-blue-600/10";
  return "text-muted-foreground bg-muted/20";
};

export const ViewBookingModal: React.FC<ViewBookingModalProps> = ({
  isOpen,
  onClose,
  booking,
  onAccept,
  onReject,
}) => {
  const [bulkPreviewOpen, setBulkPreviewOpen] = useState(false);

  if (!isOpen || !booking) return null;

  const isRequested = booking.status === "requested";
  const isClosed = booking.status === "closed";
  const isOnHold = booking.travel_application_status === "cancellation_requested";
  const isGuestTravel = booking.travel_for === "guest" || booking.travel_for === "self_guest";

  const details = booking.booking_details || {};
  const Icon = getBookingIcon(booking.booking_type_name || booking.booking_type);
  const colorClass = getBookingColor(booking.booking_type_name || booking.booking_type);

  const renderRow = (label: string, value: React.ReactNode) => {
    if (!value || value === "—") return null;
    return (
      <div className="flex justify-between py-2 border-b last:border-0 border-border">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-sm font-medium">{value}</span>
      </div>
    );
  };

  const renderSection = (
    title: string,
    icon: React.ElementType,
    children: React.ReactNode,
  ) => {
    const SectionIcon = icon;
    return (
      <div className="space-y-2">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <SectionIcon className="w-4 h-4 text-primary" />
          {title}
        </h4>
        <div className="bg-card border rounded-lg p-3">{children}</div>
      </div>
    );
  };

  /* ── Inline traveler table (replaces the old Dialog popup) ── */
  const renderTravelersTable = () => {
    if (!booking.travelers || booking.travelers.length === 0) return null;
    return (
      <div className="space-y-2">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <User className="w-4 h-4 text-primary" />
          Guest(s) Details ({booking.travelers.length})
        </h4>
        <div className="bg-card border rounded-lg overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-primary">
                <th className="py-2 px-3 font-medium whitespace-nowrap">#</th>
                <th className="py-2 px-3 font-medium whitespace-nowrap">Name</th>
                <th className="py-2 px-3 font-medium whitespace-nowrap">Gender</th>
                <th className="py-2 px-3 font-medium whitespace-nowrap">Age</th>
                <th className="py-2 px-3 font-medium whitespace-nowrap">Contact</th>
                <th className="py-2 px-3 font-medium whitespace-nowrap">Nationality</th>
                <th className="py-2 px-3 font-medium whitespace-nowrap">Flight / Stay Meal</th>
              </tr>
            </thead>
            <tbody>
              {booking.travelers.map((traveler, idx) => (
                <tr key={traveler.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="py-2 px-3 text-muted-foreground">{idx + 1}</td>
                  <td className="py-2 px-3 font-medium whitespace-nowrap">{traveler.full_name}</td>
                  <td className="py-2 px-3 whitespace-nowrap">{traveler.gender || "—"}</td>
                  <td className="py-2 px-3">{traveler.age ?? "—"}</td>
                  <td className="py-2 px-3 whitespace-nowrap">{traveler.contact_number || "—"}</td>
                  <td className="py-2 px-3 whitespace-nowrap">{traveler.nationality_type || "—"}</td>
                  <td className="py-2 px-3 text-xs whitespace-nowrap">
                    {traveler.flight_meal_preference_name || "—"} /{" "}
                    {traveler.accommodation_meal_preference_name || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  /* ── Applicant details section ── */
  const renderApplicantDetails = () =>
    renderSection(
      "Applicant Details",
      UserCheck,
      <>
        {renderRow("Name", booking.employee_name)}
        {renderRow("Email", booking.employee_email)}
        {renderRow("Mobile Number", booking.employee_mobile)}
        {renderRow("Gender", booking.employee_gender)}
        {renderRow("Grade", booking.employee_grade)}
        {renderRow("Age", (booking as any).employee_age)}
      </>,
    );

  return (
    <div
      className="fixed top-0 left-0 right-0 bottom-0 bg-black/50 backdrop-blur-sm flex justify-center p-5 m-0 z-50"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-lg shadow-xl w-full max-w-7xl max-h-full overflow-hidden flex flex-col m-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorClass}`}>
              <Icon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">
                {booking.booking_type_name || getBookingTypeLabel(booking.booking_type)}
              </h3>
              <p className="text-sm text-muted-foreground">
                {booking.sub_option_name || getSubOptionLabel(booking.sub_option)}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-slate-100 hover:text-slate-600"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* LEFT SECTION */}
          <div className="w-[60%] border-r overflow-y-auto px-6 py-4 space-y-6">

            {isClosed && booking.closure_reason && (
              <div className="bg-slate-100 border border-slate-300 rounded-lg px-4 py-3 text-sm text-slate-800">
                <p className="font-semibold text-slate-900">Booking closed</p>
                <p className="mt-1 whitespace-pre-wrap">{booking.closure_reason}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  No further vendor actions are required on this line.
                </p>
              </div>
            )}

            {/* Status & Cost */}
            <div className="flex items-center justify-between">
              <StatusBadge statusType="booking" status={booking.status} />
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Estimated Cost</p>
                <p className="text-xl font-semibold">{formatCurrency(booking.estimated_cost)}</p>
              </div>
            </div>

            {/* Grade Entitlement Warning */}
            {booking.grade_entitled_amount != null && (
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-300 rounded-lg px-4 py-3">
                <IndianRupee className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-800">
                  <span className="font-semibold">Entitlement Limit: </span>
                  This employee is entitled to a maximum of{" "}
                  <span className="font-bold">
                    ₹{Number(booking.grade_entitled_amount).toLocaleString("en-IN")}
                  </span>{" "}
                  for this booking type. Please book within this limit.
                </p>
              </div>
            )}

            {/*
              ── GUEST TRAVEL: Guest(s) Details first, then Applicant Details ──
              ── SELF TRAVEL:  Only Applicant Details, no Guest(s) Details     ──
            */}
            {isGuestTravel ? (
              <>
                {renderTravelersTable()}
                {renderApplicantDetails()}
              </>
            ) : (
              renderApplicantDetails()
            )}

            {/* Basic Info */}
            {renderSection(
              "Basic Information",
              Tag,
              <>
                {renderRow("Booking ID", `BK-${String(booking.id).padStart(5, "0")}`)}
                {renderRow("Travel Request", booking.travel_request_id)}
                {renderRow("Meal Preference", details.meal_preference)}
                {renderRow("Internal Order (IO)", booking.internal_order)}
                {renderRow("GL Code", booking.gl_code)}
                {renderRow("Sanction Number", booking.sanction_number)}
              </>,
            )}

            {/* Special Instructions — right after Basic Info */}
            {booking.special_instruction && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Special Instructions
                </h4>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                  {booking.special_instruction}
                </div>
              </div>
            )}

            {/* Bulk Booking File Alert */}
            {booking.bulk_booking_file && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-emerald-700 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-emerald-950">Bulk Guest Data</h4>
                    <p className="text-sm text-emerald-800 mt-1">
                      Applicant uploaded guest details for this booking line.
                    </p>
                  </div>
                </div>
                <Button
                  className="w-full sm:w-auto self-start ml-8 bg-emerald-700 hover:bg-emerald-800"
                  onClick={() => setBulkPreviewOpen(true)}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  View bulk data
                </Button>
              </div>
            )}

            {(booking.booking_type_name?.toLowerCase().includes("bulk") ||
              booking.booking_type.toString().toLowerCase().includes("bulk")) &&
              booking.booking_file && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <FileText className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-blue-900">Bulk Guest Data</h4>
                      <p className="text-sm text-blue-700 mt-1">
                        This booking contains bulk guest details. Content is in the attached file.
                      </p>
                    </div>
                  </div>
                  <Button
                    className="w-full sm:w-auto self-start ml-8 bg-blue-600 hover:bg-blue-700"
                    onClick={() => docViewer.onViewFile(booking.booking_file!)}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Guest Details (Excel/CSV)
                  </Button>
                </div>
              )}

            {/* Route */}
            {details.from_location_name && details.to_location_name && (
              <div className="bg-muted/40 border rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Route</span>
                </div>
                <p className="text-sm">
                  {details.from_location_name} → {details.to_location_name}
                </p>
              </div>
            )}

            {/* Schedule - Flight/Train */}
            {(details.departure_date || details.arrival_date) &&
              renderSection(
                "Schedule",
                Calendar,
                <>
                  {renderRow("Ticket Name/No.", details?.ticket_number || "Not Provided")}
                  {renderRow("Departure Date", formatDateToDDMMYYYY(details.departure_date))}
                  {renderRow("Departure Time", formatTime(details.departure_time))}
                  {renderRow("Arrival Date", formatDateToDDMMYYYY(details.arrival_date))}
                  {renderRow("Arrival Time", formatTime(details.arrival_time))}
                </>,
              )}

            {/* Schedule - Accommodation */}
            {(details.check_in_date || details.check_out_date) &&
              renderSection(
                "Schedule",
                Calendar,
                <>
                  {renderRow("Place", details.place)}
                  {renderRow("Check-In Date", formatDateToDDMMYYYY(details.check_in_date))}
                  {renderRow("Check-In Time", formatTime(details.check_in_time))}
                  {renderRow("Check-Out Date", formatDateToDDMMYYYY(details.check_out_date))}
                  {renderRow("Check-Out Time", formatTime(details.check_out_time))}
                  {details.arc_hotel_preferences && details.arc_hotel_preferences.length > 0 && (
                    <div className="col-span-2">
                      <span className="text-sm text-black block mb-3 mt-4">
                        ARC Hotel Preferences
                      </span>
                      <div className="flex flex-col gap-2">
                        {details.arc_hotel_preferences.map((pref: any, idx: number) => (
                          <p
                            key={idx}
                            className="px-2 py-2 bg-blue-50/50 text-black text-sm border-b border-gray-200"
                          >
                            {typeof pref === "object" && pref.name
                              ? `${idx + 1}. ${pref.name}`
                              : `${idx + 1}. ${pref}`}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </>,
              )}

            {/* Schedule - Conveyance */}
            {(details.start_date || details.start_time) &&
              renderSection(
                "Schedule",
                Clock,
                <>
                  {renderRow("Start Date/Time", `${formatDateToDDMMYYYY((details as any).start_date)} ${formatTime((details as any).start_time)}`)}
                  {renderRow("End Date/Time", `${formatDateToDDMMYYYY((details as any).end_date)} ${formatTime((details as any).end_time)}`)}
                  {renderRow("From ↔ To Location", `${details.from_location_name || details.from_location} ↔ ${details.to_location_name || details.to_location}`)}
                  {renderRow("Report At ↔ Drop Location", `${details.report_at} ↔ ${details.drop_location}`)}
                  {renderRow("No. of Person", (details as any).passenger_count?.toString())}
                  {renderRow("Approx. K.M.", details.distance_km?.toString())}
                </>,
              )}

            {/* Financial */}
            {renderSection(
              "Financial",
              IndianRupee,
              <>
                {renderRow("Estimated Cost", formatCurrency(booking.estimated_cost) || "Not Provided")}
                {renderRow("Actual Cost", formatCurrency(booking.actual_cost) || "Not Provided")}
                {renderRow("Booking Reference", booking.booking_reference)}
                {renderRow("Vendor Reference", booking.vendor_reference)}
                {booking.requested_vehicle_type && (
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-sm text-sky-600 font-medium">Requested Vehicle</span>
                    <span className="text-sm font-bold text-sky-700">
                      {booking.requested_vehicle_type.name}
                    </span>
                  </div>
                )}
              </>,
            )}

            {/* Guests from booking_details (legacy badge list) */}
            {details.guests && details.guests.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" />
                  Guests
                </h4>
                <div className="flex flex-wrap gap-2">
                  {details.guests.map((g, idx) => (
                    <Badge key={idx} variant="secondary">
                      {g.name}
                      {g.is_external && " (External)"}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* File - Generic Link (Hidden for Bulk Booking) */}
            {booking.booking_file &&
              !(
                booking.booking_type_name?.toLowerCase().includes("bulk") ||
                booking.booking_type.toString().toLowerCase().includes("bulk")
              ) && (
                <a
                  onClick={() => docViewer.onViewFile(booking.booking_file!)}
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-primary text-sm underline hover:no-underline cursor-pointer"
                >
                  <Download className="w-4 h-4" /> Download Ticket / Receipt
                </a>
              )}
          </div>

          {/* RIGHT SECTION */}
          <div className="flex-[1] flex flex-col px-6 py-4 bg-muted/20 min-h-0">
            <h4 className="text-sm font-medium flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-primary" />
              Notes & Remarks
            </h4>
            <div className="flex-1 overflow-y-auto bg-card border rounded-lg p-3 space-y-4 min-h-0">
              {booking.notes && booking.notes.length > 0 ? (
                booking.notes.map((note: any) => (
                  <div key={note.id} className="text-sm border-b last:border-0 pb-3 last:pb-0">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-semibold text-slate-700">{note.author_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(note.created_at)}
                      </span>
                    </div>
                    <p className="text-slate-600 whitespace-pre-wrap">{note.note}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground italic">No notes available.</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex justify-end gap-3">
          {isRequested && !isClosed ? (
            <>
              <Button
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                onClick={() => { onReject?.(booking); onClose(); }}
                disabled={isOnHold}
              >
                Reject Booking
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => { onAccept?.(booking); onClose(); }}
                disabled={isOnHold}
              >
                Accept Booking
              </Button>
            </>
          ) : (
            <Button onClick={onClose}>Close</Button>
          )}
        </div>
      </div>

      <BulkFilePreviewDrawer
        open={bulkPreviewOpen}
        onClose={() => setBulkPreviewOpen(false)}
        bookingId={booking.id}
      />
    </div>
  );
};
