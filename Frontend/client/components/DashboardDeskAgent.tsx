import React, { useEffect, useState } from "react";
import {
  Eye,
  Check,
  X,
  Clock,
  AlertCircle,
  Plane,
  Train,
  Car,
  Home,
  ChevronDown,
  Search,
  Filter,
} from "lucide-react";

// Mock Data Store
const MOCK_APPLICATIONS = {
  "TR/TSF/2025/0000016": {
    id: 16,
    travel_request_id: "TR/TSF/2025/0000016",
    employee_name: "Soniya Lalwani",
    employee_grade: "B-2A",
    purpose: "Client Meeting & Site Visit",
    internal_order: "IO-2025-123",
    advance_amount: "3000.00",
    estimated_total_cost: "13000.00",
    status: "approved_by_manager",
    approved_at: "2025-11-20T10:15:00Z",
    trip_details: [
      {
        from_location_name: "Ahmedabad",
        to_location_name: "Mumbai",
        departure_date: "2026-02-09",
        return_date: "2026-02-13",
        duration_days: 5,
        city_category: "B",
        bookings: [
          {
            id: 18,
            booking_type_name: "Flight",
            sub_option_name: "Business Class",
            estimated_cost: "5500.00",
            status: "pending",
            booking_details: {
              departure_date: "2026-02-09",
              departure_time: "05:30",
            },
          },
          {
            id: 19,
            booking_type_name: "Train",
            sub_option_name: "1st AC",
            estimated_cost: "1800.00",
            status: "pending",
            booking_details: {
              departure_date: "2026-02-13",
              departure_time: "21:00",
            },
          },
          {
            id: 20,
            booking_type_name: "Accommodation",
            sub_option_name: "Guest House",
            estimated_cost: "4000.00",
            status: "pending",
          },
          {
            id: 21,
            booking_type_name: "Car",
            sub_option_name: "Company Car",
            estimated_cost: "950.00",
            status: "pending",
          },
        ],
      },
    ],
  },
  "TR/TSF/2025/0000017": {
    id: 17,
    travel_request_id: "TR/TSF/2025/0000017",
    employee_name: "Rajesh Kumar",
    employee_grade: "B-3",
    purpose: "Training Workshop",
    internal_order: "IO-2025-124",
    advance_amount: "2500.00",
    estimated_total_cost: "8500.00",
    status: "approved_by_manager",
    approved_at: "2025-11-21T14:30:00Z",
    trip_details: [
      {
        from_location_name: "Delhi",
        to_location_name: "Bangalore",
        departure_date: "2025-11-28",
        return_date: "2025-12-02",
        duration_days: 5,
        bookings: [
          {
            id: 23,
            booking_type_name: "Flight",
            sub_option_name: "Economy Class",
            estimated_cost: "4500.00",
            status: "pending",
          },
          {
            id: 24,
            booking_type_name: "Accommodation",
            sub_option_name: "3-Star Hotel",
            estimated_cost: "3000.00",
            status: "pending",
          },
          {
            id: 25,
            booking_type_name: "Car",
            sub_option_name: "Taxi",
            estimated_cost: "1000.00",
            status: "pending",
          },
        ],
      },
    ],
  },
  "TR/TSF/2025/0000018": {
    id: 18,
    travel_request_id: "TR/TSF/2025/0000018",
    employee_name: "Priya Sharma",
    employee_grade: "B-4A",
    purpose: "Supplier Audit",
    internal_order: "IO-2025-125",
    advance_amount: "1800.00",
    estimated_total_cost: "5200.00",
    status: "approved_by_manager",
    approved_at: "2025-11-19T09:00:00Z",
    trip_details: [
      {
        from_location_name: "Pune",
        to_location_name: "Kolkata",
        departure_date: "2025-11-25",
        return_date: "2025-11-27",
        duration_days: 3,
        bookings: [
          {
            id: 26,
            booking_type_name: "Train",
            sub_option_name: "2nd AC",
            estimated_cost: "2800.00",
            status: "pending",
          },
          {
            id: 27,
            booking_type_name: "Accommodation",
            sub_option_name: "Guest House",
            estimated_cost: "1800.00",
            status: "pending",
          },
          {
            id: 28,
            booking_type_name: "Car",
            sub_option_name: "Taxi",
            estimated_cost: "600.00",
            status: "pending",
          },
        ],
      },
    ],
  },
};

