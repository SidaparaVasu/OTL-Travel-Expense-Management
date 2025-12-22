import React from "react";

export type ReportStatus = "pending" | "approved" | "rejected";

interface ExpenseReportProps {
  title: string;
  submittedBy: string;
  amount: string;
  status: ReportStatus;
}

const STATUS_STYLES: Record<ReportStatus, string> = {
  pending: "bg-orange-50 text-orange-500",
  approved: "bg-green-50 text-green-600",
  rejected: "bg-red-50 text-red-500",
};

const STATUS_LABELS: Record<ReportStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

function ExpenseReportItemBase({
  title,
  submittedBy,
  amount,
  status,
}: ExpenseReportProps) {
  return (
    <div className="flex items-center justify-between py-4">
      <div>
        <h4 className="text-lg font-medium text-foreground">{title}</h4>
        <p className="text-base text-secondary-foreground">{submittedBy}</p>
      </div>
      <div className="flex flex-col items-center">
        <p className="text-lg font-bold text-foreground">{amount}</p>
        <div
          className={`rounded px-3 py-1 text-sm font-medium ${STATUS_STYLES[status]}`}
        >
          {STATUS_LABELS[status]}
        </div>
      </div>
    </div>
  );
}

export const ExpenseReportItem = React.memo(ExpenseReportItemBase);
