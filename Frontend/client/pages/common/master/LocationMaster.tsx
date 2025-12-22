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
  MapPin,
} from "lucide-react";
import { organizationMasterAPI } from "@/src/api/master_company";
import { locationAPI } from "@/src/api/master_location";

const LocationMaster = () => {
  const [locations, setLocations] = useState([]);
  const [filteredLocations, setFilteredLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterActive, setFilterActive] = useState("all");
  const [filterCompany, setFilterCompany] = useState("");
  const [filterState, setFilterState] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [notification, setNotification] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Dropdown data
  const [companies, setCompanies] = useState([]);
  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  const [filteredStates, setFilteredStates] = useState([]);
  const [filteredCities, setFilteredCities] = useState([]);

  const [formData, setFormData] = useState({
    location_name: "",
    location_code: "",
    company: "",
    country: "",
    state: "",
    city: "",
    address: "",
    is_active: true,
  });

  useEffect(() => {
    fetchLocations();
    fetchDropdownData();
  }, []);

  useEffect(() => {
    filterLocations();
  }, [
    locations,
    searchTerm,
    filterActive,
    filterCompany,
    filterState,
    filterCity,
  ]);

  // Filter states based on selected country
  useEffect(() => {
    if (formData.country) {
      const filtered = states.filter(
        (s) => s.country === parseInt(formData.country),
      );
      setFilteredStates(filtered);
      // Reset state and city if country changes
      if (
        formData.state &&
        !filtered.find((s) => s.id === parseInt(formData.state))
      ) {
        setFormData((prev) => ({ ...prev, state: "", city: "" }));
      }
    } else {
      setFilteredStates([]);
      setFormData((prev) => ({ ...prev, state: "", city: "" }));
    }
  }, [formData.country, states]);

  // Filter cities based on selected state
  useEffect(() => {
    if (formData.state) {
      const filtered = cities.filter(
        (c) => c.state === parseInt(formData.state),
      );
      setFilteredCities(filtered);
      // Reset city if state changes
      if (
        formData.city &&
        !filtered.find((c) => c.id === parseInt(formData.city))
      ) {
        setFormData((prev) => ({ ...prev, city: "" }));
      }
    } else {
      setFilteredCities([]);
      setFormData((prev) => ({ ...prev, city: "" }));
    }
  }, [formData.state, cities]);

  const fetchDropdownData = async () => {
    try {
      const companiesData = await organizationMasterAPI.company.getAll();
      setCompanies(companiesData.data.results || companiesData.results);

      const countriesData = await locationAPI.getCountries();
      setCountries(countriesData.data.data || countriesData);

      const statesData = await locationAPI.getStatesWithoutCountry();
      setStates(statesData.data.data || statesData.data.results);

      const citiesData = await locationAPI.getCities();
      setCities(citiesData.data.data || citiesData);
    } catch (error) {
      showNotification("Failed to fetch dropdown data", "error");
    }
  };

  const fetchLocations = async () => {
    setLoading(true);
    try {
      const data = await locationAPI.location.getAll();
      setLocations(data.data.results || data.results);
    } catch (error) {
      showNotification("Failed to fetch locations", "error");
    } finally {
      setLoading(false);
    }
  };

  const filterLocations = () => {
    let filtered = locations;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (l) =>
          l.location_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          l.location_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          l.city_name?.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    // Active/Inactive filter
    if (filterActive !== "all") {
      filtered = filtered.filter((l) =>
        filterActive === "active" ? l.is_active : !l.is_active,
      );
    }

    // Company filter
    if (filterCompany) {
      filtered = filtered.filter((l) => l.company === parseInt(filterCompany));
    }

    // State filter
    if (filterState) {
      filtered = filtered.filter((l) => l.state === parseInt(filterState));
    }

    // City filter
    if (filterCity) {
      filtered = filtered.filter((l) => l.city === parseInt(filterCity));
    }

    setFilteredLocations(filtered);
  };

  const showNotification = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      location_name: formData.location_name,
      location_code: formData.location_code,
      company: parseInt(formData.company),
      city: parseInt(formData.city),
      state: parseInt(formData.state),
      country: parseInt(formData.country),
      address: formData.address,
      is_active: formData.is_active,
    };

    try {
      if (editingItem) {
        await locationAPI.location.update(editingItem.location_id, payload);
        showNotification("Location updated successfully");
      } else {
        await locationAPI.location.create(payload);
        showNotification("Location created successfully");
      }
      fetchLocations();
      closeModal();
    } catch (error) {
      showNotification("Operation failed", "error");
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      location_name: item.location_name,
      location_code: item.location_code,
      company: item.company.toString(),
      country: item.country.toString(),
      state: item.state.toString(),
      city: item.city.toString(),
      address: item.address || "",
      is_active: item.is_active,
    });
    setShowModal(true);
  };

  const handleSoftDelete = async (item) => {
    try {
      const payload = { ...item, is_active: false };
      await locationAPI.location.update(item.location_id, payload);
      showNotification("Location deactivated successfully");
      fetchLocations();
    } catch (error) {
      showNotification("Failed to deactivate location", "error");
    }
  };

  const handleHardDelete = async () => {
    if (!deleteTarget) return;

    try {
      await locationAPI.location.delete(deleteTarget.location_id);
      showNotification("Location deleted successfully");
      fetchLocations();
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
    } catch (error) {
      showNotification("Failed to delete location", "error");
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
      location_name: "",
      location_code: "",
      company: "",
      country: "",
      state: "",
      city: "",
      address: "",
      is_active: true,
    });
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
              Are you sure you want to permanently delete this location? This
              action cannot be undone.
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
            Location Master
          </h1>
          <p className="text-slate-600">Manage office and branch locations</p>
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
                  placeholder="Search by location name, code, or city..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <select
                value={filterCompany}
                onChange={(e) => setFilterCompany(e.target.value)}
                className="px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Companies</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>

              <select
                value={filterState}
                onChange={(e) => {
                  setFilterState(e.target.value);
                  setFilterCity("");
                }}
                className="px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All States</option>
                {states.map((state) => (
                  <option key={state.id} value={state.id}>
                    {state.state_name}
                  </option>
                ))}
              </select>

              <select
                value={filterCity}
                onChange={(e) => setFilterCity(e.target.value)}
                disabled={!filterState}
                className="px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              >
                <option value="">All Cities</option>
                {cities
                  .filter(
                    (c) => !filterState || c.state === parseInt(filterState),
                  )
                  .map((city) => (
                    <option key={city.id} value={city.id}>
                      {city.city_name}
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
          ) : filteredLocations.length === 0 ? (
            <div className="p-12 text-center">
              <MapPin className="mx-auto text-slate-300 mb-4" size={48} />
              <p className="text-slate-600">No locations found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Location Name
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Location Code
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Company
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      City
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      State
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Country
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredLocations.map((location) => (
                    <tr
                      key={location.location_id}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900">
                            {location.location_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded text-sm font-mono">
                          {location.location_code}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-700">
                        {location.company_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-700">
                        {location.city_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-700">
                        {location.state_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-700">
                        {location.country_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                            location.is_active
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {location.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleEdit(location)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={18} />
                          </button>
                          {location.is_active && (
                            <button
                              onClick={() => handleSoftDelete(location)}
                              className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                              title="Deactivate"
                            >
                              <XCircle size={18} />
                            </button>
                          )}
                          <button
                            onClick={() => openDeleteConfirm(location)}
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
            <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800">
                  {editingItem ? "Edit Location" : "Create Location"}
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
                  {/* Location Name */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Location Name *
                    </label>
                    <input
                      type="text"
                      value={formData.location_name}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          location_name: e.target.value,
                        })
                      }
                      required
                      placeholder="e.g., Mumbai Head Office"
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Location Code */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Location Code *
                    </label>
                    <input
                      type="text"
                      value={formData.location_code}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          location_code: e.target.value,
                        })
                      }
                      required
                      maxLength={10}
                      placeholder="e.g., MUM-HO"
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Company */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Company *
                    </label>
                    <select
                      value={formData.company}
                      onChange={(e) =>
                        setFormData({ ...formData, company: e.target.value })
                      }
                      required
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select company</option>
                      {companies.map((company) => (
                        <option key={company.id} value={company.id}>
                          {company.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Country */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Country *
                    </label>
                    <select
                      value={formData.country}
                      onChange={(e) =>
                        setFormData({ ...formData, country: e.target.value })
                      }
                      required
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select country</option>
                      {countries.map((country) => (
                        <option key={country.id} value={country.id}>
                          {country.country_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* State */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      State *
                    </label>
                    <select
                      value={formData.state}
                      onChange={(e) =>
                        setFormData({ ...formData, state: e.target.value })
                      }
                      required
                      disabled={!formData.country}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    >
                      <option value="">Select state</option>
                      {filteredStates.map((state) => (
                        <option key={state.id} value={state.id}>
                          {state.state_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* City */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      City *
                    </label>
                    <select
                      value={formData.city}
                      onChange={(e) =>
                        setFormData({ ...formData, city: e.target.value })
                      }
                      required
                      disabled={!formData.state}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    >
                      <option value="">Select city</option>
                      {filteredCities.map((city) => (
                        <option key={city.id} value={city.id}>
                          {city.city_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Address */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Address
                    </label>
                    <textarea
                      value={formData.address}
                      onChange={(e) =>
                        setFormData({ ...formData, address: e.target.value })
                      }
                      rows={3}
                      placeholder="Enter full address"
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

export default LocationMaster;
