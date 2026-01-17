import React from "react";
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
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
// import { StatusBadge } from "./StatusBadge";
import { StatusBadge } from "@/components/StatusBadge";
import {
  formatDateToDDMMYYYY,
  formatTime,
  formatCurrency,
  formatDateTime,
} from "../utils/format";
import { docViewer } from "@/src/api/document_viewer";

interface ViewBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: any | null;
}

const getBookingIcon = (type: string) => {
  const t = type.toLowerCase();
  if (t.includes("flight")) return Plane;
  if (t.includes("train")) return Train;
  if (t.includes("car")) return Car;
  if (t.includes("accommodation") || t.includes("hotel") || t.includes("guest"))
    return Home;
  return MapPin;
};

const getBookingColor = (type: string) => {
  const t = type.toLowerCase();
  if (t.includes("flight")) return "text-primary bg-primary/10";
  if (t.includes("train")) return "text-primary bg-primary/10";
  if (t.includes("car")) return "text-red-600 bg-red-600/10";
  if (t.includes("accommodation")) return "text-emerald-600 bg-emerald-600/10";
  return "text-muted-foreground bg-muted/20";
};

export const ViewBookingModal: React.FC<ViewBookingModalProps> = ({
  isOpen,
  onClose,
  booking,
}) => {
  if (!isOpen || !booking) return null;

  console.log("In Booking Model: ", booking);

  const details = booking.booking_details || {};
  const Icon = getBookingIcon(booking.booking_type_name);
  const colorClass = getBookingColor(booking.booking_type_name);

  const renderRow = (label: string, value: any) => {
    if (!value) return null;
    return (
      <div className="flex justify-between py-2 border-b last:border-0 border-border">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-sm font-medium">{value}</span>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorClass}`}
            >
              <Icon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">
                {booking.booking_type_name}
              </h3>
              <p className="text-sm text-muted-foreground">
                {booking.sub_option_name}
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* Status & Estimated Cost */}
          <div className="flex items-center justify-between">
            {/* <StatusBadge status={booking.status} /> */}
            <StatusBadge statusType="booking" status={booking.status} />
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Estimated Cost</p>
                <p className="text-xl font-semibold">
                  {formatCurrency(booking.estimated_cost)}
                </p>
              </div>
              <div className="text-right">
                {booking.actual_cost && (
                  <>
                    <p className="text-xs text-muted-foreground">Actual Cost</p>
                    <p className="text-xl font-semibold text-green-600">
                      {formatCurrency(booking.actual_cost)}
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Assigned Agent */}
          {booking.assigned_agent && (
            <div className="bg-muted/40 border rounded-lg p-3 space-y-3">
              <div className="flex items-center gap-2 border-b border-border pb-2">
                <User className="w-4 h-4 text-primary" />
                <p className="text-sm font-medium">Assigned Agent</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Name</p>
                  <p className="font-medium">{booking.assigned_agent.name}</p>
                </div>
                {booking.assigned_agent.organization_name && (
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Organization
                    </p>
                    <p className="font-medium">
                      {booking.assigned_agent.organization_name}
                    </p>
                  </div>
                )}
                {booking.assigned_agent.contact_person && (
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Contact Person
                    </p>
                    <p>{booking.assigned_agent.contact_person}</p>
                  </div>
                )}
                {booking.assigned_agent.phone && (
                  <div>
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <p>{booking.assigned_agent.phone}</p>
                  </div>
                )}
                {booking.assigned_agent.email && (
                  <div className="md:col-span-2">
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p>{booking.assigned_agent.email}</p>
                  </div>
                )}
                {booking.assigned_agent.address && (
                  <div className="md:col-span-2">
                    <p className="text-xs text-muted-foreground">Address</p>
                    <p className="whitespace-pre-wrap">
                      {booking.assigned_agent.address}
                    </p>
                  </div>
                )}
                <div className="md:col-span-2 pt-1 border-t border-dashed border-border mt-1">
                  <p className="text-xs text-muted-foreground">
                    Assigned at:{" "}
                    {formatDateTime(booking.assigned_agent.assigned_at)}
                  </p>
                </div>
              </div>
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

          {/* Flight / Train / Conveyance / Accommodation Schedule */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              Schedule
            </h4>

            <div className="bg-card border rounded-lg p-3 space-y-2">
              {/* FLIGHT / TRAIN */}
              {(details.departure_date || details.arrival_date) && (
                <>
                  {renderRow(
                    "Ticket Name/No.",
                    details?.ticket_number || "Not Provided",
                  )}
                  {renderRow(
                    "Departure Date",
                    formatDateToDDMMYYYY(details.departure_date),
                  )}
                  {renderRow(
                    "Departure Time",
                    formatTime(details.departure_time),
                  )}
                  {renderRow(
                    "Arrival Date",
                    formatDateToDDMMYYYY(details.arrival_date),
                  )}
                  {renderRow("Arrival Time", formatTime(details.arrival_time))}
                </>
              )}

              {/* ACCOMMODATION */}
              {(details.check_in_date || details.check_out_date) && (
                <>
                  {renderRow(
                    "Check-In Date",
                    formatDateToDDMMYYYY(details.check_in_date),
                  )}
                  {renderRow(
                    "Check-In Time",
                    formatTime(details.check_in_time),
                  )}
                  {renderRow(
                    "Check-Out Date",
                    formatDateToDDMMYYYY(details.check_out_date),
                  )}
                  {renderRow(
                    "Check-Out Time",
                    formatTime(details.check_out_time),
                  )}
                </>
              )}

              {/* CONVEYANCE */}
              {(details.start_date || details.start_time) && (
                <>
                  {renderRow(
                    "Start Date",
                    formatDateToDDMMYYYY(details.start_date),
                  )}
                  {renderRow("Start Time", formatTime(details.start_time))}
                </>
              )}
            </div>
          </div>

          {/* Ticket Details */}
          {(details.ticket_number ||
            details.report_at ||
            details.drop_location ||
            details.meal_preference) && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                Additional Details
              </h4>
              <div className="bg-card border rounded-lg p-3">
                {renderRow("Ticket Number", details.ticket_number)}
                {renderRow("Report At", details.report_at)}
                {renderRow("Drop Location", details.drop_location)}
                {renderRow("Club Booking", details.club_booking ? "Yes" : null)}
                {renderRow("Club Reason", details.club_reason)}
                {renderRow("Distance (km)", details.distance_km)}
                {renderRow("Meal Preference", details.meal_preference)}
              </div>
            </div>
          )}

          {/* Guests List */}
          {details.guests && details.guests.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />
                Guests
              </h4>
              <div className="flex flex-wrap gap-2">
                {details.guests.map((g: any, idx: number) => (
                  <Badge key={idx} variant="secondary">
                    {g.name}
                    {g.is_external ? " (External)" : ""}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Special Instructions */}
          {booking.special_instruction && (
            <div>
              <h4 className="text-sm font-medium">Special Instructions</h4>
              <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 mt-1 text-sm">
                {booking.special_instruction}
              </div>
            </div>
          )}

          {/* File */}
          {booking.booking_file && (
            <a
              onClick={() => docViewer.onViewFile(booking.booking_file)}
              rel="noopener noreferrer"
              className="text-primary text-sm underline flex items-center gap-2"
            >
              <FileText className="w-4 h-4" /> View Uploaded File
            </a>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex justify-end">
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
};
