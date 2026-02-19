import React, { useState, useEffect } from "react";
import {
  Search,
  Edit,
  Trash2,
  Plus,
  Eye,
  X,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { accommodationAPI } from "@/src/api/master_accommodation";
import GuestHouseDetailModal from "./GuestHouseDetailModal";

const GuestHouseList = ({ onEdit }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewId, setViewId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async (search = "") => {
    try {
      setLoading(true);
      const response = await accommodationAPI.guestHouse.getAll(search);
      setData(response.data.data.results);
    } catch (error) {
      console.error("Error fetching data:", error);
      alert("Failed to load guest houses");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchData(searchTerm);
  };

  const handleToggleActive = async (id, currentStatus, name) => {
    const action = currentStatus ? "deactivate" : "activate";
    if (!window.confirm(`Are you sure you want to ${action} "${name}"?`))
      return;

    try {
      await accommodationAPI.guestHouse.toggleActive(id, !currentStatus);
      fetchData();
    } catch (error) {
      console.error("Toggle error:", error);
      alert(`Failed to ${action} guest house`);
    }
  };

  const handleDelete = async (id, name) => {
    if (
      !window.confirm(
        `Are you sure you want to permanently DELETE "${name}"? This cannot be undone!`,
      )
    )
      return;

    try {
      await accommodationAPI.guestHouse.delete(id);
      alert("Guest house deleted permanently");
      fetchData();
    } catch (error) {
      console.error("Delete error:", error);
      alert("Failed to delete guest house");
    }
  };

  const handleView = (id) => {
    setViewId(id);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg border border-b p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-gray-800">Guest Houses</h1>
          </div>

          {/* Search Bar */}
          <div className="flex gap-2">
            <div className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <Search
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                  size={20}
                />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="Search by name, city, state, contact person, phone, email, GSTIN, vendor code..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded"
                />
              </div>
              <button
                onClick={handleSearch}
                className="px-6 py-2 bg-gray-500 text-white rounded hover:bg-gray-700"
              >
                Search
              </button>
              {searchTerm && (
                <button
                  onClick={() => {
                    setSearchTerm("");
                    fetchData();
                  }}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                  title="Clear Search"
                >
                  <X size={20} />
                </button>
              )}
            </div>
            <button
              onClick={() => onEdit(null)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded"
            >
              <Plus size={20} />
              Add New
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg border border-b overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
          ) : data.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg">No guest houses found</p>
              <p className="text-sm mt-2">
                Try adjusting your search or filters
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr className="whitespace-nowrap">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Name
                    </th>
                    {/* <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th> */}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Location
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Rooms
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 whitespace-nowrap">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">
                          {item.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {item.ownership_type?.replace("_", " ")}
                        </div>
                      </td>
                      {/* <td className="px-6 py-4 text-sm text-gray-700">
                          {item.property_type?.replace('_', ' ').toUpperCase()}
                        </td> */}
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {item.city_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {item.state_name}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {item.contact_person}
                        </div>
                        <div className="text-sm text-gray-500">
                          {item.phone_number}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {item.total_rooms || "-"}
                      </td>
                      <td className="px-6 py-8 flex items-center gap-1">
                        <button
                          onClick={() =>
                            handleToggleActive(
                              item.id,
                              item.is_active,
                              item.name,
                            )
                          }
                          className={`rounded ${item.is_active ? "text-green-600 hover:bg-green-50" : "text-red-600 hover:bg-red-50"}`}
                          title={item.is_active ? "Deactivate" : "Activate"}
                        >
                          {item.is_active ? (
                            <ToggleRight size={18} />
                          ) : (
                            <ToggleLeft size={18} />
                          )}
                        </button>
                        <span
                          className={`inline-flex text-xs font-semibold ${
                            item.is_active ? "text-green-800" : "text-red-800"
                          }`}
                        >
                          {item.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleView(item.id)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                            title="View Details"
                          >
                            <Eye size={18} />
                          </button>
                          <button
                            onClick={() => onEdit(item.id)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded"
                            title="Edit"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id, item.name)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded"
                            title="Deactivate"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      {viewId && (
        <GuestHouseDetailModal
          guestHouseId={viewId}
          onClose={() => setViewId(null)}
        />
      )}
    </div>
  );
};

export default GuestHouseList;
