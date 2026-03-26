import React, { useState, useEffect } from "react";
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  X,
  Check,
  AlertCircle,
  XCircle,
} from "lucide-react";
import { masterAPI } from "@/src/api/master";
import { daIncidentalAPI } from "@/src/api/master_daincidentals";
import { locationAPI } from "@/src/api/master_location";

const DAIncidentalMaster = () => {
  const [rates, setRates] = useState([]);
  const [filteredRates, setFilteredRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterActive, setFilterActive] = useState("all");
  const [filterGrade, setFilterGrade] = useState("");
  const [filterCityCategory, setFilterCityCategory] = useState("");
  const [notification, setNotification] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Dropdown data
  const [grades, setGrades] = useState([]);
  const [cityCategories, setCityCategories] = useState([]);

  const [formData, setFormData] = useState({
    grade: "",
    city_category: "",
    da_full_day: "",
    da_half_day: "",
    incidental_full_day: "",
    incidental_half_day: "",
    stay_allowance_category_a: "",
    stay_allowance_category_b: "",
    effective_from: "",
    effective_to: "",
    is_active: true,
  });

  useEffect(() => {
    fetchRates();
    fetchDropdownData();
  }, []);

  useEffect(() => {
    filterRates();
  }, [rates, searchTerm, filterActive, filterGrade, filterCityCategory]);

  const fetchDropdownData = async () => {
    try {
      // Replace with actual API calls
      const gradesData = await masterAPI.getGrades();
      setGrades(gradesData.results || gradesData.data.results);

      const cityCategoriesData = await locationAPI.getCityCategories();
      setCityCategories(cityCategoriesData.data.data.results);
    } catch (error) {
      showNotification("Failed to fetch dropdown data", "error");
    }
  };

  const fetchRates = async () => {
    setLoading(true);
    try {
      // Replace with actual API call
      const data = await daIncidentalAPI.daIncidental.getAll();
      console.log("Fetched Rates:", data.data);
      setRates(data.data || data.results || data.data.results || []);
    } catch (error) {
      showNotification("Failed to fetch DA incidental rates", "error");
    } finally {
      setLoading(false);
    }
  };

  const filterRates = () => {
    let filtered = rates;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (r) =>
          r.grade_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.city_category_name
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()),
      );
    }

    // Active/Inactive filter
    if (filterActive !== "all") {
      filtered = filtered.filter((r) =>
        filterActive === "active" ? r.is_active : !r.is_active,
      );
    }

    // Grade filter
    if (filterGrade) {
      filtered = filtered.filter((r) => r.grade === parseInt(filterGrade));
    }

    // City Category filter
    if (filterCityCategory) {
      filtered = filtered.filter(
        (r) => r.city_category === parseInt(filterCityCategory),
      );
    }

    setFilteredRates(filtered);
  };

  const showNotification = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      grade: parseInt(formData.grade),
      city_category: parseInt(formData.city_category),
      da_full_day: parseFloat(formData.da_full_day),
      da_half_day: parseFloat(formData.da_half_day),
      incidental_full_day: parseFloat(formData.incidental_full_day),
      incidental_half_day: parseFloat(formData.incidental_half_day),
      stay_allowance_category_a: parseFloat(formData.stay_allowance_category_a),
      stay_allowance_category_b: parseFloat(formData.stay_allowance_category_b),
      effective_from: formData.effective_from,
      effective_to: formData.effective_to || null,
      is_active: formData.is_active,
    };

    try {
      if (editingItem) {
        await daIncidentalAPI.daIncidental.update(editingItem.id, payload);
        showNotification("DA incidental rate updated successfully");
      } else {
        await daIncidentalAPI.daIncidental.create(payload);
        showNotification("DA incidental rate created successfully");
      }
      fetchRates();
      closeModal();
    } catch (error) {
      showNotification("Operation failed", "error");
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      grade: item.grade.toString(),
      city_category: item.city_category.toString(),
      da_full_day: item.da_full_day.toString(),
      da_half_day: item.da_half_day.toString(),
      incidental_full_day: item.incidental_full_day.toString(),
      incidental_half_day: item.incidental_half_day.toString(),
      stay_allowance_category_a: item.stay_allowance_category_a.toString(),
      stay_allowance_category_b: item.stay_allowance_category_b.toString(),
      effective_from: item.effective_from,
      effective_to: item.effective_to || "",
      is_active: item.is_active,
    });
    setShowModal(true);
  };

  const handleSoftDelete = async (item) => {
    try {
      const payload = { ...item, is_active: false };
      await daIncidentalAPI.daIncidental.update(item.id, payload);
      showNotification("DA incidental rate deactivated successfully");
      fetchRates();
    } catch (error) {
      showNotification("Failed to deactivate rate", "error");
    }
  };

  const handleHardDelete = async () => {
    if (!deleteTarget) return;

    try {
      await daIncidentalAPI.daIncidental.delete(deleteTarget.id);
      showNotification("DA incidental rate deleted successfully");
      fetchRates();
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
    } catch (error) {
      showNotification("Failed to delete rate", "error");
    }
  };

  const openDeleteConfirm = (item) => {
    setDeleteTarget(item);
    setShowDeleteConfirm(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingItem(null);
    setFormData({
      grade: "",
      city_category: "",
      da_full_day: "",
      da_half_day: "",
      incidental_full_day: "",
      incidental_half_day: "",
      stay_allowance_category_a: "",
      stay_allowance_category_b: "",
      effective_from: "",
      effective_to: "",
      is_active: true,
    });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "Ongoing";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatCurrency = (amount) => {
    return `₹${parseFloat(amount).toFixed(2)}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      {/* Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 ${
            notification.type === "success" ? "bg-green-500" : "bg-red-500"
          } text-white animate-fade-in`}
        >
          {notification.type === "success" ? (
            <Check size={20} />
          ) : (
            <AlertCircle size={20} />
          )}
          {notification.message}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-slate-800">
                Confirm Delete
              </h3>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-slate-600 mb-6">
              Are you sure you want to permanently delete this DA incidental
              rate? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-md text-sm text-slate-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleHardDelete}
                className="px-4 py-2 rounded-md text-sm bg-red-600 text-white hover:bg-red-700 flex items-center gap-2"
              >
                <Check className="w-4 h-4" /> Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-800 mb-2">
            DA & Incidental Master
          </h1>
          <p className="text-slate-600">
            Manage Daily Allowance and Incidental rates by grade and city
            category
          </p>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 mb-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-1 relative">
                <Search
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400"
                  size={20}
                />
                <input
                  type="text"
                  placeholder="Search by grade or city category..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <select
                value={filterGrade}
                onChange={(e) => setFilterGrade(e.target.value)}
                className="px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Grades</option>
                {grades.map((grade) => (
                  <option key={grade.id} value={grade.id}>
                    {grade.name}
                  </option>
                ))}
              </select>

              <select
                value={filterCityCategory}
                onChange={(e) => setFilterCityCategory(e.target.value)}
                className="px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All City Categories</option>
                {cityCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 justify-between items-center">
              <div className="flex bg-slate-100 rounded-lg p-1">
                <button
                  onClick={() => setFilterActive("all")}
                  className={`px-4 py-1.5 rounded-md transition-all text-sm font-medium ${
                    filterActive === "all"
                      ? "bg-white text-blue-600 shadow-sm"
                      : "text-slate-600"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilterActive("active")}
                  className={`px-4 py-1.5 rounded-md transition-all text-sm font-medium ${
                    filterActive === "active"
                      ? "bg-white text-blue-600 shadow-sm"
                      : "text-slate-600"
                  }`}
                >
                  Active
                </button>
                <button
                  onClick={() => setFilterActive("inactive")}
                  className={`px-4 py-1.5 rounded-md transition-all text-sm font-medium ${
                    filterActive === "inactive"
                      ? "bg-white text-blue-600 shadow-sm"
                      : "text-slate-600"
                  }`}
                >
                  Inactive
                </button>
              </div>

              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium"
              >
                <Plus size={20} />
                <span className="hidden sm:inline">Add New</span>
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-slate-600">Loading...</p>
            </div>
          ) : filteredRates.length === 0 ? (
            <div className="p-12 text-center">
              <Search className="mx-auto text-slate-300 mb-4" size={48} />
              <p className="text-slate-600">No DA incidental rates found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Grade
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      City Category
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      DA Full Day
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      DA Half Day
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Incidental Full
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Incidental Half
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Stay Allow. A
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Stay Allow. B
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Effective Period
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredRates.map((rate) => (
                    <tr
                      key={rate.id}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-medium text-slate-900">
                          {rate.grade_name}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                          {rate.category_name}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-700">
                        {formatCurrency(rate.da_full_day)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-700">
                        {formatCurrency(rate.da_half_day)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-700">
                        {formatCurrency(rate.incidental_full_day)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-700">
                        {formatCurrency(rate.incidental_half_day)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-700">
                        {formatCurrency(rate.stay_allowance_category_a)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-700">
                        {formatCurrency(rate.stay_allowance_category_b)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-700 text-sm">
                        {formatDate(rate.effective_from)} -{" "}
                        {formatDate(rate.effective_to)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                            rate.is_active
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {rate.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleEdit(rate)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={18} />
                          </button>
                          {rate.is_active && (
                            <button
                              onClick={() => handleSoftDelete(rate)}
                              className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                              title="Deactivate"
                            >
                              <XCircle size={18} />
                            </button>
                          )}
                          <button
                            onClick={() => openDeleteConfirm(rate)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete Permanently"
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

        {/* Form Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-40">
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800">
                  {editingItem
                    ? "Edit DA Incidental Rate"
                    : "Create DA Incidental Rate"}
                </h2>
                <button
                  onClick={closeModal}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Grade */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Grade *
                    </label>
                    <select
                      value={formData.grade}
                      onChange={(e) =>
                        setFormData({ ...formData, grade: e.target.value })
                      }
                      required
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select grade</option>
                      {grades.map((grade) => (
                        <option key={grade.id} value={grade.id}>
                          {grade.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* City Category */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      City Category *
                    </label>
                    <select
                      value={formData.city_category}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          city_category: e.target.value,
                        })
                      }
                      required
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select city category</option>
                      {cityCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* DA Full Day */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      DA Full Day (₹) *
                      <span className="block text-xs text-slate-500 font-normal">
                        Duration &gt; 12 hours
                      </span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.da_full_day}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          da_full_day: e.target.value,
                        })
                      }
                      required
                      placeholder="0.00"
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* DA Half Day */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      DA Half Day (₹) *
                      <span className="block text-xs text-slate-500 font-normal">
                        Duration 8-12 hours
                      </span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.da_half_day}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          da_half_day: e.target.value,
                        })
                      }
                      required
                      placeholder="0.00"
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Incidental Full Day */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Incidental Full Day (₹) *
                      <span className="block text-xs text-slate-500 font-normal">
                        Duration &gt; 12 hours
                      </span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.incidental_full_day}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          incidental_full_day: e.target.value,
                        })
                      }
                      required
                      placeholder="0.00"
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Incidental Half Day */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Incidental Half Day (₹) *
                      <span className="block text-xs text-slate-500 font-normal">
                        Duration 8-12 hours
                      </span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.incidental_half_day}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          incidental_half_day: e.target.value,
                        })
                      }
                      required
                      placeholder="0.00"
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Stay Allowance Category A */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Stay Allowance Category A (₹) *
                      <span className="block text-xs text-slate-500 font-normal">
                        Staying with friends/relatives
                      </span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.stay_allowance_category_a}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          stay_allowance_category_a: e.target.value,
                        })
                      }
                      required
                      placeholder="0.00"
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Stay Allowance Category B */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Stay Allowance Category B (₹) *
                      <span className="block text-xs text-slate-500 font-normal">
                        Staying with friends/relatives
                      </span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.stay_allowance_category_b}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          stay_allowance_category_b: e.target.value,
                        })
                      }
                      required
                      placeholder="0.00"
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Effective From */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Effective From *
                    </label>
                    <input
                      type="date"
                      value={formData.effective_from}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          effective_from: e.target.value,
                        })
                      }
                      required
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Effective To */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Effective To
                    </label>
                    <input
                      type="date"
                      value={formData.effective_to}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          effective_to: e.target.value,
                        })
                      }
                      placeholder="Leave blank for ongoing"
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Active Status */}
                <div className="mt-6">
                  <label className="flex items-center gap-3 p-4 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          is_active: e.target.checked,
                        })
                      }
                      className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-slate-700 font-medium">Active</span>
                  </label>
                </div>

                {/* Actions */}
                <div className="flex gap-3 mt-8 pt-6 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
                  >
                    {editingItem ? "Update" : "Create"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DAIncidentalMaster;
