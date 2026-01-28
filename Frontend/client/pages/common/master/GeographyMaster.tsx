import React, { useEffect, useState } from "react";
import {
  Globe,
  Plus,
  Edit2,
  Trash2,
  X,
  Save,
  Search,
  MapPin,
  Map,
} from "lucide-react";
import { toast } from "sonner";
import { locationAPI } from "@/src/api/master_location";
// import { Layout } from "@/components/Layout";

function Modal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function ColumnPanel({
  title,
  icon: Icon,
  items,
  selectedId,
  onSelect,
  onAdd,
  onEdit,
  onDelete,
  searchPlaceholder,
  renderItem,
  emptyMessage,
}) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredItems = searchTerm
    ? items.filter((item) =>
        renderItem(item).toLowerCase().includes(searchTerm.toLowerCase()),
      )
    : items;

  return (
    <div className="flex-1 bg-white rounded-lg border border-gray-200 flex flex-col h-full">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Icon className="w-5 h-5 text-slate-600" />
            <h3 className="font-semibold text-slate-800">{title}</h3>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
              {filteredItems.length}
            </span>
          </div>
          <button
            onClick={onAdd}
            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title={`Add ${title}`}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {filteredItems.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <p className="text-sm">{emptyMessage}</p>
          </div>
        ) : (
          <div className="divide-y divide-white">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                onClick={() => onSelect(item)}
                className={`p-3 cursor-pointer transition-colors flex items-center justify-between group ${
                  selectedId === item.id
                    ? "bg-blue-50 border-l-4 border-blue-600"
                    : "hover:bg-gray-50 border-l-4 border-transparent"
                }`}
              >
                <div className="flex-1">
                  <div className="font-medium text-slate-800 text-sm">
                    {renderItem(item)}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(item);
                    }}
                    className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(item.id);
                    }}
                    className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CityItem({ city, categories, onEdit, onDelete, onUpdateCategory }) {
  const getCategoryBadge = (categoryId) => {
    if (!categoryId) return null;
    const category = categories.find((c) => c.id === categoryId);
    const colors = {
      1: "bg-green-100 text-green-700",
      2: "bg-blue-100 text-blue-700",
      3: "bg-orange-100 text-orange-700",
    };
    return (
      <span
        className={`text-xs px-2 py-0.5 rounded font-medium ${colors[categoryId] || "bg-gray-100 text-gray-700"}`}
      >
        {category?.name || "Unknown"}
      </span>
    );
  };

  return (
    <div className="p-3 border-b border-gray-100 hover:bg-gray-50 transition-colors group">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <MapPin className="w-4 h-4 text-slate-400" />
          <div className="flex-1">
            <div className="font-medium text-slate-800 text-sm">
              {city.city_name}
            </div>
            <div className="flex items-center gap-2 mt-1">
              {getCategoryBadge(city.category)}
              <select
                value={city.category || ""}
                onChange={(e) => onUpdateCategory(city.id, e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">No category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(city);
            }}
            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(city.id);
            }}
            className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function GeographyMaster() {
  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  const [categories, setCategories] = useState([]);

  const [selectedCountry, setSelectedCountry] = useState(null);
  const [selectedState, setSelectedState] = useState(null);
  const [loading, setLoading] = useState(true);

  const [countryModal, setCountryModal] = useState({ open: false, data: null });
  const [stateModal, setStateModal] = useState({ open: false, data: null });
  const [cityModal, setCityModal] = useState({ open: false, data: null });
  const [citySearchTerm, setCitySearchTerm] = useState("");

  const fetchCountries = async () => {
    try {
      const res = await locationAPI.getCountries();
      const countriesList = res.data.results || res.data.data || res.data || [];
      setCountries(countriesList);

      // Auto-select India or first country
      const india = countriesList.find((c) => c.country_name === "India");
      const defaultCountry = india || countriesList[0];
      if (defaultCountry) {
        setSelectedCountry(defaultCountry);
        await fetchStates(defaultCountry.id);
      }
    } catch (error) {
      console.error("Error fetching countries:", error);
      toast.error("Failed to load countries");
    }
  };

  const fetchStates = async (countryId) => {
    try {
      const res = await locationAPI.getStates(countryId);
      const statesList = res.data.results || res.data.data || [];
      setStates(statesList);

      // Auto-select first state
      if (statesList.length > 0) {
        setSelectedState(statesList[0]);
        await fetchCities(countryId, statesList[0].id);
      } else {
        setSelectedState(null);
        setCities([]);
      }
    } catch (error) {
      console.error("Error fetching states:", error);
      toast.error("Failed to load states");
      setStates([]);
    }
  };

  const fetchCities = async (countryId, stateId) => {
    try {
      const res = await locationAPI.getCities(countryId, stateId);
      setCities(res.data.results || res.data.data || []);
    } catch (error) {
      console.error("Error fetching cities:", error);
      toast.error("Failed to load cities");
      setCities([]);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await locationAPI.getCityCategories();
      // console.log(res.data.data.results);
      setCategories(res.data.data.results || res.data.data || []);
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchCategories();
      await fetchCountries();
      setLoading(false);
    };
    init();
  }, []);

  const handleCountrySelect = async (country) => {
    setSelectedCountry(country);
    setSelectedState(null);
    setCities([]);
    await fetchStates(country.id);
  };

  const handleStateSelect = async (state) => {
    setSelectedState(state);
    if (selectedCountry) {
      await fetchCities(selectedCountry.id, state.id);
    }
  };

  // Country CRUD
  const handleSaveCountry = async (formData) => {
    try {
      if (countryModal.data) {
        await locationAPI.updateCountry(countryModal.data.id, formData);
        toast.success("Country updated successfully!");
      } else {
        await locationAPI.createCountry(formData);
        toast.success("Country created successfully!");
      }
      await fetchCountries();
      setCountryModal({ open: false, data: null });
    } catch (error) {
      console.error("Error saving country:", error);
      toast.error(
        error.response?.data?.errors?.country_name[0] ||
          error.response?.data?.errors?.country_code[0] ||
          "Failed to save country",
      );
    }
  };

  const handleDeleteCountry = async (id) => {
    if (
      window.confirm(
        "Delete this country? All states and cities will also be deleted.",
      )
    ) {
      try {
        await locationAPI.deleteCountry(id);
        toast.success("Country deleted successfully!");
        setSelectedCountry(null);
        setSelectedState(null);
        setStates([]);
        setCities([]);
        await fetchCountries();
      } catch (error) {
        console.error("Error deleting country:", error);
        toast.error(
          error.response?.data?.message || "Failed to delete country",
        );
      }
    }
  };

  // State CRUD
  const handleSaveState = async (formData) => {
    try {
      if (stateModal.data) {
        await locationAPI.updateState(stateModal.data.id, {
          ...formData,
          country: selectedCountry.id,
        });
        toast.success("State updated successfully!");
      } else {
        await locationAPI.createState({
          ...formData,
          country: selectedCountry.id,
        });
        toast.success("State created successfully!");
      }
      if (selectedCountry) {
        await fetchStates(selectedCountry.id);
      }
      setStateModal({ open: false, data: null });
    } catch (error) {
      console.error("Error saving state:", error);
      toast.error(error.response?.data?.message || "Failed to save state");
    }
  };

  const handleDeleteState = async (id) => {
    if (window.confirm("Delete this state? All cities will also be deleted.")) {
      try {
        await locationAPI.deleteState(id);
        toast.success("State deleted successfully!");
        if (selectedCountry) {
          await fetchStates(selectedCountry.id);
        }
        setSelectedState(null);
        setCities([]);
      } catch (error) {
        console.error("Error deleting state:", error);
        toast.error(error.response?.data?.message || "Failed to delete state");
      }
    }
  };

  // City CRUD
  const handleSaveCity = async (formData) => {
    try {
      if (cityModal.data) {
        const { id, ...updateData } = formData;
        await locationAPI.updateCity(cityModal.data.id, updateData);
        toast.success("City updated successfully!");
      } else {
        await locationAPI.createCity({ ...formData, state: selectedState.id });
        toast.success("City created successfully!");
      }
      if (selectedCountry && selectedState) {
        await fetchCities(selectedCountry.id, selectedState.id);
      }
      setCityModal({ open: false, data: null });
    } catch (error) {
      console.error("Error saving city:", error);
      toast.error(error.response?.data?.message || "Failed to save city");
    }
  };

  const handleDeleteCity = async (id) => {
    if (window.confirm("Delete this city?")) {
      try {
        await locationAPI.deleteCity(id);
        toast.success("City deleted successfully!");
        if (selectedCountry && selectedState) {
          await fetchCities(selectedCountry.id, selectedState.id);
        }
      } catch (error) {
        console.error("Error deleting city:", error);
        toast.error(error.response?.data?.message || "Failed to delete city");
      }
    }
  };

  const handleUpdateCityCategory = async (cityId, categoryId) => {
    try {
      await locationAPI.updateCityCategoryMaster(
        cityId,
        categoryId ? parseInt(categoryId) : null,
      );
      setCities(
        cities.map((c) =>
          c.id === cityId
            ? { ...c, category: categoryId ? parseInt(categoryId) : null }
            : c,
        ),
      );
      toast.success("City category updated!");
    } catch (error) {
      console.error("Error updating category:", error);
      toast.error("Failed to update category");
    }
  };

  const filteredCities = citySearchTerm
    ? cities.filter((c) =>
        c.city_name.toLowerCase().includes(citySearchTerm.toLowerCase()),
      )
    : cities;

  if (loading) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-slate-600">Loading geography data...</div>
      </div>
    );
  }

  return (
    // <Layout>
    <div className="p-6 bg-gray-50 min-h-screen mb-10">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-800">
            Geography Master
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage countries, states, cities, and assign city categories
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4 h-[calc(100vh-200px)]">
          {/* Countries Column */}
          <ColumnPanel
            title="Countries"
            icon={Globe}
            items={countries}
            selectedId={selectedCountry?.id}
            onSelect={handleCountrySelect}
            onAdd={() => setCountryModal({ open: true, data: null })}
            onEdit={(country) => setCountryModal({ open: true, data: country })}
            onDelete={handleDeleteCountry}
            searchPlaceholder="Search countries..."
            renderItem={(country) => country.country_name}
            emptyMessage="No countries found"
          />

          {/* States Column */}
          <ColumnPanel
            title="States"
            icon={Map}
            items={states}
            selectedId={selectedState?.id}
            onSelect={handleStateSelect}
            onAdd={() =>
              selectedCountry
                ? setStateModal({ open: true, data: null })
                : toast.error("Please select a country first")
            }
            onEdit={(state) => setStateModal({ open: true, data: state })}
            onDelete={handleDeleteState}
            searchPlaceholder="Search states..."
            renderItem={(state) => state.state_name}
            emptyMessage={
              selectedCountry ? "No states found" : "Select a country"
            }
          />

          {/* Cities Column */}
          <div className="flex-1 bg-white rounded-lg border border-gray-200 flex flex-col h-full">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-slate-600" />
                  <h3 className="font-semibold text-slate-800">Cities</h3>
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                    {filteredCities.length}
                  </span>
                </div>
                <button
                  onClick={() =>
                    selectedState
                      ? setCityModal({ open: true, data: null })
                      : toast.error("Please select a state first")
                  }
                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  title="Add City"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  placeholder="Search cities..."
                  value={citySearchTerm}
                  onChange={(e) => setCitySearchTerm(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredCities.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <p className="text-sm">
                    {selectedState ? "No cities found" : "Select a state"}
                  </p>
                </div>
              ) : (
                filteredCities.map((city) => (
                  <CityItem
                    key={city.id}
                    city={city}
                    categories={categories}
                    onEdit={(city) => setCityModal({ open: true, data: city })}
                    onDelete={handleDeleteCity}
                    onUpdateCategory={handleUpdateCityCategory}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Modals */}
        <Modal
          isOpen={countryModal.open}
          onClose={() => setCountryModal({ open: false, data: null })}
          title={countryModal.data ? "Edit Country" : "Add Country"}
        >
          <CountryForm
            data={countryModal.data}
            onSubmit={handleSaveCountry}
            onCancel={() => setCountryModal({ open: false, data: null })}
          />
        </Modal>

        <Modal
          isOpen={stateModal.open}
          onClose={() => setStateModal({ open: false, data: null })}
          title={stateModal.data ? "Edit State" : "Add State"}
        >
          <StateForm
            data={stateModal.data}
            onSubmit={handleSaveState}
            onCancel={() => setStateModal({ open: false, data: null })}
          />
        </Modal>

        <Modal
          isOpen={cityModal.open}
          onClose={() => setCityModal({ open: false, data: null })}
          title={cityModal.data ? "Edit City" : "Add City"}
        >
          <CityForm
            data={cityModal.data}
            categories={categories}
            onSubmit={handleSaveCity}
            onCancel={() => setCityModal({ open: false, data: null })}
          />
        </Modal>
      </div>
    </div>
    //</Layout>
  );
}

function CountryForm({ data, onSubmit, onCancel }) {
  const [formData, setFormData] = useState(data || {});
  const handleSubmit = () => {
    if (!formData.country_name) {
      toast.error("Please enter country name");
      return;
    }
    // if (!formData.country_code) {
    //   toast.error("Please enter country code");
    //   return;
    // }
    onSubmit(formData);
  };
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Country Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.country_name || ""}
          onChange={(e) =>
            setFormData({ ...formData, country_name: e.target.value })
          }
          className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      {/* <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Country Code <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          maxLength={3}
          value={formData.country_code || ""}
          onChange={(e) =>
            setFormData({
              ...formData,
              country_code: e.target.value.toUpperCase(),
            })
          }
          placeholder="e.g. IND, USA"
          className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div> */}
      <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm text-slate-600 hover:bg-gray-100 rounded-md"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          Save
        </button>
      </div>
    </div>
  );
}

