import React from "react";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Plane,
  Train,
  Car,
  FileText,
  CarTaxiFront,
  Building2,
  ArrowRight,
} from "lucide-react";
import type { Booking } from "@/src/api/bookingAgentAPI";
import { getBookingTypeLabel } from "../utils/format";

interface RecentBookingItemProps {
  booking: Booking;
  bookingTypeLabel: string;
  onClick?: () => void;
}

const getBookingIcon = (bookingType: string | undefined) => {
  if (!bookingType) return <Plane className="h-5 w-5 text-muted-foreground" />;

  switch (bookingType.toLowerCase()) {
    case "flight":
      return <Plane className="h-5 w-5 text-blue-600" />;
    case "train":
      return <Train className="h-5 w-5 text-purple-600" />;
    case "accommodation":
      return <Building2 className="h-5 w-5 text-green-600" />;
    case "bulk_booking":
    case "bulk booking":
      return <FileText className="h-5 w-5 text-blue-600" />;
    default:
      // Default maps to Car (Conveyance/Road/etc)
      return <Car className="h-5 w-5 text-orange-600" />;
  }
};

const getIconBgColor = (bookingType: string | undefined) => {
  if (!bookingType) return "bg-muted";

  switch (bookingType.toLowerCase()) {
    case "flight":
      return "bg-blue-50";
    case "train":
      return "bg-purple-50";
    case "accommodation":
      return "bg-green-50";
    case "bulk_booking":
    case "bulk booking":
      return "bg-blue-50";
    default:
      return "bg-orange-50";
  }
};

function getRouteDisplay(booking: Booking): { from: string; to: string } {
  const details = booking.booking_details || {};

  if (details.from_location_name && details.to_location_name) {
    return {
      from: details.from_location_name.split(" (")[0],
      to: details.to_location_name.split(" (")[0],
    };
  }

  if (details.from_location && details.to_location) {
    return {
      from: String(details.from_location),
      to: String(details.to_location),
    };
  }

  if (details.place) {
    return { from: details.place, to: "" };
  }

  return { from: "", to: "" };
}

function RecentBookingItemBase({ booking, onClick }: RecentBookingItemProps) {
  const route = getRouteDisplay(booking);
  // Use booking_type_name directly as it contains the label from API
  const typeLabel = booking.booking_type_name

  return (
    <div
      className="flex items-center justify-between py-4 cursor-pointer hover:bg-muted/30 -mx-2 px-2 rounded-md transition-colors"
      onClick={onClick}
    >
      <div className="flex items-center gap-4">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-md ${getIconBgColor(booking.booking_type_name)}`}
        >
          {getBookingIcon(booking.booking_type_name)}
        </div>
        <div>
          <h4 className="text-base font-medium text-foreground">{typeLabel}</h4>
          {booking.travel_request_id && (
            <p className="text-xs font-medium text-slate-700 mt-0.5">
              {booking.travel_request_id}
            </p>
          )}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{route.from}</span>
            {route.to && (
              <>
                <ArrowRight className="h-3 w-3" />
                <span>{route.to}</span>
              </>
            )}
          </div>
        </div>
      </div>
      {/* <StatusBadge status={booking.status} /> */}
      <StatusBadge statusType="booking" status={booking.status} />
    </div>
  );
}

export const RecentBookingItem = React.memo(RecentBookingItemBase);
