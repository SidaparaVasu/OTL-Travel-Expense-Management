import React, { useState, useEffect } from "react";
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { spocAssignmentAPI } from "@/src/api/spoc_assignment";
import { locationAPI } from "@/src/api/master_location";
import { roleManagementAPI } from "@/src/api/master_role_management";
import SPOCAssignmentModal from "./SPOCAssignmentModal";

const SPOCAssignmentList = () => {
  const [assignments, setAssignments] = useState([]);
  const [filteredAssignments, setFilteredAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterActive, setFilterActive] = useState("all");

  // Dropdown Data
  const [locations, setLocations] = useState([]);
  const [roles, setRoles] = useState([]);

  useEffect(() => {
    fetchDropdownData();
    fetchAssignments();
  }, []);

  useEffect(() => {
    filterAssignments();
  }, [assignments, searchTerm, filterLocation, filterRole, filterActive]);

  const fetchDropdownData = async () => {
    try {
      const locData = await locationAPI.location.getAll();
      setLocations(locData.data.results || []);

      const roleData = await roleManagementAPI.role.getSpocRoles();
      setRoles(roleData.data.results || roleData.results || []);
    } catch (error) {
      console.error("Failed to fetch dropdown data", error);
    }
  };

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      // Fetch all without filters initially, or add backend filters if performance needed
      const response = await spocAssignmentAPI.getAll();
      // API returns structure { status: "success", data: { results: [] } }
      setAssignments(response.data?.results || response.results || []);
    } catch (error) {
      console.error(error);
      console.error(error);
      toast.error("Failed to fetch assignments.");
    } finally {
      setLoading(false);
    }
  };

  const filterAssignments = () => {
    let filtered = assignments;

    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.user?.username?.toLowerCase().includes(lowerSearch) ||
          item.user?.email?.toLowerCase().includes(lowerSearch) ||
          item.role?.name?.toLowerCase().includes(lowerSearch),
      );
    }

    if (filterLocation) {
      const locId = parseInt(filterLocation);
      filtered = filtered.filter(
        (item) =>
          item.is_global || // Global covers all locations? Or just filter explicitly?
          // Depending on requirement. Usually user wants to see "Who handles this location?"
          // So if Global, they handle it.
          item.locations?.some((l) => l.location_id === locId),
      );
    }

    if (filterRole) {
      const roleId = parseInt(filterRole);
      filtered = filtered.filter((item) => item.role?.id === roleId);
    }

    if (filterActive !== "all") {
      const isActive = filterActive === "active";
      filtered = filtered.filter((item) => item.is_active === isActive);
    }

    setFilteredAssignments(filtered);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this assignment?"))
      return;
    try {
      await spocAssignmentAPI.delete(id);
      toast.success("Assignment deleted.");
      fetchAssignments();
    } catch (error) {
      toast.error("Failed to delete assignment.");
    }
  };

  const handleToggleActive = async (item) => {
    try {
      const newStatus = !item.is_active;
      await spocAssignmentAPI.toggleActive(item.id, newStatus);
      toast.success(`Assignment ${newStatus ? "activated" : "deactivated"}.`);
      fetchAssignments(); // Refresh to update list
    } catch (error) {
      toast.error("Failed to update status.");
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingItem(null);
  };

  const handleSaveSuccess = () => {
    fetchAssignments();
    closeModal();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
              SPOC Assignment
            </h1>
            <p className="text-slate-500 mt-1">
              Manage role and unit location wise SPOCs.
            </p>
          </div>
          {/* Add Assignment Button */}
          <div className="flex justify-end">
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-md hover:shadow-lg font-medium whitespace-nowrap"
            >
              <Plus size={20} />
              Create SPOC Assignment
            </button>
          </div>
        </div>

        {/* Filters Toolbar */}
        <div className="bg-white rounded-md shadow-sm border border-slate-200 p-4 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-center">
            {/* Search */}
            <div className="sm:col-span-2 lg:col-span-6 relative">
              <Search
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400"
                size={18}
              />
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm"
              />
            </div>

            {/* Role Filter */}
            <div className="sm:col-span-1 lg:col-span-2">
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm text-slate-700 cursor-pointer"
              >
                <option value="">All Roles</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Location Filter */}
            <div className="sm:col-span-1 lg:col-span-2">
              <select
                value={filterLocation}
                onChange={(e) => setFilterLocation(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm text-slate-700 cursor-pointer"
              >
                <option value="">All Locations</option>
                {locations.map((l) => (
                  <option key={l.location_id} value={l.location_id}>
                    {l.location_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="sm:col-span-2 lg:col-span-2">
              <select
                value={filterActive}
                onChange={(e) => setFilterActive(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm text-slate-700 cursor-pointer"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-md shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-slate-600">Loading assignments...</p>
            </div>
          ) : filteredAssignments.length === 0 ? (
            <div className="p-12 text-center">
              <UserCheck className="mx-auto text-slate-300 mb-4" size={48} />
              <p className="text-slate-600">No assignments found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50/50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Locations
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredAssignments.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-neutral-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-slate-900">
                          {item.user?.username}
                        </div>
                        <div className="text-xs text-slate-500">
                          {item.user?.email}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-700">
                        {item.role?.name}
                      </td>
                      <td className="px-6 py-4 text-slate-700 max-w-xs truncate">
                        {item.is_global ? (
                          <span className="text-black">All Locations</span>
                        ) : (
                          item.locations
                            ?.map((l) => l.location_name)
                            .join(", ") || "-"
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-medium ${item.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                        >
                          {item.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleEdit(item)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => handleToggleActive(item)}
                            className={`p-2 rounded-lg transition-colors ${item.is_active ? "text-orange-600 hover:bg-orange-50" : "text-green-600 hover:bg-green-50"}`}
                            title={item.is_active ? "Deactivate" : "Activate"}
                          >
                            {item.is_active ? (
                              <ToggleLeft size={18} />
                            ) : (
                              <ToggleRight size={18} />
                            )}
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
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

      {showModal && (
        <SPOCAssignmentModal
          isOpen={showModal}
          onClose={closeModal}
          onSuccess={handleSaveSuccess}
          editingItem={editingItem}
          roles={roles}
          locations={locations}
        />
      )}
    </div>
  );
};

export default SPOCAssignmentList;
