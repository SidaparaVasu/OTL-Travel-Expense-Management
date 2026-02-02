import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Filter, IndianRupee, CheckCircle, Clock } from "lucide-react";
import { financeAdvanceAPI } from "@/src/api/finance-advance";
import { ROUTES } from "@/routes/routes";

const AdvanceWorkspacePage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [advanceRequests, setAdvanceRequests] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"pending" | "processed">(
    "pending",
  );
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchRequests();
  }, [activeTab]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const data = await financeAdvanceAPI.getAdvanceRequests({
        status: activeTab,
      });
      console.log(data);
      setAdvanceRequests(data);
    } catch (error) {
      console.error("Failed to fetch advance requests:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredRequests = advanceRequests.filter(
    (req) =>
      req.travel_request_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.employee_name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Advance Workspace
          </h1>
          <p className="text-sm text-gray-500">
            Manage and process travel advance requisitions
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-4 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("pending")}
          className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "pending"
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <Clock size={16} /> Pending
        </button>
        <button
          onClick={() => setActiveTab("processed")}
          className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "processed"
              ? "border-green-500 text-green-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <CheckCircle size={16} /> Processed
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
            size={18}
          />
          <input
            type="text"
            placeholder="Search by TR ID or Employee Name..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">
            Loading requests...
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            No {activeTab} advance requests found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Req ID / Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employee
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Trip Dates
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount & Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRequests.map((req) => (
                  <tr
                    key={req.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {req.travel_request_id}
                      </div>
                      <div className="text-xs text-gray-500">
                        Requested:{" "}
                        {new Date(req.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {req.employee_name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {req.department} • {req.grade}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {req.travel_dates?.start
                          ? new Date(
                              req.travel_dates.start,
                            ).toLocaleDateString()
                          : "N/A"}
                        {" - "}
                        {req.travel_dates?.end
                          ? new Date(req.travel_dates.end).toLocaleDateString()
                          : "N/A"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center text-sm font-medium text-gray-900">
                          {/* <IndianRupee
                            size={14}
                            className="mr-1 text-gray-400"
                          /> */}
                          {parseFloat(req.advance_amount).toLocaleString(
                            "en-IN",
                            { style: "currency", currency: "INR" },
                          )}
                        </div>
                        <span
                          className={`inline-flex px-2 text-xs font-semibold leading-5 rounded-full w-fit ${
                            req.advance_status === "processed"
                              ? "bg-green-100 text-green-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {req.advance_status === "processed"
                            ? "Processed"
                            : "Pending Processing"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => navigate(ROUTES.advanceRequisitionPage(req.id))}
                        className="text-blue-600 hover:text-blue-900 bg-blue-50 px-3 py-1 rounded hover:bg-blue-100 transition-colors"
                      >
                        {activeTab === "pending" ? "Process" : "View Details"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdvanceWorkspacePage;
