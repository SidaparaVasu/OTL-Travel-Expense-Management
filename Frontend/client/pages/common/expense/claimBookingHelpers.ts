import type { BookingClosureLog } from "@/src/constants/booking-closure";

export interface ClaimBookingLike {
  id: number;
  status: string;
  allow_claim?: boolean | null;
  booking_type_id?: number;
  booking_type?: number;
  booking_type_name?: string;
  sub_option_name?: string;
  estimated_cost?: string | number | null;
  booking_file?: string | null;
  closure_logs?: BookingClosureLog[];
}

export function isClaimableBookingForExpense(booking: ClaimBookingLike): boolean {
  if (booking.status === "completed") return true;
  if (booking.status === "closed" && booking.allow_claim === true) return true;
  return false;
}

export function isClosedNonClaimableBooking(booking: ClaimBookingLike): boolean {
  return booking.status === "closed" && booking.allow_claim === false;
}

export function getClosedBookingClosureInfo(booking: ClaimBookingLike) {
  const logs = booking.closure_logs || [];
  const closedLog =
    logs.find((log) => log.action === "closed") ||
    logs.find((log) => Boolean(log.closure_reason)) ||
    logs[0];

  const latestLog = logs.length > 0 ? logs[logs.length - 1] : null;

  return {
    closureReason: closedLog?.closure_reason || "",
    claimDecisionReason:
      latestLog?.claim_decision_reason || closedLog?.claim_decision_reason || "",
    allowClaim: booking.allow_claim === true,
  };
}

export function buildClaimableBookingRow(booking: ClaimBookingLike, trip: any) {
  const closureInfo =
    booking.status === "closed" ? getClosedBookingClosureInfo(booking) : null;

  return {
    bookingId: booking.id,
    expense_type: booking.booking_type_id || booking.booking_type || "",
    expense_date: trip?.departure_date || "",
    typeName: booking.booking_type_name || "",
    subType: booking.sub_option_name || "",
    estimated: Number(booking.estimated_cost || 0),
    amount: Number(booking.estimated_cost || 0),
    booking_file: booking.booking_file,
    has_receipt: Boolean(booking.booking_file),
    receipt_file: null,
    distance_km: "",
    remarks: "",
    isDeskClosed: booking.status === "closed",
    closureReason: closureInfo?.closureReason || "",
    claimDecisionReason: closureInfo?.claimDecisionReason || "",
  };
}
