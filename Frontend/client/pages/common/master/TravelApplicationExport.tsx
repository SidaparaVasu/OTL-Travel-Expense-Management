import React, { useState } from "react";
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
  Clock,
} from "lucide-react";
import {
  fetchTravelExportPreview,
  downloadTravelExport,
  type TravelExportPreviewRecord,
  type TravelExportPreviewResponse,
} from "@/src/api/travel-export";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type NotificationType = "success" | "error" | "info";

interface Notification {
  message: string;
  type: NotificationType;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const today = () => new Date().toISOString().split("T")[0];

const formatDisplayDate = (dateStr: string): string => {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const STATUS_COLORS: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-700",
  Submitted: "bg-blue-100 text-blue-700",
  "Pending Manager Approval": "bg-yellow-100 text-yellow-700",
  "Approved by Manager": "bg-green-100 text-green-700",
  "Rejected by Manager": "bg-red-100 text-red-700",
  "Pending CHRO Approval": "bg-orange-100 text-orange-700",
  "Approved by CHRO": "bg-green-100 text-green-700",
  "Rejected by CHRO": "bg-red-100 text-red-700",
  "Pending CEO Approval": "bg-purple-100 text-purple-700",
  "Approved by CEO": "bg-green-100 text-green-700",
  "Rejected by CEO": "bg-red-100 text-red-700",
  "Pending Travel Desk": "bg-indigo-100 text-indigo-700",
  "Booking in Progress": "bg-cyan-100 text-cyan-700",
  "Bookings Confirmed": "bg-teal-100 text-teal-700",
  "Travel Completed": "bg-emerald-100 text-emerald-700",
  "Cancellation Requested": "bg-amber-100 text-amber-700",
  Cancelled: "bg-red-100 text-red-700",
};

const statusBadgeClass = (status: string) =>
  STATUS_COLORS[status] ?? "bg-gray-100 text-gray-600";

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
    notification.type === "success"
      ? CheckCircle2
      : notification.type === "error"
        ? AlertCircle
        : AlertCircle;

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
      <p className="text-xs font-medium opacity-70 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function TravelApplicationExportPage() {
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [travelFor, setTravelFor] = useState<"" | "self" | "guest">("");
  const [dateErrors, setDateErrors] = useState<{ start?: string; end?: string }>({});

  const [preview, setPreview] = useState<TravelExportPreviewResponse | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [notification, setNotification] = useState<Notification | null>(null);