function StateForm({ data, onSubmit, onCancel }) {
  const [formData, setFormData] = useState(data || {});
  const handleSubmit = () => {
    if (!formData.state_name) {
      toast.error("Please enter state name");
      return;
    }
    // if (!formData.state_code) {
    //   toast.error("Please enter state code");
    //   return;
    // }
    onSubmit(formData);
  };
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          State Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.state_name || ""}
          onChange={(e) =>
            setFormData({ ...formData, state_name: e.target.value })
          }
          className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      {/* <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          State Code <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          maxLength={3}
          value={formData.state_code || ""}
          onChange={(e) =>
            setFormData({
              ...formData,
              state_code: e.target.value.toUpperCase(),
            })
          }
          placeholder="e.g. GJ, MH"
          className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div> */}
      <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm text-slate-600 hover:bg-gray-100 rounded-md"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          Save
        </button>
      </div>
    </div>
  );
}

function CityForm({ data, categories, onSubmit, onCancel }) {
  const [formData, setFormData] = useState(data || {});
  const handleSubmit = () => {
    if (!formData.city_name) {
      toast.error("Please enter city name");
      return;
    }
    // if (!formData.city_code) {
    //     toast.error("Please enter city code");
    //     return;
    // }
    if (!formData.category) {
      toast.error("Please select city category");
      return;
    }
    onSubmit(formData);
  };
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          City Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.city_name || ""}
          onChange={(e) =>
            setFormData({ ...formData, city_name: e.target.value })
          }
          className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      {/* <div><label className="block text-sm font-medium text-slate-700 mb-1">City Code <span className="text-red-500">*</span></label><input type="text" value={formData.city_code || ""} onChange={(e) => setFormData({ ...formData, city_code: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" /></div> */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Category <span className="text-red-500">*</span>
        </label>
        <select
          value={formData.category || ""}
          onChange={(e) =>
            setFormData({
              ...formData,
              category: e.target.value ? parseInt(e.target.value) : null,
            })
          }
          className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">No category</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm text-slate-600 hover:bg-gray-100 rounded-md"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          Save
        </button>
      </div>
    </div>
  );
}
