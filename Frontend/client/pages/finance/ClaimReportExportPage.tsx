import React, { useState, useEffect, useCallback } from "react";
import {
  Download,
  Search,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Loader2,
  CalendarDays,
  TrendingUp,
  Users,
  MapPin,
  ChevronDown,
  ChevronUp,
  IndianRupee,
  Clock,
  Building2,
  Filter,
} from "lucide-react";
import { expenseAPI } from "@/src/api/expense";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type NotificationType = "success" | "error" | "info";

interface Notification {
  message: string;
  type: NotificationType;
}

interface DABreakdownEntry {
  date: string;
  hours: number;
  da: number;
  incidental: number;
}

interface ClaimReportRow {
  claim_id: number;
  travel_request_id: string | null;
  employee_name: string;
  employee_id: string;
  unit_location: string | null;
  trip_start: string;
  origin: string | null;
  trip_end: string;
  destination: string | null;
  total_da: number;
  total_incidental: number;
  total_booking_expenses: number;
  total_additional_expenses: number;
  total_expenses: number;
  advance_received: number;
  final_amount_payable: number;
  status_code: string | null;
  status_label: string | null;
  created_on: string;
  da_breakdown: DABreakdownEntry[];
}

interface ClaimReportResponse {
  success: boolean;
  data: {
    total: number;
    total_final_payable: number;
    status_summary: Record<string, number>;
    start_date: string | null;
    end_date: string | null;
    results: ClaimReportRow[];
  };
}

interface Location {
  id: number;
  name: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const CLAIM_STATUSES = [
  { code: "", label: "All Statuses" },
  { code: "draft", label: "Draft" },
  { code: "submitted", label: "Submitted" },
  { code: "manager_pending", label: "Manager Pending" },
  { code: "finance_pending", label: "Finance Pending" },
  { code: "approved", label: "Approved" },
  { code: "rejected", label: "Rejected" },
  { code: "paid", label: "Processed" },
  { code: "closed", label: "Closed" },
];

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  submitted: "bg-blue-100 text-blue-700",
  manager_pending: "bg-yellow-100 text-yellow-700",
  finance_pending: "bg-orange-100 text-orange-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  paid: "bg-emerald-100 text-emerald-700",
  closed: "bg-slate-100 text-slate-700",
};

