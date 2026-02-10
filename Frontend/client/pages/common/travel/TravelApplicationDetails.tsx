import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { StatusBadge } from "@/components/StatusBadge";
import { API_BASE_URL } from "@/config/api.config";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Info,
  Edit,
  ArrowLeft,
  UserCheck,
  FileText,
} from "lucide-react";
import { travelAPI } from "@/src/api/travel-api";
import { ROUTES } from "@/routes/routes";

// Helper to get full file URL
const getFileUrl = (url: string) => {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  // Remove /api from base url if present to get root
  const baseUrl = API_BASE_URL.replace(/\/api\/?$/, "");
  return `${baseUrl}${url.startsWith("/") ? "" : "/"}${url}`;
};

// Collapsible Section Component
const CollapsibleSection: React.FC<{
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}> = ({ title, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-t border-slate-200">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50/50 hover:bg-slate-100/70 transition-all duration-200"
      >
        <span className="font-medium text-slate-700">{title}</span>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-slate-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-500" />
        )}
      </button>
      {isOpen && <div className="p-4 bg-white">{children}</div>}
    </div>
  );
};

export const TravelApplicationDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) {
        setError("No application ID provided");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const response = await travelAPI.getTravelApplicationDetails(
          parseInt(id),
        );
        setData(response);
        console.log(response);
      } catch (err: any) {
        console.error("Failed to fetch travel application details:", err);
        setError(
          err.response?.data?.detail ||
            err.message ||
            "Failed to load travel application details",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600 font-medium">
            Loading travel application details...
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-red-200 rounded-md shadow-lg p-6 text-center">
          <div className="text-red-600 text-5xl mb-4">
            {" "}
            <Info />
          </div>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">
            Error Loading Details
          </h2>
          <p className="text-slate-600 mb-4">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // No data state
  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 flex items-center justify-center">
        <p className="text-slate-600">No data available</p>
      </div>
    );
  }

  const totalBookings =
    (data.ticketing_bookings || []).length +
    (data.accommodation_bookings || []).length +
    (data.conveyance_bookings || []).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 border border-slate-200 rounded-md hover:bg-slate-200 transition-all duration-200"
        >
          <ArrowLeft className="w-4 h-4" />
          Go Back
        </button>
        {/* Application Header */}
        <div className="bg-white border border-slate-200 overflow-hidden rounded-md shadow-sm transition-shadow duration-300">
          {/* Header Title */}
          <div className="bg-blue-500 border-b p-4 flex justify-between items-center">
            <h1 className="text-xl font-bold text-white">
              Travel Application Details
            </h1>
            {data?.can_edit && (
              <button
                onClick={() => navigate(ROUTES.editTravelApplication(id!))}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-white border border-white rounded-md hover:bg-blue-50 transition-all duration-200 shadow-sm"
              >
                <Edit className="w-4 h-4" />
                Edit
              </button>
            )}
          </div>

          {/* Travel Request ID & Purpose */}
          <div className="grid grid-cols-1 md:grid-cols-2 border-b border-slate-200">
            <div className="p-4 border-b md:border-b-0 md:border-r border-slate-200">
              <span className="font-semibold text-slate-700">
                Travel Request ID:
              </span>{" "}
              <span className="text-slate-900">
                {data?.application?.travel_request_id || ""}
              </span>
            </div>
            <div className="p-4">
              <span className="font-semibold text-slate-700">Status:</span>{" "}
              <span className="text-slate-900">
                {data?.application?.status_label || ""}
              </span>
            </div>
          </div>

          {/* Purpose */}
          <div className="border-b border-slate-200">
            <div className="p-4">
              <span className="font-semibold text-slate-700">Purpose:</span>{" "}
              <span className="text-slate-900">
                {data?.application?.purpose || ""}
              </span>
            </div>
          </div>

          {/* Employee Details */}
          <div className="grid grid-cols-2 md:grid-cols-2 border-b border-slate-200">
            <div className="p-4 border-b md:border-b-1 md:border-r border-slate-200 flex-1 min-w-[200px]">
              <span className="font-semibold text-slate-700">
                Employee Name:
              </span>{" "}
              <span className="text-slate-900">
                {data?.application?.employee_name || ""}
              </span>
            </div>
            <div className="p-4 border-b md:border-b-1 md:border-r border-slate-200 flex-1 min-w-[100px]">
              <span className="font-semibold text-slate-700">Grade:</span>{" "}
              <span className="text-slate-900">
                {data?.application?.grade || ""}
              </span>
            </div>
            <div className="p-4 border-b md:border-b-0 md:border-r border-slate-200 flex-1 min-w-[150px]">
              <span className="font-semibold text-slate-700">Department:</span>{" "}
              <span className="text-slate-900">
                {data?.application?.department || ""}
              </span>
            </div>
            <div className="p-4 flex-1 min-w-[180px]">
              <span className="font-semibold text-slate-700">Designation:</span>{" "}
              <span className="text-slate-900">
                {data?.application?.designation || ""}
              </span>
            </div>
          </div>

          {/* Settlement & Timestamps */}
          <div className="grid grid-cols-1 md:grid-cols-2 border-b border-slate-200">
            <div className="p-4 border-b md:border-b-0 md:border-r border-slate-200">
              <span className="font-semibold text-slate-700">
                Settlement Due Date:
              </span>{" "}
              <span className="text-slate-900">
                {data?.settlement?.settlement_due_date || ""}
              </span>
            </div>
            <div className="p-4">
              <span className="font-semibold text-slate-700">Settled:</span>{" "}
              <span className="text-slate-900">
                {data?.settlement?.is_settled ? "Yes" : "No"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap">
            <div className="p-4 border-b md:border-b-0 md:border-r border-slate-200 flex-1 min-w-[200px]">
              <span className="font-semibold text-slate-700">Created At:</span>{" "}
              <span className="text-slate-900">
                {data?.timestamps?.created_at || ""}
              </span>
            </div>
            <div className="p-4 border-b md:border-b-0 md:border-r border-slate-200 flex-1 min-w-[200px]">
              <span className="font-semibold text-slate-700">
                Submitted At:
              </span>{" "}
              <span className="text-slate-900">
                {data?.timestamps?.submitted_at || ""}
              </span>
            </div>
            <div className="p-4 flex-1 min-w-[200px]">
              <span className="font-semibold text-slate-700">Updated At:</span>{" "}
              <span className="text-slate-900">
                {data?.timestamps?.updated_at || ""}
              </span>
            </div>
          </div>
        </div>

        {/* Trip Details */}
        <div className="bg-white border border-slate-200 overflow-hidden rounded-md shadow-sm  transition-shadow duration-300">
          <div className="bg-blue-500 border-b p-4">
            <h2 className="text-lg font-bold text-white">Trip Details</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 border-b border-slate-200">
            <div className="p-4 border-b md:border-b-0 md:border-r border-slate-200">
              <span className="font-semibold text-slate-700">
                Internal Order:
              </span>{" "}
              <span className="text-slate-900">
                {data?.travel_details?.internal_order || ""}
              </span>
            </div>
            <div className="p-4 border-b md:border-b-0 md:border-r border-slate-200">
              <span className="font-semibold text-slate-700">GL Code:</span>{" "}
              <span className="text-slate-900">
                {data?.travel_details?.gl_code || ""}
              </span>
            </div>
            <div className="p-4">
              <span className="font-semibold text-slate-700">
                Sanction Number:
              </span>{" "}
              <span className="text-slate-900">
                {data?.travel_details?.sanction_number || ""}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 border-b border-slate-200">
            <div className="p-4 border-b md:border-b-0 md:border-r border-slate-200">
              <span className="font-semibold text-slate-700">Trip Origin:</span>{" "}
              <span className="text-slate-900">
                {data?.travel_details?.trip_origin || ""}
              </span>
            </div>
            <div className="p-4">
              <span className="font-semibold text-slate-700">
                Trip Destination:
              </span>{" "}
              <span className="text-slate-900">
                {data?.travel_details?.trip_destination || ""}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2">
            <div className="p-4 border-b md:border-b-0 md:border-r border-slate-200">
              <span className="font-semibold text-slate-700">
                Trip Start Date:
              </span>{" "}
              <span className="text-slate-900">
                {data?.travel_details?.start_datetime || ""}
              </span>
            </div>
            <div className="p-4">
              <span className="font-semibold text-slate-700">
                Trip End Date:
              </span>{" "}
              <span className="text-slate-900">
                {data?.travel_details?.end_datetime || ""}
              </span>
            </div>
          </div>
        </div>

        {/* Booking Details */}
        <div className="bg-white border border-slate-200 overflow-hidden rounded-md shadow-sm  transition-shadow duration-300">
          <div className="bg-blue-500 border-b p-4">
            <h2 className="text-lg font-bold text-white">
              Booking Details [Total bookings: {totalBookings}]
            </h2>
          </div>

          {/* Bulk File */}
          {data?.application?.bulk_upload_file ? (
            <div className="border-b border-slate-200">
              <div className="p-4">
                <span className="font-semibold text-slate-700">
                  Bulk Upload Document:
                </span>
                <a
                  href={getFileUrl(data.application.bulk_upload_file)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline inline-flex items-center gap-1 ml-2"
                >
                  <FileText className="w-4 h-4" />
                  View File
                </a>
              </div>
            </div>
          ) : (
            <>

              {/* Flight/Train Bookings */}
              <div className="border-b border-slate-200">
                <div className="bg-slate-50 p-4 font-semibold text-slate-700 border-b border-slate-200">
              Flight/Train Bookings [Bookings: {data.ticketing_bookings.length}]
                </div>
                {data.ticketing_bookings.map((booking, idx) => (
                  <div
                    key={booking.id}
                    className={idx > 0 ? "border-t border-slate-200" : ""}
                  >
                    {/* Booking Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-slate-100 overflow-x-auto">
                            <th className="border border-slate-200 p-3 text-left font-semibold text-slate-700">
                              Booking Type
                            </th>
                            <th className="border border-slate-200 p-3 text-left font-semibold text-slate-700">
                              Class
                            </th>
                            <th className="border border-slate-200 p-3 text-left font-semibold text-slate-700">
                              Ticket Number
                            </th>
                            <th className="border border-slate-200 p-3 text-left font-semibold text-slate-700">
                              Route
                            </th>
                            <th className="border border-slate-200 p-3 text-left font-semibold text-slate-700">
                              Departure
                            </th>
                            <th className="border border-slate-200 p-3 text-left font-semibold text-slate-700">
                              Arrival
                            </th>
                            <th className="border border-slate-200 p-3 text-left font-semibold text-slate-700">
                              Advance Requested
                            </th>
                            <th className="border border-slate-200 p-3 text-left font-semibold text-slate-700">
                              Meal Preference
                            </th>
                            <th className="border border-slate-200 p-3 text-left font-semibold text-slate-700">
                              Status
                            </th>
                            <th className="border border-slate-200 p-3 text-left font-semibold text-slate-700">
                              Booking File
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="hover:bg-slate-50 transition-colors overflow-x-auto">
                            <td className="flex flex-row gap-1  border-slate-200 p-3">
                              {booking.booking_type}
                              {booking.is_self_arranged && (
                                <div
                                  className="flex items-center text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full w-fit"
                                  title="Self Arranged"
                                >
                                  <UserCheck className="w-3 h-3 mr-1" />
                                  Self
                                </div>
                              )}
                            </td>
                            <td className="border border-slate-200 p-3">
                              {booking.class_field}
                            </td>
                            <td className="border border-slate-200 p-3">
                              {booking.ticket_number}
                            </td>
                            <td className="border border-slate-200 p-3">
                              {booking.from_location} → {booking.to_location}
                            </td>
                            <td className="border border-slate-200 p-3">
                              {booking.departure_datetime}
                            </td>
                            <td className="border border-slate-200 p-3">
                              {booking.arrival_datetime}
                            </td>
                            <td className="border border-slate-200 p-3">
                              {booking.advance_taken}
                            </td>
                            <td className="border border-slate-200 p-3">
                              {booking.meal_preference || "N/A"}
                            </td>
                            <td className="border border-slate-200 p-3">
                              <StatusBadge
                                statusType="booking"
                                status={booking.status}
                                variant="rounded"
                              />
                            </td>
                            <td>
                              {booking.booking_file && (
                                <a
                                  href={getFileUrl(booking.booking_file)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline inline-flex items-center gap-1 ml-2"
                                >
                                  <FileText className="w-4 h-4" />
                                  View File
                                </a>
                              )}
                            </td>
                          </tr>
                          {booking.special_instructions && (
                            <tr className="bg-blue-50/30">
                              <td
                                colSpan={10}
                                className="border border-slate-200 p-3"
                              >
                                <strong className="text-slate-700">
                                  Special Instructions:
                                </strong>{" "}
                                <span className="text-slate-900">
                                  {booking.special_instructions || "N/A"}
                                </span>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Travel Desk Details - Collapsible */}
                    <CollapsibleSection title="Travel Desk & Assignment Details">
                      <div className="space-y-3">
                        {/* Travel Desk Info */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <span className="font-medium text-slate-700">
                              Travel Desk:
                            </span>{" "}
                            <span className="text-slate-900">
                              {booking?.travel_desk?.user || "N/A"}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium text-slate-700">
                              Forwarded:
                            </span>{" "}
                            <span className="text-slate-900">
                              {booking?.travel_desk?.forwarded_at || "Pending"}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium text-slate-700">
                              Completed:
                            </span>{" "}
                            <span className="text-slate-900">
                              {booking?.travel_desk?.completed_at}
                            </span>
                          </div>
                          <div className="md:col-span-4">
                            <span className="font-medium text-slate-700">
                              Remarks:
                            </span>{" "}
                            <span className="text-slate-900">
                              {booking.travel_desk?.remarks}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CollapsibleSection>

                    {/* Booking Agent - Collapsible */}
                    {booking.assignments.length > 0 && (
                      <CollapsibleSection title="Booking Agent Details">
                        {booking.assignments.map((assignment, assignIdx) => (
                          <div
                            key={assignIdx}
                            className="grid grid-cols-1 md:grid-cols-5 gap-3 text-sm"
                          >
                            <div>
                              <span className="font-medium text-slate-700">
                                Booking Agent:
                              </span>{" "}
                              <span className="text-slate-900">
                                {assignment.assigned_to}
                              </span>
                            </div>
                            <div>
                              <span className="font-medium text-slate-700">
                                Assigned:
                              </span>{" "}
                              <span className="text-slate-900">
                                {assignment.assigned_at}
                              </span>
                            </div>
                            <div>
                              <span className="font-medium text-slate-700">
                                Accepted:
                              </span>{" "}
                              <span className="text-slate-900">
                                {assignment.accepted_at || "action pending"}
                              </span>
                            </div>
                            <div>
                              <span className="font-medium text-slate-700">
                                Completed:
                              </span>{" "}
                              <span className="text-slate-900">
                                {assignment.completed_at || "action pending"}
                              </span>
                            </div>
                            <div className="md:col-span-5">
                              <span className="font-medium text-slate-700">
                                Notes:
                              </span>{" "}
                              <span className="text-slate-900">
                                {assignment.notes || "No notes added"}
                              </span>
                            </div>
                          </div>
                        ))}
                      </CollapsibleSection>
                    )}

                    {/* Booking Notes - Collapsible */}
                    {booking.booking_notes.length > 0 && (
                      <CollapsibleSection title="Booking Notes">
                        <div className="space-y-2">
                          {booking.booking_notes.map((note, noteIdx) => (
                            <div key={noteIdx} className="flex gap-2 text-sm">
                              <div className="flex-shrink-0 w-2 h-2 bg-blue-600 rounded-full mt-1.5"></div>
                              <div className="flex-1">
                                <div className="font-medium text-xs text-slate-500">
                                  [{note.created_at}] {note.author}
                                </div>
                                <div className="text-sm text-slate-900">
                                  {note.note}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CollapsibleSection>
                    )}
                  </div>
                ))}
              </div>

              {/* Divider */}
              <div className="p-3 w-full"></div>

              {/* Accommodation Bookings */}
              <div className="border-b border-slate-200">
                <div className="bg-slate-50 p-4 font-semibold text-slate-700 border-b border-slate-200">
                  Accommodation Bookings [Bookings:{" "}
                  {data.accommodation_bookings.length}]
                </div>
                {data.accommodation_bookings.map((booking, idx) => (
                  <div
                    key={booking.id}
                    className={idx > 0 ? "border-t border-slate-200" : ""}
                  >
                    {/* Booking Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-slate-100">
                            <th className="border border-slate-200 p-3 text-left font-semibold text-slate-700">
                              Accommodation Type
                            </th>
                            <th className="border border-slate-200 p-3 text-left font-semibold text-slate-700">
                              Location
                            </th>
                            {/* Conditionally show Allocated Hotel/Guest House column */}
                            {booking.accommodation_type ===
                              "Company-tied Hotel" && (
                              <th className="border border-slate-200 p-3 text-left font-semibold text-slate-700">
                                Allocated Hotel
                              </th>
                            )}
                            {booking.accommodation_type === "Guest House" && (
                              <th className="border border-slate-200 p-3 text-left font-semibold text-slate-700">
                                Allocated Guest House
                              </th>
                            )}
                            <th className="border border-slate-200 p-3 text-left font-semibold text-slate-700">
                              Check-in
                            </th>
                            <th className="border border-slate-200 p-3 text-left font-semibold text-slate-700">
                              Check-out
                            </th>
                            <th className="border border-slate-200 p-3 text-left font-semibold text-slate-700">
                              Advance Requested
                            </th>
                            <th className="border border-slate-200 p-3 text-left font-semibold text-slate-700">
                              Meal Preference
                            </th>
                            <th className="border border-slate-200 p-3 text-left font-semibold text-slate-700">
                              Status
                            </th>
                            <th className="border border-slate-200 p-3 text-left font-semibold text-slate-700">
                              Booking File
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="hover:bg-slate-50 transition-colors">
                            <td className="border border-slate-200 p-3">
                              {booking.accommodation_type}
                            </td>
                            <td className="border border-slate-200 p-3">
                              {booking.accommodation_type === "ARC Hotel" ? (
                                <ol className="list-decimal list-inside">
                                  {booking.arc_hotel_preferences?.map(
                                    (pref, prefIdx) => (
                                      <li key={prefIdx}>{pref}</li>
                                    ),
                                  )}
                                </ol>
                              ) : (
                                booking.location
                              )}
                            </td>
                            {/* Conditionally show Allocated Hotel/Guest House cell */}
                            {booking.accommodation_type ===
                              "Company-tied Hotel" && (
                              <td className="border border-slate-200 p-3">
                                {booking.allocated_hotel || "-"}
                              </td>
                            )}
                            {booking.accommodation_type === "Guest House" && (
                              <td className="border border-slate-200 p-3">
                                {booking.allocated_guesthouse || "-"}
                              </td>
                            )}
                            <td className="border border-slate-200 p-3">
                              {booking.check_in_datetime}
                            </td>
                            <td className="border border-slate-200 p-3">
                              {booking.check_out_datetime}
                            </td>
                            <td className="border border-slate-200 p-3">
                              {booking.advance_taken}
                            </td>
                            <td className="border border-slate-200 p-3">
                              {booking.meal_preference || "N/A"}
                            </td>
                            <td className="border border-slate-200 p-3">
                              <StatusBadge
                                statusType="booking"
                                status={booking.status}
                                variant="rounded"
                              />
                            </td>
                            <td>
                              {booking.booking_file && (
                                <a
                                  href={getFileUrl(booking.booking_file)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline inline-flex items-center gap-1 ml-2"
                                >
                                  <FileText className="w-4 h-4" />
                                  View File
                                </a>
                              )}
                            </td>
                          </tr>
                          {booking.special_instructions && (
                            <tr className="bg-blue-50/30">
                              <td
                                colSpan={9}
                                className="border border-slate-200 p-3"
                              >
                                <strong className="text-slate-700">
                                  Special Instructions:
                                </strong>{" "}
                                <span className="text-slate-900">
                                  {booking.special_instructions || "N/A"}
                                </span>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Travel Desk Details - Collapsible */}
                    <CollapsibleSection title="Travel Desk & Assignment Details">
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <span className="font-medium text-slate-700">
                              Travel Desk:
                            </span>{" "}
                            <span className="text-slate-900">
                              {booking?.travel_desk?.user || "N/A"}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium text-slate-700">
                              Forwarded:
                            </span>{" "}
                            <span className="text-slate-900">
                              {booking?.travel_desk?.forwarded_at ||
                                "Pending" ||
                                "Pending"}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium text-slate-700">
                              Completed:
                            </span>{" "}
                            <span className="text-slate-900">
                              {booking?.travel_desk?.completed_at || "Pending"}
                            </span>
                          </div>
                          <div className="md:col-span-4">
                            <span className="font-medium text-slate-700">
                              Remarks:
                            </span>{" "}
                            <span className="text-slate-900">
                          {booking?.travel_desk?.remarks || "No remarks added"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CollapsibleSection>

                    {/* Booking Agent - Collapsible */}
                    {booking.assignments.length > 0 && (
                      <CollapsibleSection title="Booking Agent">
                        {booking.assignments.map((assignment, assignIdx) => (
                          <div
                            key={assignIdx}
                            className="grid grid-cols-1 md:grid-cols-5 gap-3 text-sm"
                          >
                            <div>
                              <span className="font-medium text-slate-700">
                                Booking Agent:
                              </span>{" "}
                              <span className="text-slate-900">
                                {assignment.assigned_to}
                              </span>
                            </div>
                            <div>
                              <span className="font-medium text-slate-700">
                                Assigned:
                              </span>{" "}
                              <span className="text-slate-900">
                                {assignment.assigned_at}
                              </span>
                            </div>
                            <div>
                              <span className="font-medium text-slate-700">
                                Accepted:
                              </span>{" "}
                              <span className="text-slate-900">
                                {assignment.accepted_at}
                              </span>
                            </div>
                            <div>
                              <span className="font-medium text-slate-700">
                                Completed:
                              </span>{" "}
                              <span className="text-slate-900">
                                {assignment.completed_at}
                              </span>
                            </div>
                            <div className="md:col-span-5">
                              <span className="font-medium text-slate-700">
                                Notes:
                              </span>{" "}
                              <span className="text-slate-900">
                                {assignment.notes}
                              </span>
                            </div>
                          </div>
                        ))}
                      </CollapsibleSection>
                    )}

                    {/* Booking Notes - Collapsible */}
                    {booking.booking_notes.length > 0 && (
                      <CollapsibleSection title="Booking Notes">
                        <div className="space-y-2">
                          {booking.booking_notes.map((note, noteIdx) => (
                            <div key={noteIdx} className="flex gap-2 text-sm">
                              <div className="flex-shrink-0 w-2 h-2 bg-blue-600 rounded-full mt-1.5"></div>
                              <div className="flex-1">
                                <div className="font-medium text-xs text-slate-500">
                                  [{note.created_at}] {note.author}
                                </div>
                                <div className="text-sm text-slate-900">
                                  {note.note}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CollapsibleSection>
                    )}
                  </div>
                ))}
              </div>

              {/* Divider */}
              <div className="p-3 w-full"></div>

              {/* Conveyance Bookings */}
              <div>
                <div className="bg-slate-50 p-4 font-semibold text-slate-700 border-b border-slate-200">
              Conveyance Bookings [Bookings: {data.conveyance_bookings.length}]
                </div>
                {data.conveyance_bookings.map((booking, idx) => (
                  <div
                    key={booking.id}
                    className={idx > 0 ? "border-t border-slate-200" : ""}
                  >
                    {/* Booking Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-slate-100">
                            <th className="border border-slate-200 p-3 text-left font-semibold text-slate-700">
                              Vehicle Type
                            </th>
                            <th className="border border-slate-200 p-3 text-left font-semibold text-slate-700">
                              Sub-type
                            </th>
                            <th className="border border-slate-200 p-3 text-left font-semibold text-slate-700">
                              Route
                            </th>
                            <th className="border border-slate-200 p-3 text-left font-semibold text-slate-700">
                              Report At / Drop
                            </th>
                            <th className="border border-slate-200 p-3 text-left font-semibold text-slate-700">
                              Start
                            </th>
                            <th className="border border-slate-200 p-3 text-left font-semibold text-slate-700">
                              End
                            </th>
                            <th className="border border-slate-200 p-3 text-left font-semibold text-slate-700">
                              Distance (KM)
                            </th>
                            <th className="border border-slate-200 p-3 text-left font-semibold text-slate-700">
                              Passengers
                            </th>
                            <th className="border border-slate-200 p-3 text-left font-semibold text-slate-700">
                              Advance Requested
                            </th>
                            <th className="border border-slate-200 p-3 text-left font-semibold text-slate-700">
                              Status
                            </th>
                            <th className="border border-slate-200 p-3 text-left font-semibold text-slate-700">
                              Booking File
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="hover:bg-slate-50 transition-colors">
                            <td className="border border-slate-200 p-3">
                              {booking.vehicle_type}
                            </td>
                            <td className="border border-slate-200 p-3">
                              {booking.vehicle_subtype}
                            </td>
                            <td className="border border-slate-200 p-3">
                              {booking.from_location} → {booking.to_location}
                            </td>
                            <td className="border border-slate-200 p-3">
                              {booking.report_at} / {booking.drop_location}
                            </td>
                            <td className="border border-slate-200 p-3">
                              {booking.start_datetime}
                            </td>
                            <td className="border border-slate-200 p-3">
                              {booking.end_datetime}
                            </td>
                            <td className="border border-slate-200 p-3">
                              {booking.distance_km}
                            </td>
                            <td className="border border-slate-200 p-3">
                              {booking.passengers}
                            </td>
                            <td className="border border-slate-200 p-3">
                              {booking.advance_taken}
                            </td>
                            <td className="border border-slate-200 p-3">
                              <StatusBadge
                                statusType="booking"
                                status={booking.status}
                                variant="rounded"
                              />
                            </td>
                            <td>
                              {booking.booking_file && (
                                <a
                                  href={getFileUrl(booking.booking_file)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline inline-flex items-center gap-1 ml-2"
                                >
                                  <FileText className="w-4 h-4" />
                                  View File
                                </a>
                              )}
                            </td>
                          </tr>
                          {booking.special_instructions && (
                            <tr className="bg-blue-50/30">
                              <td
                                colSpan={11}
                                className="border border-slate-200 p-3"
                              >
                                <strong className="text-slate-700">
                                  Special Instructions:
                                </strong>{" "}
                                <span className="text-slate-900">
                                  {booking.special_instructions || "N/A"}
                                </span>
                              </td>
                            </tr>
                          )}
                          <tr className="bg-slate-50">
                            <td
                              colSpan={11}
                              className="border border-slate-200 p-3"
                            >
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                  <strong className="text-slate-700">
                                    Club Booking:
                                  </strong>{" "}
                                  <span className="text-slate-900">
                                    {booking.club_booking ? "Yes" : "No"}
                                  </span>
                                </div>
                                {booking.club_booking &&
                                  booking.club_booking_reason && (
                                    <div>
                                      <strong className="text-slate-700">
                                        Reason:
                                      </strong>{" "}
                                      <span className="text-slate-900">
                                        {booking.club_booking_reason}
                                      </span>
                                    </div>
                                  )}
                              </div>
                              {booking.guests.length > 0 && (
                                <div className="mt-3">
                                  <strong className="block mb-2 text-slate-700">
                                    Guest Details:
                                  </strong>
                                  <div className="flex flex-wrap gap-2">
                                    {booking.guests.map((guest, guestIdx) => (
                                      <span
                                        key={guestIdx}
                                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                                          guest.is_colleague
                                            ? "bg-blue-100 text-blue-700"
                                            : "bg-green-100 text-green-700"
                                        }`}
                                      >
                                        {guest.name}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Travel Desk Details - Collapsible */}
                    <CollapsibleSection title="Travel Desk & Assignment Details">
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <span className="font-medium text-slate-700">
                              Travel Desk:
                            </span>{" "}
                            <span className="text-slate-900">
                              {booking?.travel_desk?.user || "N/A"}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium text-slate-700">
                              Forwarded:
                            </span>{" "}
                            <span className="text-slate-900">
                              {booking?.travel_desk?.forwarded_at || "Pending"}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium text-slate-700">
                              Completed:
                            </span>{" "}
                            <span className="text-slate-900">
                              {booking?.travel_desk?.completed_at || "Pending"}
                            </span>
                          </div>
                          <div className="md:col-span-4">
                            <span className="font-medium text-slate-700">
                              Remarks:
                            </span>{" "}
                            <span className="text-slate-900">
                              {booking?.travel_desk?.remarks || "-"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CollapsibleSection>

                    {/* Booking Agent - Collapsible */}
                    {booking.assignments.length > 0 && (
                      <CollapsibleSection title="Booking Agent">
                        {booking.assignments.map((assignment, assignIdx) => (
                          <div
                            key={assignIdx}
                            className="grid grid-cols-1 md:grid-cols-5 gap-3 text-sm"
                          >
                            <div>
                              <span className="font-medium text-slate-700">
                                Booking Agent:
                              </span>{" "}
                              <span className="text-slate-900">
                                {assignment.assigned_to}
                              </span>
                            </div>
                            <div>
                              <span className="font-medium text-slate-700">
                                Assigned:
                              </span>{" "}
                              <span className="text-slate-900">
                                {assignment.assigned_at}
                              </span>
                            </div>
                            <div>
                              <span className="font-medium text-slate-700">
                                Accepted:
                              </span>{" "}
                              <span className="text-slate-900">
                                {assignment.accepted_at}
                              </span>
                            </div>
                            <div>
                              <span className="font-medium text-slate-700">
                                Completed:
                              </span>{" "}
                              <span className="text-slate-900">
                                {assignment.completed_at || "Pending"}
                              </span>
                            </div>
                            <div className="md:col-span-5">
                              <span className="font-medium text-slate-700">
                                Notes:
                              </span>{" "}
                              <span className="text-slate-900">
                                {assignment.notes}
                              </span>
                            </div>
                          </div>
                        ))}
                      </CollapsibleSection>
                    )}

                    {/* Booking Notes - Collapsible */}
                    {booking.booking_notes.length > 0 && (
                      <CollapsibleSection title="Booking Notes">
                        <div className="space-y-2">
                          {booking.booking_notes.map((note, noteIdx) => (
                            <div key={noteIdx} className="flex gap-2 text-sm">
                              <div className="flex-shrink-0 w-2 h-2 bg-blue-600 rounded-full mt-1.5"></div>
                              <div className="flex-1">
                                <div className="font-medium text-xs text-slate-500">
                                  [{note.created_at}] {note.author}
                                </div>
                                <div className="text-sm text-slate-900">
                                  {note.note}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CollapsibleSection>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        {/* Approval History */}
        <div className="bg-white border border-slate-200 overflow-hidden rounded-md shadow-sm  transition-shadow duration-300">
          <div className="bg-blue-500 border-b p-4">
            <h2 className="text-lg font-bold text-white">Approval History</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-200 p-3 text-left font-semibold text-slate-700">
                    Level
                  </th>
                  <th className="border border-slate-200 p-3 text-left font-semibold text-slate-700">
                    Sequence
                  </th>
                  <th className="border border-slate-200 p-3 text-left font-semibold text-slate-700">
                    Approver
                  </th>
                  <th className="border border-slate-200 p-3 text-left font-semibold text-slate-700">
                    Status
                  </th>
                  <th className="border border-slate-200 p-3 text-left font-semibold text-slate-700">
                    Approved At
                  </th>
                  <th className="border border-slate-200 p-3 text-left font-semibold text-slate-700">
                    Notes
                  </th>
                  <th className="border border-slate-200 p-3 text-left font-semibold text-slate-700">
                    Created At
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.approval_workflow.map((approval, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="border border-slate-200 p-3">
                      {approval.level}
                    </td>
                    <td className="border border-slate-200 p-3">
                      {approval.sequence}
                    </td>
                    <td className="border border-slate-200 p-3">
                      {approval.approver}
                    </td>
                    <td className="border border-slate-200 p-3">
                      <StatusBadge
                        statusType="approval"
                        variant="rounded"
                        status={approval.status}
                      />
                    </td>
                    <td className="border border-slate-200 p-3">
                      {approval.approved_at || "-"}
                    </td>
                    <td className="border border-slate-200 p-3">
                      {approval.notes || "N/A"}
                    </td>
                    <td className="border border-slate-200 p-3">
                      {approval.created_at}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cancellation Details - Only show if exists */}
        {data.cancellation && (
          <div className="bg-white border border-slate-200 overflow-hidden rounded-md shadow-sm  transition-shadow duration-300">
            <div className="bg-blue-500 border-b p-4">
              <h2 className="text-lg font-bold text-white">
                Cancellation Details
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2">
              <div className="p-4 border-b md:border-b-0 md:border-r border-slate-200">
                <span className="font-semibold text-slate-700">
                  Cancellation Requested At:
                </span>{" "}
                <span className="text-slate-900">
                  {data.cancellation.requested_at}
                </span>
              </div>
              <div className="p-4 border-b md:border-b-0 border-slate-200">
                <span className="font-semibold text-slate-700">
                  Cancellation Approved At:
                </span>{" "}
                <span className="text-slate-900">
                  {data.cancellation.approved_at || "-"}
                </span>
              </div>
              <div className="p-4 border-b md:border-b-0 md:border-r border-slate-200">
                <span className="font-semibold text-slate-700">
                  Cancellation Reason:
                </span>{" "}
                <span className="text-slate-900">
                  {data.cancellation.reason}
                </span>
              </div>
              <div className="p-4 border-b md:border-b-0 border-slate-200">
                <span className="font-semibold text-slate-700">
                  Cancellation Rejection Reason:
                </span>{" "}
                <span className="text-slate-900">
                  {data.cancellation.rejection_reason || "-"}
                </span>
              </div>
              <div className="p-4 md:col-span-2">
                <span className="font-semibold text-slate-700">
                  Cancelled By:
                </span>{" "}
                <span className="text-slate-900">
                  {data.cancellation.cancelled_by}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TravelApplicationDetails;
