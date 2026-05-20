// components/StatusBadge.tsx
import React from "react";
import { cn } from "@/lib/utils";

// ---------------- LABEL MAPPINGS ----------------

// Travel Application Statuses
const TRAVEL_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  pending_manager: "Pending by Manager",
  approved_manager: "Approved by Manager",
  rejected_manager: "Rejected by Manager",
  pending_chro: "Pending by CHRO",
  approved_chro: "Approved by CHRO",
  rejected_chro: "Rejected by CHRO",
  pending_ceo: "Pending by CEO",
  approved_ceo: "Approved by CEO",
  rejected_ceo: "Rejected by CEO",
  pending_travel_desk: "Pending by Travel Desk",
  booking_in_progress: "Booking in Progress",
  booked: "Booked",
  completed: "Completed",
  cancelled: "Cancelled",
  cancellation_requested: "Cancellation Requested",
};

// Travel Request Approval Statuses
const APPROVAL_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  skipped: "Skipped",
};

// Booking Statuses
const BOOKING_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  requested: "Requested",
  in_progress: "In Progress",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  completed: "Completed",
  closed: "Closed",
};

// Claim Statuses
const CLAIM_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  manager_pending: "Pending by Manager",
  finance_pending: "Pending by Finance",
  chro_pending: "Pending by CHRO",
  revision_required: "Revision Required",
  approved: "Approved",
  rejected: "Rejected",
  paid: "Processed",
  closed: "Closed",
};

// Expense Report Statuses
const EXPENSE_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

// ---------------- COLOR MAPPINGS ----------------

const STATUS_COLOR_MAP: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 border-gray-300",

  pending: "bg-yellow-50 text-yellow-700 border-yellow-300",
  requested: "bg-yellow-50 text-yellow-700 border-yellow-300",
  manager_pending: "bg-yellow-50 text-yellow-700 border-yellow-300",
  finance_pending: "bg-yellow-50 text-yellow-700 border-yellow-300",
  chro_pending: "bg-yellow-50 text-yellow-700 border-yellow-300",
  pending_manager: "bg-yellow-50 text-yellow-700 border-yellow-300",
  pending_chro: "bg-yellow-50 text-yellow-700 border-yellow-300",
  pending_ceo: "bg-yellow-50 text-yellow-700 border-yellow-300",
  pending_travel_desk: "bg-yellow-50 text-yellow-700 border-yellow-300",

  in_progress: "bg-blue-50 text-blue-700 border-blue-300",
  booking_in_progress: "bg-blue-50 text-blue-700 border-blue-300",

  approved: "bg-green-50 text-green-700 border-green-300",
  approved_manager: "bg-green-50 text-green-700 border-green-300",
  approved_chro: "bg-green-50 text-green-700 border-green-300",
  approved_ceo: "bg-green-50 text-green-700 border-green-300",

  confirmed: "bg-green-50 text-green-700 border-green-300",
  booked: "bg-green-50 text-green-700 border-green-300",

  revision_required: "bg-orange-50 text-orange-700 border-orange-300",

  completed: "bg-emerald-50 text-emerald-700 border-emerald-300",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-300",
  closed: "bg-gray-100 text-gray-700 border-gray-300",

  rejected: "bg-red-50 text-red-700 border-red-300",
  rejected_manager: "bg-red-50 text-red-700 border-red-300",
  rejected_chro: "bg-red-50 text-red-700 border-red-300",
  rejected_ceo: "bg-red-50 text-red-700 border-red-300",

  cancelled: "bg-red-50 text-red-700 border-red-300",
  cancellation_requested: "bg-red-50 text-red-700 border-red-300",
};

// -------------- SIZE + SHAPE VARIANTS ----------------

const SIZE_MAP = {
  xs: "text-[10px] px-2 py-0.5",
  sm: "text-xs px-2.5 py-0.5",
  md: "text-sm px-3 py-1",
};

const SHAPE_MAP = {
  soft: "rounded-md",
  solid: "rounded-md font-semibold text-white",
  pill: "rounded-full",
  rounded: "rounded-lg",
};

// ---------------- PROPS ----------------

interface StatusBadgeProps {
  statusType: "travel" | "approval" | "booking" | "claim" | "expense" | "generic";
  status: string;
  variant?: "soft" | "solid" | "pill" | "rounded";
  size?: "xs" | "sm" | "md";
  className?: string;
}

// ---------------- COMPONENT ----------------

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  statusType,
  status,
  variant = "pill",
  size = "sm",
  className,
}) => {
  const key = status.toLowerCase();

  // Merge correct label map based on the category
  const LABEL_MAP =
    statusType === "travel"
      ? TRAVEL_STATUS_LABELS
      : statusType === "approval"
      ? APPROVAL_STATUS_LABELS
      : statusType === "booking"
      ? BOOKING_STATUS_LABELS
      : statusType === "claim"
      ? CLAIM_STATUS_LABELS
      : statusType === "expense"
      ? EXPENSE_STATUS_LABELS
      : {};

  const label = LABEL_MAP[key] || status;
  const colorClass = STATUS_COLOR_MAP[key] || "bg-gray-100 text-gray-700 border-gray-300";

  return (
    <span
      className={cn(
        "inline-flex items-center border font-medium",
        SIZE_MAP[size],
        SHAPE_MAP[variant],
        colorClass,
        className
      )}
    >
      {label}
    </span>
  );
};