const LABEL_STATUS_COLORS: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-700",
  Submitted: "bg-blue-100 text-blue-700",
  "Manager Pending": "bg-yellow-100 text-yellow-700",
  "Finance Pending": "bg-orange-100 text-orange-700",
  Approved: "bg-green-100 text-green-700",
  Rejected: "bg-red-100 text-red-700",
  Processed: "bg-emerald-100 text-emerald-700",
  Paid: "bg-emerald-100 text-emerald-700",
  Closed: "bg-slate-100 text-slate-700",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const fmtCurrency = (v: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(v);

const fmtDisplayDate = (d: string | null) => {
  if (!d) return "—";
  const parsed = new Date(d + "T00:00:00");
  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const statusBadgeClass = (code: string | null) =>
  STATUS_COLORS[code ?? ""] ?? "bg-gray-100 text-gray-600";

const labelBadgeClass = (label: string) =>
  LABEL_STATUS_COLORS[label] ?? "bg-gray-100 text-gray-600";

const triggerBlobDownload = (
  blob: Blob,
  startDate: string,
  endDate: string
) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute(
    "download",
    `claim_report_${startDate || "all"}_to_${endDate || "all"}.xlsx`
  );
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const NotificationBanner: React.FC<{
  notification: Notification | null;
  onClose: () => void;
}> = ({ notification, onClose }) => {
  if (!notification) return null;

  const styles: Record<NotificationType, string> = {
    success: "bg-green-50 border-green-300 text-green-800",
    error: "bg-red-50 border-red-300 text-red-800",
    info: "bg-blue-50 border-blue-300 text-blue-800",
  };

  const Icon =
    notification.type === "success" ? CheckCircle2 : AlertCircle;

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-lg border mb-4 ${styles[notification.type]}`}
    >
      <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
      <p className="text-sm flex-1">{notification.message}</p>
      <button
        onClick={onClose}
        className="text-current opacity-60 hover:opacity-100 text-lg leading-none"
      >
        ×
      </button>
    </div>
  );
};

const SummaryCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
}> = ({ icon, label, value, color }) => (
  <div className={`rounded-xl p-4 flex items-center gap-4 ${color}`}>
    <div className="p-2 bg-white bg-opacity-60 rounded-lg">{icon}</div>
    <div>
      <p className="text-xs font-medium opacity-70 uppercase tracking-wide">
        {label}
      </p>
      <p className="text-xl font-bold leading-tight">{value}</p>
    </div>
  </div>
);

const DABreakdownTable: React.FC<{ entries: DABreakdownEntry[] }> = ({
  entries,
}) => {
  if (!entries.length) {
    return (
      <p className="text-xs text-slate-400 py-2">No DA breakdown available.</p>
    );
  }
  return (
    <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
      <thead>
        <tr className="bg-slate-50">
          <th className="text-left px-3 py-2 font-semibold text-slate-500 uppercase tracking-wide">
            Date
          </th>
          <th className="text-center px-3 py-2 font-semibold text-slate-500 uppercase tracking-wide">
            Duration (Hrs)
          </th>
          <th className="text-right px-3 py-2 font-semibold text-slate-500 uppercase tracking-wide">
            DA (₹)
          </th>
          <th className="text-right px-3 py-2 font-semibold text-slate-500 uppercase tracking-wide">
            Incidentals (₹)
          </th>
        </tr>
      </thead>
      <tbody>
        {entries.map((e, i) => (
          <tr
            key={i}
            className={`border-t border-gray-100 ${i % 2 === 0 ? "" : "bg-slate-50/50"}`}
          >
            <td className="px-3 py-1.5 text-slate-700">{e.date}</td>
            <td className="px-3 py-1.5 text-center text-slate-600">
              {e.hours}
            </td>
            <td className="px-3 py-1.5 text-right text-slate-700">
              {fmtCurrency(e.da)}
            </td>
            <td className="px-3 py-1.5 text-right text-slate-700">
              {fmtCurrency(e.incidental)}
            </td>
          </tr>
        ))}
        <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
          <td className="px-3 py-2 text-slate-700">Total</td>
          <td className="px-3 py-2" />
          <td className="px-3 py-2 text-right text-slate-800">
            {fmtCurrency(entries.reduce((s, e) => s + e.da, 0))}
          </td>
          <td className="px-3 py-2 text-right text-slate-800">
            {fmtCurrency(entries.reduce((s, e) => s + e.incidental, 0))}
          </td>
        </tr>
      </tbody>
    </table>
  );
};

const ClaimRow: React.FC<{ row: ClaimReportRow; idx: number }> = ({
  row,
  idx,
}) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        className={`border-b border-gray-100 hover:bg-slate-50/70 transition-colors cursor-pointer ${
          idx % 2 === 0 ? "" : "bg-gray-50/40"
        }`}
        onClick={() => setExpanded((p) => !p)}
      >
        {/* # */}
        <td className="px-4 py-3 text-slate-400 text-xs">{idx + 1}</td>

        {/* Travel Request ID */}
        <td className="px-4 py-3 font-mono text-xs text-blue-700 whitespace-nowrap">
          {row.travel_request_id || "—"}
          <div className="text-slate-400 font-sans mt-0.5">
            Claim #{row.claim_id}
          </div>
        </td>

        {/* Employee */}
        <td className="px-4 py-3 whitespace-nowrap">
          <div className="font-medium text-slate-800 text-sm">
            {row.employee_name}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">{row.employee_id}</div>
        </td>

        {/* Unit Location */}
        <td className="px-4 py-3 text-slate-600 text-sm whitespace-nowrap">
          <div className="flex items-center gap-1">
            <Building2 className="w-3 h-3 text-slate-400" />
            {row.unit_location || "—"}
          </div>
        </td>

        {/* Trip Start + Origin */}
        <td className="px-4 py-3 whitespace-nowrap">
          <div className="text-slate-700 text-xs">
            <div className="font-medium">{row.trip_start || "—"}</div>
            {row.origin && (
              <div className="text-slate-400 mt-0.5 flex items-center gap-1">
                <MapPin className="w-2.5 h-2.5" />
                {row.origin}
              </div>
            )}
          </div>
        </td>

        {/* Trip End + Destination */}
        <td className="px-4 py-3 whitespace-nowrap">
          <div className="text-slate-700 text-xs">
            <div className="font-medium">{row.trip_end || "—"}</div>
            {row.destination && (
              <div className="text-slate-400 mt-0.5 flex items-center gap-1">
                <MapPin className="w-2.5 h-2.5" />
                {row.destination}
              </div>
            )}
          </div>
        </td>

        {/* Final Payable */}
        <td className="px-4 py-3 text-right whitespace-nowrap">
          <span
            className={`font-semibold text-sm ${
              row.final_amount_payable >= 0
                ? "text-emerald-700"
                : "text-red-600"
            }`}
          >
            {fmtCurrency(row.final_amount_payable)}
          </span>
        </td>

        {/* Status */}
        <td className="px-4 py-3 whitespace-nowrap">
          <span
            className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusBadgeClass(row.status_code)}`}
          >
            {row.status_label || "—"}
          </span>
        </td>

        {/* Expand toggle */}
        <td className="px-3 py-3 text-slate-400">
          {expanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </td>
      </tr>

      {/* Expanded detail row */}
      {expanded && (
        <tr className="bg-slate-50 border-b border-slate-200">
          <td colSpan={9} className="px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Financials */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Financial Summary
                </p>
                <div className="space-y-1.5">
                  {[
                    ["Total DA", row.total_da],
                    ["Total Incidentals", row.total_incidental],
                    ["Booking Expenses", row.total_booking_expenses],
                    ["Additional Expenses", row.total_additional_expenses],
                    ["Advance Received", row.advance_received],
                  ].map(([label, val]) => (
                    <div
                      key={label as string}
                      className="flex justify-between text-sm"
                    >
                      <span className="text-slate-500">{label as string}</span>
                      <span className="font-medium text-slate-700">
                        {fmtCurrency(val as number)}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm border-t pt-1.5 mt-1">
                    <span className="font-semibold text-slate-700">
                      Final Payable
                    </span>
                    <span
                      className={`font-bold ${
                        row.final_amount_payable >= 0
                          ? "text-emerald-700"
                          : "text-red-600"
                      }`}
                    >
                      {fmtCurrency(row.final_amount_payable)}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-3">
                  Submitted: {row.created_on || "—"}
                </p>
              </div>

              {/* DA Breakdown */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Daily Allowance Breakdown
                </p>
                <DABreakdownTable entries={row.da_breakdown} />
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function ClaimReportExportPage() {
  // ---- Filter state ----
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusCode, setStatusCode] = useState("");
  const [locationId, setLocationId] = useState<string>("all");
  const [search, setSearch] = useState("");

  const [dateErrors, setDateErrors] = useState<{
    start?: string;
    end?: string;
  }>({});

  // ---- Data state ----
  const [preview, setPreview] = useState<ClaimReportResponse["data"] | null>(
    null
  );
  const [locations, setLocations] = useState<Location[]>([]);
  const [isGlobalFinance, setIsGlobalFinance] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [notification, setNotification] = useState<Notification | null>(null);

  // ---- Load assigned locations on mount ----
  useEffect(() => {
    expenseAPI.finance
      .getAssignedLocations()
      .then((res) => {
        setLocations(res.data || []);
        // Backend returns an empty array if user is global
        if (!res.data || res.data.length === 0) {
          setIsGlobalFinance(true);
        }
      })
      .catch(() => {
        /* silently skip — user will still see all/no filter */
      });
  }, []);

  const showNotification = (message: string, type: NotificationType) =>
    setNotification({ message, type });

  // ---- Validation ----
  const validate = (): boolean => {
    const errors: { start?: string; end?: string } = {};
    if (!startDate) errors.start = "Start date is required.";
    if (!endDate) errors.end = "End date is required.";
    if (startDate && endDate) {
      if (startDate > endDate)
        errors.end = "End date must be on or after start date.";
      const diff =
        (new Date(endDate).getTime() - new Date(startDate).getTime()) /
        86400000;
      if (diff > 366)
        errors.end = "Date range cannot exceed 1 year (366 days).";
    }
    setDateErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ---- Build params ----
  const buildParams = useCallback(() => {
    const p: Record<string, string | number> = {};
    if (startDate) p.start_date = startDate;
    if (endDate) p.end_date = endDate;
    if (statusCode) p.status = statusCode;
    if (locationId !== "all") p.location_id = locationId;
    if (search.trim()) p.search = search.trim();
    return p;
  }, [startDate, endDate, statusCode, locationId, search]);

  // ---- Fetch preview ----
  const handleFetch = async () => {
    if (!validate()) return;
    setIsFetching(true);
    setPreview(null);
    setNotification(null);

    try {
      const resp: ClaimReportResponse = await expenseAPI.finance.getClaimReport(
        buildParams() as any
      );
      if (!resp.success) throw new Error("Server returned failure response.");
      setPreview(resp.data);
      if (resp.data.total === 0) {
        showNotification(
          "No claims found for the selected filters.",
          "info"
        );
      } else {
        showNotification(
          `Found ${resp.data.total} claim${resp.data.total !== 1 ? "s" : ""}.`,
          "success"
        );
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to fetch data. Please try again.";
      showNotification(msg, "error");
    } finally {
      setIsFetching(false);
    }
  };

  // ---- Download Excel ----
  const handleDownload = async () => {
    if (!validate()) return;
    setIsDownloading(true);
    setNotification(null);

    try {
      const blob = await expenseAPI.finance.exportClaimReport(
        buildParams() as any
      );
      triggerBlobDownload(blob, startDate, endDate);
      showNotification("Excel file downloaded successfully.", "success");
    } catch (err: any) {
      showNotification(
        err?.response?.data?.message ||
          "Failed to download the file. Please try again.",
        "error"
      );
    } finally {
      setIsDownloading(false);
    }
  };

  // ---- Date live validation ----
  const handleStartDateChange = (v: string) => {
    setStartDate(v);
    setDateErrors((p) => ({ ...p, start: undefined }));
    if (endDate && v > endDate)
      setDateErrors((p) => ({
        ...p,
        end: "End date must be on or after start date.",
      }));
    else setDateErrors((p) => ({ ...p, end: undefined }));
  };

  const handleEndDateChange = (v: string) => {
    setEndDate(v);
    setDateErrors((p) => ({ ...p, end: undefined }));
    if (startDate && v < startDate)
      setDateErrors((p) => ({
        ...p,
        end: "End date must be on or after start date.",
      }));
  };

  const hasData = !!preview && preview.total > 0;

  // ---- Location select logic ----
  const isSingleLocation = !isGlobalFinance && locations.length === 1;
  useEffect(() => {
    if (isSingleLocation) setLocationId(String(locations[0].id));
  }, [isSingleLocation, locations]);

  // ---- Render ----
  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 bg-blue-100 rounded-lg">
            <FileSpreadsheet className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">
              Claim Report
            </h1>
            <p className="text-sm text-slate-500">
              View and export expense claim data across all statuses.
            </p>
          </div>
        </div>
      </div>

      {/* Notification */}
      <NotificationBanner
        notification={notification}
        onClose={() => setNotification(null)}
      />

      {/* ── Filter Panel ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-base font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <Filter className="w-4 h-4 text-blue-500" />
          Filters
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              From Date <span className="text-red-500">*</span>
            </label>
            <input
              id="claim-report-start-date"
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={(e) => handleStartDateChange(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                dateErrors.start
                  ? "border-red-400 bg-red-50"
                  : "border-gray-300 bg-white"
              }`}
            />
            {dateErrors.start && (
              <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {dateErrors.start}
              </p>
            )}
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              To Date <span className="text-red-500">*</span>
            </label>
            <input
              id="claim-report-end-date"
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => handleEndDateChange(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                dateErrors.end
                  ? "border-red-400 bg-red-50"
                  : "border-gray-300 bg-white"
              }`}
            />
            {dateErrors.end && (
              <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {dateErrors.end}
              </p>
            )}
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Status
            </label>
            <select
              id="claim-report-status"
              value={statusCode}
              onChange={(e) => setStatusCode(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {CLAIM_STATUSES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Unit Location
            </label>
            {isSingleLocation ? (
              <div className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-slate-600 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-400" />
                {locations[0].name}
              </div>
            ) : (
              <select
                id="claim-report-location"
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="all">
                  {isGlobalFinance ? "All Locations" : "All Assigned Locations"}
                </option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Search */}
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="claim-report-search"
                type="text"
                placeholder="Employee name, ID, travel request ID…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleFetch()}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-end gap-2">
            <button
              id="claim-report-fetch-btn"
              onClick={handleFetch}
              disabled={isFetching || isDownloading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {isFetching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              {isFetching ? "Fetching…" : "Fetch Data"}
            </button>

            <button
              id="claim-report-export-btn"
              onClick={handleDownload}
              disabled={isDownloading || isFetching || !hasData}
              title={
                !hasData ? "Fetch data first before downloading" : "Export Excel"
              }
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isDownloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {isDownloading ? "Exporting…" : "Export Excel"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Preview Section ── */}
      {preview && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <SummaryCard
              icon={<Users className="w-5 h-5 text-blue-600" />}
              label="Total Claims"
              value={preview.total}
              color="bg-blue-50 text-blue-800 border border-blue-200"
            />
            <SummaryCard
              icon={<IndianRupee className="w-5 h-5 text-emerald-600" />}
              label="Total Final Payable"
              value={fmtCurrency(preview.total_final_payable)}
              color="bg-emerald-50 text-emerald-800 border border-emerald-200"
            />
            <SummaryCard
              icon={<TrendingUp className="w-5 h-5 text-purple-600" />}
              label="Unique Statuses"
              value={Object.keys(preview.status_summary).length}
              color="bg-purple-50 text-purple-800 border border-purple-200"
            />
            <SummaryCard
              icon={<CalendarDays className="w-5 h-5 text-amber-600" />}
              label="Date Range"
              value={`${fmtDisplayDate(preview.start_date)} → ${fmtDisplayDate(preview.end_date)}`}
              color="bg-amber-50 text-amber-800 border border-amber-200"
            />
          </div>

          {/* Data table */}
          {preview.total > 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {/* Table header bar */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-wrap gap-3">
                <h3 className="text-sm font-semibold text-slate-700">
                  {preview.total} Claim{preview.total !== 1 ? "s" : ""} Found
                </h3>
                {/* Status breakdown pills */}
                <div className="flex flex-wrap gap-2">
                  {Object.entries(preview.status_summary).map(
                    ([lbl, cnt]) => (
                      <span
                        key={lbl}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${labelBadgeClass(lbl)}`}
                      >
                        {lbl}
                        <span className="font-bold">{cnt}</span>
                      </span>
                    )
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-gray-200">
                      {[
                        "#",
                        "Travel Request ID",
                        "Employee",
                        "Unit Location",
                        "Trip Start / Origin",
                        "Trip End / Destination",
                        "Final Payable",
                        "Status",
                        "",
                      ].map((h, i) => (
                        <th
                          key={i}
                          className={`px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap ${
                            h === "Final Payable" ? "text-right" : "text-left"
                          }`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.results.map((row, idx) => (
                      <ClaimRow key={row.claim_id} row={row} idx={idx} />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div className="px-5 py-3 bg-slate-50 border-t border-gray-100 flex items-center justify-between">
                <p className="text-xs text-slate-400">
                  Showing {preview.results.length} of {preview.total} claim
                  {preview.total !== 1 ? "s" : ""}. Click any row to expand DA
                  breakdown.
                </p>
                <button
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-60 transition-colors"
                >
                  {isDownloading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  {isDownloading ? "Exporting…" : "Export as Excel"}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <FileSpreadsheet className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No records found</p>
              <p className="text-sm text-slate-400 mt-1">
                Try adjusting the date range or filters.
              </p>
            </div>
          )}
        </>
      )}

      {/* Empty state (before first fetch) */}
      {!preview && !isFetching && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-16 text-center">
          <FileSpreadsheet className="w-14 h-14 text-blue-200 mx-auto mb-4" />
          <p className="text-slate-500 font-medium text-lg">
            Select filters and click "Fetch Data"
          </p>
          <p className="text-sm text-slate-400 mt-2 max-w-md mx-auto">
            View and export expense claims across any status. You can filter by
            date range, claim status, unit location, or search by employee/claim
            ID.
          </p>
        </div>
      )}

      {/* Loading skeleton */}
      {isFetching && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-200 rounded w-1/4" />
            <div className="h-4 bg-gray-200 rounded w-full" />
            <div className="h-4 bg-gray-200 rounded w-full" />
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-4 bg-gray-200 rounded w-full" />
            <div className="h-4 bg-gray-200 rounded w-5/6" />
          </div>
        </div>
      )}
    </div>
  );
}