const BOOKING_AGENTS = [
  { id: 1, name: "Eastern Travels", contact: "+91-9876543210" },
  { id: 2, name: "Sky Routes", contact: "+91-9876543211" },
  { id: 3, name: "Metro Bookings", contact: "+91-9876543212" },
];

export default function DeskAgentDashboard() {
  const [applications, setApplications] = useState(
    Object.values(MOCK_APPLICATIONS),
  );
  const [selectedApp, setSelectedApp] = useState(null);
  const [viewModal, setViewModal] = useState(false);
  const [actionModal, setActionModal] = useState(false);
  const [actionType, setActionType] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [expandedRow, setExpandedRow] = useState(null);

  const handleView = (app) => {
    setSelectedApp(app);
    setViewModal(true);
  };

  const handleAction = (app, type) => {
    setSelectedApp(app);
    setActionType(type);
    setActionModal(true);
    setSelectedAgent("");
    setRejectReason("");
  };

  const confirmAction = () => {
    if (actionType === "forward" && !selectedAgent) {
      alert("Please select a booking agent");
      return;
    }
    if (actionType === "reject" && !rejectReason.trim()) {
      alert("Please provide rejection reason");
      return;
    }

    // Remove from list
    setApplications((prev) => prev.filter((a) => a.id !== selectedApp.id));
    setActionModal(false);

    const msg =
      actionType === "forward"
        ? `✅ Forwarded to ${BOOKING_AGENTS.find((a) => a.id === parseInt(selectedAgent))?.name}`
        : `❌ Application rejected`;

    setTimeout(() => alert(msg), 100);
  };

  const filteredApps = applications.filter((app) => {
    const matchesSearch =
      app.travel_request_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.employee_name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const kpiData = {
    total: applications.length,
    urgent: applications.filter((a) => {
      const depDate = new Date(a.trip_details[0]?.departure_date);
      const diff = (depDate - new Date()) / (1000 * 60 * 60);
      return diff > 0 && diff <= 48;
    }).length,
    dueToday: applications.filter((a) => {
      const depDate = new Date(a.trip_details[0]?.departure_date);
      return depDate.toDateString() === new Date().toDateString();
    }).length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/20">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Pending Requests</p>
                <p className="text-3xl font-bold text-slate-800">
                  {kpiData.total}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Urgent (48h)</p>
                <p className="text-3xl font-bold text-orange-600">
                  {kpiData.urgent}
                </p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Due Today</p>
                <p className="text-3xl font-bold text-green-600">
                  {kpiData.dueToday}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <Check className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by ID or employee name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Applications List */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="bg-slate-50 px-6 py-4 border-b">
            <h2 className="font-semibold text-slate-800">
              Manager Approved Applications
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    Request ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    Employee
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    Route
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    Departure
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredApps.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center text-slate-500"
                    >
                      No pending applications
                    </td>
                  </tr>
                ) : (
                  filteredApps.map((app) => (
                    <React.Fragment key={app.id}>
                      <tr className="hover:bg-slate-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() =>
                                setExpandedRow(
                                  expandedRow === app.id ? null : app.id,
                                )
                              }
                              className="p-1 hover:bg-slate-200 rounded"
                            >
                              <ChevronDown
                                className={`w-4 h-4 transition-transform ${expandedRow === app.id ? "rotate-180" : ""}`}
                              />
                            </button>
                            <span className="font-mono text-sm font-medium">
                              {app.travel_request_id}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-medium text-slate-800">
                              {app.employee_name}
                            </p>
                            <p className="text-xs text-slate-500">
                              {app.employee_grade}
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm">
                            {app.trip_details[0]?.from_location_name} →{" "}
                            {app.trip_details[0]?.to_location_name}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {new Date(
                            app.trip_details[0]?.departure_date,
                          ).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-right font-semibold">
                          ₹
                          {parseFloat(
                            app.estimated_total_cost,
                          ).toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleView(app)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleAction(app, "forward")}
                              className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs font-medium flex items-center gap-1"
                            >
                              <Check className="w-4 h-4" />
                              Forward
                            </button>
                            <button
                              onClick={() => handleAction(app, "reject")}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Reject"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {expandedRow === app.id && (
                        <tr>
                          <td colSpan={6} className="px-6 py-4 bg-slate-50">
                            <div className="space-y-3">
                              <p className="text-sm font-medium text-slate-700">
                                Bookings Required:
                              </p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {app.trip_details[0]?.bookings.map(
                                  (booking) => (
                                    <div
                                      key={booking.id}
                                      className="bg-white p-3 rounded-lg border"
                                    >
                                      <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                          <p className="font-medium text-sm">
                                            {booking.booking_type_name}
                                          </p>
                                          <p className="text-xs text-slate-500">
                                            {booking.sub_option_name}
                                          </p>
                                        </div>
                                        <p className="text-sm font-semibold">
                                          ₹
                                          {parseFloat(
                                            booking.estimated_cost,
                                          ).toLocaleString()}
                                        </p>
                                      </div>
                                    </div>
                                  ),
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* View Modal */}
      {viewModal && selectedApp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold">
                  {selectedApp.travel_request_id}
                </h3>
                <p className="text-sm text-slate-600">
                  {selectedApp.employee_name} • {selectedApp.employee_grade}
                </p>
              </div>
              <button
                onClick={() => setViewModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <h4 className="font-semibold mb-2">Purpose</h4>
                <p className="text-sm text-slate-700">{selectedApp.purpose}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500">Internal Order</p>
                  <p className="font-medium">{selectedApp.internal_order}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Advance Amount</p>
                  <p className="font-medium">
                    ₹{parseFloat(selectedApp.advance_amount).toLocaleString()}
                  </p>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-3">Trip Details</h4>
                {selectedApp.trip_details.map((trip, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-50 rounded-lg p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">
                          {trip.from_location_name} → {trip.to_location_name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {new Date(trip.departure_date).toLocaleDateString()} -{" "}
                          {new Date(trip.return_date).toLocaleDateString()} (
                          {trip.duration_days} days)
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium">Bookings:</p>
                      {trip.bookings.map((booking) => (
                        <div
                          key={booking.id}
                          className="bg-white p-3 rounded border flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            {booking.booking_type_name === "Flight" && (
                              <Plane className="w-4 h-4 text-blue-600" />
                            )}
                            {booking.booking_type_name === "Train" && (
                              <Train className="w-4 h-4 text-green-600" />
                            )}
                            {booking.booking_type_name === "Car" && (
                              <Car className="w-4 h-4 text-orange-600" />
                            )}
                            {booking.booking_type_name === "Accommodation" && (
                              <Home className="w-4 h-4 text-purple-600" />
                            )}
                            <div>
                              <p className="text-sm font-medium">
                                {booking.booking_type_name}
                              </p>
                              <p className="text-xs text-slate-500">
                                {booking.sub_option_name}
                              </p>
                            </div>
                          </div>
                          <p className="text-sm font-semibold">
                            ₹
                            {parseFloat(
                              booking.estimated_cost,
                            ).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Modal */}
      {actionModal && selectedApp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="border-b px-6 py-4">
              <h3 className="text-lg font-bold">
                {actionType === "forward"
                  ? "Forward to Booking Agent"
                  : "Reject Application"}
              </h3>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-slate-600 mb-2">
                  Application:{" "}
                  <span className="font-mono font-medium">
                    {selectedApp.travel_request_id}
                  </span>
                </p>
              </div>

              {actionType === "forward" ? (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Select Booking Agent *
                  </label>
                  <select
                    value={selectedAgent}
                    onChange={(e) => setSelectedAgent(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Choose agent...</option>
                    {BOOKING_AGENTS.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name} ({agent.contact})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Rejection Reason *
                  </label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Enter reason for rejection..."
                    rows={4}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
              )}
            </div>

            <div className="border-t px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setActionModal(false)}
                className="px-4 py-2 border rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmAction}
                className={`px-4 py-2 rounded-lg text-white font-medium ${
                  actionType === "forward"
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {actionType === "forward" ? "Forward" : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