  // ---- Validation ----
  const validate = (): boolean => {
    const errors: { start?: string; end?: string } = {};

    if (!startDate) {
      errors.start = "Start date is required.";
    }
    if (!endDate) {
      errors.end = "End date is required.";
    }
    if (startDate && endDate) {
      if (startDate > endDate) {
        errors.end = "End date must be on or after start date.";
      }
      // Warn if range exceeds 1 year
      const diffMs =
        new Date(endDate).getTime() - new Date(startDate).getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      if (diffDays > 366) {
        errors.end = "Date range cannot exceed 1 year (366 days).";
      }
    }

    setDateErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const showNotification = (message: string, type: NotificationType) => {
    setNotification({ message, type });
  };

  // ---- Fetch Preview ----
  const handleFetch = async () => {
    if (!validate()) return;

    setIsFetching(true);
    setPreview(null);
    setNotification(null);

    try {
      const data = await fetchTravelExportPreview(
        startDate,
        endDate,
        travelFor || undefined,
      );
      setPreview(data);
      if (data.total === 0) {
        showNotification(
          "No travel applications found for the selected date range.",
          "info",
        );
      } else {
        showNotification(
          `Found ${data.total} travel application${data.total !== 1 ? "s" : ""} in the selected range.`,
          "success",
        );
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.errors?.detail ||
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
      await downloadTravelExport(startDate, endDate, travelFor || undefined);
      showNotification("Excel file downloaded successfully.", "success");
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        "Failed to download the file. Please try again.";
      showNotification(msg, "error");
    } finally {
      setIsDownloading(false);
    }
  };

  // ---- Date change handlers with live validation ----
  const handleStartDateChange = (value: string) => {
    setStartDate(value);
    setDateErrors((prev) => ({ ...prev, start: undefined }));
    // Re-validate end date if already set
    if (endDate && value > endDate) {
      setDateErrors((prev) => ({
        ...prev,
        end: "End date must be on or after start date.",
      }));
    } else {
      setDateErrors((prev) => ({ ...prev, end: undefined }));
    }
  };

  const handleEndDateChange = (value: string) => {
    setEndDate(value);
    setDateErrors((prev) => ({ ...prev, end: undefined }));
    if (startDate && value < startDate) {
      setDateErrors((prev) => ({
        ...prev,
        end: "End date must be on or after start date.",
      }));
    }
  };

  const hasPreviewData = preview && preview.total > 0;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* ---- Page Header ---- */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-semibold text-slate-800">
            Travel Applications Export
          </h1>
        </div>
        <p className="text-sm text-slate-500">
          Select a date range to fetch and export travel applications as an
          Excel file.
        </p>
      </div>

      {/* ---- Notification ---- */}
      <NotificationBanner
        notification={notification}
        onClose={() => setNotification(null)}
      />

      {/* ---- Filter Card ---- */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-base font-semibold text-slate-700 mb-1 flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-blue-500" />
          Select Trip Start Date Range
        </h2>
        <p className="text-xs text-slate-400 mb-4">
          Fetches all applications whose <strong>trip start date</strong> falls
          within the selected range.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          {/* From Date */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Trip Start Date — From <span className="text-red-500">*</span>
            </label>
            <input
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

          {/* To Date */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Trip Start Date — To <span className="text-red-500">*</span>
            </label>
            <input
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

          {/* Travel For filter */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Travel For
            </label>
            <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
              {(
                [
                  { value: "", label: "All" },
                  { value: "self", label: "Self" },
                  { value: "guest", label: "Guest" },
                ] as { value: "" | "self" | "guest"; label: string }[]
              ).map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTravelFor(value)}
                  className={`flex-1 py-2 font-medium transition-colors ${
                    travelFor === value
                      ? "bg-blue-600 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Fetch Button */}
          <div>
            <button
              onClick={handleFetch}
              disabled={isFetching || isDownloading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {isFetching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              {isFetching ? "Fetching…" : "Fetch Data"}
            </button>
          </div>

          {/* Download Button */}
          <div>
            <button
              onClick={handleDownload}
              disabled={isDownloading || isFetching || !hasPreviewData}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title={
                !hasPreviewData
                  ? "Fetch data first before downloading"
                  : "Download as Excel"
              }
            >
              {isDownloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {isDownloading ? "Downloading…" : "Export Excel"}
            </button>
          </div>
        </div>
      </div>

      {/* ---- Preview Section ---- */}
      {preview && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <SummaryCard
              icon={<Users className="w-5 h-5 text-blue-600" />}
              label="Total Applications"
              value={preview.total}
              color="bg-blue-50 text-blue-800 border border-blue-200"
            />
            <SummaryCard
              icon={<TrendingUp className="w-5 h-5 text-blue-600" />}
              label="Unique Statuses"
              value={Object.keys(preview.status_summary).length}
              color="bg-blue-50 text-blue-800 border border-blue-200"
            />
            <SummaryCard
              icon={<CalendarDays className="w-5 h-5 text-blue-600" />}
              label="From"
              value={formatDisplayDate(preview.start_date)}
              color="bg-blue-50 text-blue-800 border border-blue-200"
            />
            <SummaryCard
              icon={<CalendarDays className="w-5 h-5 text-blue-600" />}
              label="To"
              value={formatDisplayDate(preview.end_date)}
              color="bg-blue-50 text-blue-800 border border-blue-200"
            />
          </div>

          {/* Data Table */}
          {preview.total > 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-slate-700">
                  Total {preview.total} Record
                  {preview.total !== 1 ? "s" : ""}
                </h3>
                {/* Status Breakdown */}
                {Object.keys(preview.status_summary).length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(preview.status_summary).map(
                      ([statusLabel, count]) => (
                        <span
                          key={statusLabel}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${statusBadgeClass(statusLabel)}`}
                        >
                          {statusLabel}
                          <span className="font-bold">{count}</span>
                        </span>
                      ),
                    )}
                  </div>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-gray-200">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                        #
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                        Travel Request ID
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                        Travel For
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                        Username
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                        Employee Name
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        Purpose
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                        Status
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                        <MapPin className="w-3 h-3 inline mr-1" />
                        Origin
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                        <MapPin className="w-3 h-3 inline mr-1" />
                        Destination
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                        <Clock className="w-3 h-3 inline mr-1" />
                        Start
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                        <Clock className="w-3 h-3 inline mr-1" />
                        End
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.records.map(
                      (rec: TravelExportPreviewRecord, idx: number) => (
                        <tr
                          key={rec.travel_request_id}
                          className={`border-b border-gray-100 hover:bg-slate-50 transition-colors ${
                            idx % 2 === 0 ? "" : "bg-gray-50/50"
                          }`}
                        >
                          <td className="px-4 py-3 text-slate-400 text-xs">
                            {idx + 1}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-blue-700 whitespace-nowrap">
                            {rec.travel_request_id}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                                rec.travel_for === "Self"
                                  ? "bg-indigo-100 text-indigo-700"
                                  : rec.travel_for === "Guest"
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {rec.travel_for}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">
                            {rec.username}
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">
                            {rec.employee_name}
                          </td>
                          <td className="px-4 py-3 text-slate-600 max-w-xs">
                            <span
                              className="block truncate"
                              title={rec.purpose}
                            >
                              {rec.purpose || "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusBadgeClass(rec.status)}`}
                            >
                              {rec.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                            {rec.origin || "—"}
                          </td>
                          <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                            {rec.destination || "—"}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="text-slate-700 text-xs">
                              <div className="font-medium">
                                {rec.trip_start_date || "—"}
                              </div>
                              {rec.trip_start_time && (
                                <div className="text-slate-400">
                                  {rec.trip_start_time}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="text-slate-700 text-xs">
                              <div className="font-medium">
                                {rec.trip_end_date || "—"}
                              </div>
                              {rec.trip_end_time && (
                                <div className="text-slate-400">
                                  {rec.trip_end_time}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div className="px-5 py-3 bg-slate-50 border-t border-gray-100 flex items-center justify-between">
                <p className="text-xs text-slate-400">
                  Showing all {preview.total} record
                  {preview.total !== 1 ? "s" : ""}. The Excel file will contain
                  the same data.
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
                  {isDownloading ? "Downloading…" : "Export as Excel"}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <FileSpreadsheet className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No records found</p>
              <p className="text-sm text-slate-400 mt-1">
                Try adjusting the date range to find travel applications.
              </p>
            </div>
          )}
        </>
      )}

      {/* ---- Empty state (before first fetch) ---- */}
      {!preview && !isFetching && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-16 text-center">
          <CalendarDays className="w-14 h-14 text-blue-200 mx-auto mb-4" />
          <p className="text-slate-500 font-medium text-lg">
            Select a date range and click "Fetch Data"
          </p>
          <p className="text-sm text-slate-400 mt-2 max-w-md mx-auto">
            This will retrieve all travel applications whose trip <strong>start date</strong>{" "}
            falls within the selected range — useful for leave and salary processing.
          </p>
        </div>
      )}

      {/* ---- Loading skeleton ---- */}
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
