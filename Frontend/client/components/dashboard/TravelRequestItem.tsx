import React from "react";

export type TravelStatus = "pending" | "approved" | "rejected";

interface TravelRequestProps {
  name: string;
  avatar: string;
  from: string;
  to: string;
  status: TravelStatus;
}

const STATUS_STYLES: Record<TravelStatus, string> = {
  pending: "bg-orange-50 text-orange-500",
  approved: "bg-green-50 text-green-600",
  rejected: "bg-red-50 text-red-500",
};

const STATUS_LABELS: Record<TravelStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

function TravelRequestItemBase({
  name,
  avatar,
  from,
  to,
  status,
}: TravelRequestProps) {
  return (
    <div className="flex items-center justify-between py-4">
      <div className="flex items-center gap-4">
        {/* <img
          src={avatar}
          alt={name}
          loading="lazy"
          decoding="async"
          className="h-12 w-12 rounded-md object-cover"
        /> */}
        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold">
          {avatar}
        </div>
        <div>
          <h4 className="text-lg font-medium text-foreground">{name}</h4>
          <div className="flex items-center gap-2 text-base text-secondary-foreground">
            <span>{from}</span>
            <span aria-hidden>→</span>
            <span>{to}</span>
          </div>
        </div>
      </div>
      <div
        className={`rounded px-3 py-1 text-sm font-medium ${STATUS_STYLES[status]}`}
      >
        {STATUS_LABELS[status]}
      </div>
    </div>
  );
}

export const TravelRequestItem = React.memo(TravelRequestItemBase);
