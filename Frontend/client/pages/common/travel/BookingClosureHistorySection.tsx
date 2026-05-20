import React from "react";
import type { BookingClosureLog } from "@/src/constants/booking-closure";

interface BookingClosureHistorySectionProps {
  closureLogs: BookingClosureLog[];
  allowClaim?: boolean | null;
}

export const BookingClosureHistorySection: React.FC<
  BookingClosureHistorySectionProps
> = ({ closureLogs, allowClaim }) => {
  if ((!closureLogs || closureLogs.length === 0) && allowClaim == null) {
    return null;
  }

  return (
    <div className="space-y-3">
      {allowClaim != null && (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
          <span className="font-medium text-slate-700">
            Current claim eligibility:{" "}
          </span>
          <span
            className={
              allowClaim
                ? "text-emerald-700 font-medium"
                : "text-red-700 font-medium"
            }
          >
            {allowClaim ? "Allowed" : "Not Allowed"}
          </span>
        </div>
      )}

      {closureLogs?.length > 0 && (
        <div className="space-y-3">
          {closureLogs.map((log, index) => (
            <div
              key={`${log.created_at}-${index}`}
              className="rounded-md border border-slate-200 bg-white p-3 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="font-medium text-slate-700">
                  {log.action_label}
                </span>
                <span>•</span>
                <span>{log.created_at}</span>
                <span>•</span>
                <span>{log.created_by_name}</span>
              </div>

              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {log.closure_reason ? (
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Closure Reason
                    </div>
                    <div className="text-slate-900">{log.closure_reason}</div>
                  </div>
                ) : null}

                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Claim Decision
                  </div>
                  <div className="text-slate-900">
                    {log.allow_claim_label} — {log.claim_decision_reason}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
