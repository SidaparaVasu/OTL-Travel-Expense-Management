import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Check,
  Building2,
  FileText,
  MapPin,
  Phone,
  Users,
  Wrench,
  DollarSign,
  Trash2,
} from "lucide-react";
// import { Layout } from "@/components/Layout";
import { accommodationAPI } from "@/src/api/master_accommodation";
import { locationAPI } from "@/src/api/master_location";

const ARCHotelForm = ({ editId = null, onCancel }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [formData, setFormData] = useState({
    name: "",
    hotel_type: "",
    star_rating: "",
    group_name: "",
    category: "",
    is_active: true,
    gstin: "",
    pan: "",
    operating_since: "",
    address: "",
    city: "",
    state: "",
    country: "",
    postal_code: "",
    phone_number: "",
    email: "",
    website: "",
    social_media: {},
    total_rooms: "",
    room_types: [],
    check_in_time: "",
    check_out_time: "",
    facilities: {},
    rate_per_night: "",
    tax_percentage: 12.0,
    contract_start_date: "",
    contract_end_date: "",
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [roomTypeInput, setRoomTypeInput] = useState({ type: "", count: "" });
  const [socialMediaInput, setSocialMediaInput] = useState({
    platform: "",
    url: "",
  });

  const [dropdownData, setDropdownData] = useState({
    countries: [],
    states: [],
    cities: [],
  });

  // Fetch countries and initial data on mount
  useEffect(() => {
    const fetchDropdownData = async () => {
      try {
        setLoading(true);
        const [countryRes, glCodeRes] = await Promise.all([
          locationAPI.getCountries(),
        ]);

        const countriesList =
          countryRes.data.results || countryRes.data.data || [];

        setDropdownData((prev) => ({
          ...prev,
          countries: countriesList,
        }));
      } catch (error) {
        console.error("Error fetching dropdown data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDropdownData();
  }, []);

  // When country changes → fetch states
  useEffect(() => {
    const fetchStates = async () => {
      if (!formData.country) {
        setDropdownData((prev) => ({ ...prev, states: [], cities: [] }));
        return;
      }

      try {
        const res = await locationAPI.getStates(formData.country);
        const statesList = res.data.results || res.data.data || [];
        setDropdownData((prev) => ({
          ...prev,
          states: statesList,
          cities: [],
        }));
      } catch (error) {
        console.error("Error fetching states:", error);
        setDropdownData((prev) => ({ ...prev, states: [], cities: [] }));
      }
    };

    fetchStates();
  }, [formData.country]);

  // When state changes → fetch cities
  useEffect(() => {
    const fetchCities = async () => {
      if (!formData.state || !formData.country) {
        setDropdownData((prev) => ({ ...prev, cities: [] }));
        return;
      }

      try {
        const res = await locationAPI.getCities(
          formData.country,
          formData.state,
        );
        const citiesList = res.data.results || res.data.data || [];
        setDropdownData((prev) => ({ ...prev, cities: citiesList }));
      } catch (error) {
        console.error("Error fetching cities:", error);
        setDropdownData((prev) => ({ ...prev, cities: [] }));
      }
    };

    fetchCities();
  }, [formData.state]);

  const tabs = [
    { id: 0, label: "Basic Info", icon: Building2 },
    { id: 1, label: "Financial", icon: FileText },
    { id: 2, label: "Location", icon: MapPin },
    { id: 3, label: "Contact", icon: Phone },
    { id: 4, label: "Capacity", icon: Users },
    { id: 5, label: "Facilities", icon: Wrench },
    { id: 6, label: "Rate & Contract", icon: DollarSign },
  ];

  const facilitiesList = [
    "Swimming Pool",
    "Gym",
    "Spa",
    "Restaurant",
    "Bar",
    "Room Service",
    "Laundry",
    "WiFi",
    "Parking",
    "Conference Hall",
    "Banquet Hall",
    "Airport Shuttle",
    "Concierge",
    "Business Center",
  ];

  const socialPlatforms = [
    "Facebook",
    "Twitter",
    "Instagram",
    "LinkedIn",
    "YouTube",
  ];

  // Simulate loading dropdown data
  useEffect(() => {
    setTimeout(() => setLoading(false), 500);
  }, []);

  // Fetch edit data
  useEffect(() => {
    if (editId) {
      const fetchData = async () => {
        try {
          const response = await accommodationAPI.arcHotel.get(editId);
          const data = response.data.data;

          // Properly map the response data to formData structure
          setFormData({
            name: data.name || "",
            hotel_type: data.hotel_type || "",
            star_rating: data.star_rating || "",
            group_name: data.group_name || "",
            category: data.category || "",
            is_active: data.is_active ?? true,
            gstin: data.gstin || "",
            pan: data.pan || "",
            operating_since: data.operating_since || "",
            address: data.address || "",
            city: data.city || "",
            state: data.state || "",
            country: data.country || "",
            postal_code: data.postal_code || "",
            phone_number: data.phone_number || "",
            email: data.email || "",
            website: data.website || "",
            social_media: data.social_media || {},
            total_rooms: data.total_rooms || "",
            room_types: data.room_types || [],
            check_in_time: data.check_in_time || "",
            check_out_time: data.check_out_time || "",
            facilities: data.facilities || {},
            rate_per_night: data.rate_per_night || "",
            tax_percentage: data.tax_percentage || "",
            contract_start_date: data.contract_start_date || "",
            contract_end_date: data.contract_end_date || "",
          });
        } catch (error) {
          console.error("Error fetching guest house:", error);
          toast.error("Failed to load guest house data");
        }
      };
      fetchData();
    }
  }, [editId]);

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: null }));
  };

  const addRoomType = () => {
    if (roomTypeInput.type && roomTypeInput.count) {
      setFormData((prev) => ({
        ...prev,
        room_types: [...prev.room_types, { ...roomTypeInput }],
      }));
      setRoomTypeInput({ type: "", count: "" });
    }
  };

  const removeRoomType = (idx) => {
    setFormData((prev) => ({
      ...prev,
      room_types: prev.room_types.filter((_, i) => i !== idx),
    }));
  };

  const addSocialMedia = () => {
    if (socialMediaInput.platform && socialMediaInput.url) {
      setFormData((prev) => ({
        ...prev,
        social_media: {
          ...prev.social_media,
          [socialMediaInput.platform]: socialMediaInput.url,
        },
      }));
      setSocialMediaInput({ platform: "", url: "" });
    }
  };

  const removeSocialMedia = (platform) => {
    setFormData((prev) => {
      const updated = { ...prev.social_media };
      delete updated[platform];
      return { ...prev, social_media: updated };
    });
  };

  const toggleFacility = (facility) => {
    setFormData((prev) => ({
      ...prev,
      facilities: {
        ...prev.facilities,
        [facility]: !prev.facilities[facility],
      },
    }));
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.name) newErrors.name = "Required";
    if (!formData.address) newErrors.address = "Required";
    if (!formData.phone_number) newErrors.phone_number = "Required";
    // Optional: category, rate_per_night, contract_dates
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      toast.success("Please fix validation errors");
      return;
    }
    try {
      setSubmitting(true);

      // Sanitize payload: convert empty strings to null for optional fields
      const payload = { ...formData };
      if (!payload.rate_per_night) payload.rate_per_night = null;
      if (!payload.contract_start_date) payload.contract_start_date = null;
      if (!payload.rate_per_night) payload.rate_per_night = null;
      if (!payload.contract_start_date) payload.contract_start_date = null;
      if (!payload.contract_end_date) payload.contract_end_date = null;
      if (!payload.category) payload.category = null;

      // Fix for 400 Bad Request: Convert empty strings to null for other optional fields
      if (!payload.star_rating) payload.star_rating = null;
      if (!payload.operating_since) payload.operating_since = null;
      if (!payload.total_rooms) payload.total_rooms = null;
      if (!payload.check_in_time) payload.check_in_time = null;
      if (!payload.check_out_time) payload.check_out_time = null;
      if (!payload.hotel_type) payload.hotel_type = null;
      if (!payload.country) payload.country = null;
      if (!payload.state) payload.state = null;
      if (!payload.city) payload.city = null;

      const response = editId
        ? await accommodationAPI.arcHotel.update(editId, payload)
        : await accommodationAPI.arcHotel.create(payload);
      toast.success("ARC Hotel saved successfully!");

      if (onCancel) onCancel(); // Redirect back to list
    } catch (error) {
      console.error("Submission error:", error);
      toast.error(
        error.response?.data?.message || "Failed to save. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 0: // Basic Info
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Hotel Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => updateField("name", e.target.value)}
                className={`w-full px-3 py-2 border rounded ${errors.name ? "border-red-500" : "border-gray-300"}`}
              />
              {errors.name && (
                <p className="text-red-500 text-xs mt-1">{errors.name}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Hotel Type
                </label>
                <select
                  value={formData.hotel_type}
                  onChange={(e) => updateField("hotel_type", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                >
                  <option value="">Select</option>
                  <option value="resort">Resort</option>
                  <option value="business">Business</option>
                  <option value="boutique">Boutique</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Star Rating
                </label>
                <select
                  value={formData.star_rating}
                  onChange={(e) => updateField("star_rating", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                >
                  <option value="">Select</option>
                  {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                    <option key={i} value={i}>
                      {i} Star
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Group Name
                </label>
                <input
                  type="text"
                  value={formData.group_name}
                  onChange={(e) => updateField("group_name", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                  placeholder="e.g., Taj Hotels"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => updateField("category", e.target.value)}
                  className={`w-full px-3 py-2 border rounded ${errors.category ? "border-red-500" : "border-gray-300"}`}
                >
                  <option value="">Select</option>
                  <option value="3_star">3 Star</option>
                  <option value="4_star">4 Star</option>
                  <option value="5_star">5 Star</option>
                  <option value="budget">Budget</option>
                  <option value="deluxe">Deluxe</option>
                </select>
                {errors.category && (
                  <p className="text-red-500 text-xs mt-1">{errors.category}</p>
                )}
              </div>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => updateField("is_active", e.target.checked)}
                className="mr-2"
              />
              <label className="text-sm font-medium">Active</label>
            </div>
          </div>
        );

      case 1: // Financial
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">GSTIN</label>
                <input
                  type="text"
                  value={formData.gstin}
                  onChange={(e) => updateField("gstin", e.target.value)}
                  maxLength="15"
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                  placeholder="22AAAAA0000A1Z5"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">PAN</label>
                <input
                  type="text"
                  value={formData.pan}
                  onChange={(e) => updateField("pan", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                  placeholder="ABCDE1234F"
                  maxLength="10"
                />
              </div>
            </div>
            <div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Operating Since (Year)
                </label>
                <input
                  type="number"
                  value={formData.operating_since}
                  onChange={(e) =>
                    updateField("operating_since", e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                  placeholder="1995"
                  min="1900"
                  max={new Date().getFullYear()}
                />
              </div>
            </div>
          </div>
        );

      case 2: // Location
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Address *
              </label>
              <textarea
                value={formData.address}
                onChange={(e) => updateField("address", e.target.value)}
                className={`w-full px-3 py-2 border rounded ${errors.address ? "border-red-500" : "border-gray-300"}`}
                rows="3"
              />
              {errors.address && (
                <p className="text-red-500 text-xs mt-1">{errors.address}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Country
                </label>
                <select
                  value={formData.country}
                  onChange={(e) => updateField("country", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                >
                  <option value="">Select Country</option>
                  {dropdownData.countries?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.country_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">State</label>
                <select
                  value={formData.state}
                  onChange={(e) => updateField("state", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                >
                  <option value="">Select State</option>
                  {dropdownData.states.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.state_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">City</label>
                <select
                  value={formData.city}
                  onChange={(e) => updateField("city", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                >
                  <option value="">Select City</option>
                  {dropdownData.cities?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.city_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Postal Code
                </label>
                <input
                  type="text"
                  value={formData.postal_code}
                  onChange={(e) => updateField("postal_code", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                  placeholder="400001"
                />
              </div>
            </div>
          </div>
        );

      case 3: // Contact
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Phone Number *
              </label>
              <input
                type="tel"
                value={formData.phone_number}
                onChange={(e) => updateField("phone_number", e.target.value)}
                className={`w-full px-3 py-2 border rounded ${errors.phone_number ? "border-red-500" : "border-gray-300"}`}
                placeholder="+91 1234567890"
              />
              {errors.phone_number && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.phone_number}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => updateField("email", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded"
                placeholder="contact@hotel.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Website</label>
              <input
                type="url"
                value={formData.website}
                onChange={(e) => updateField("website", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded"
                placeholder="https://www.hotel.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Social Media
              </label>
              <div className="flex gap-2 mb-2">
                <select
                  value={socialMediaInput.platform}
                  onChange={(e) =>
                    setSocialMediaInput({
                      ...socialMediaInput,
                      platform: e.target.value,
                    })
                  }
                  className="px-3 py-2 border border-gray-300 rounded"
                >
                  <option value="">Select Platform</option>
                  {socialPlatforms.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <input
                  type="url"
                  value={socialMediaInput.url}
                  onChange={(e) =>
                    setSocialMediaInput({
                      ...socialMediaInput,
                      url: e.target.value,
                    })
                  }
                  className="flex-1 px-3 py-2 border border-gray-300 rounded"
                  placeholder="URL"
                />
                <button
                  onClick={addSocialMedia}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Add
                </button>
              </div>
              {Object.keys(formData.social_media).length > 0 && (
                <div className="space-y-2">
                  {Object.entries(formData.social_media).map(
                    ([platform, url]) => (
                      <div
                        key={platform}
                        className="flex justify-between items-center border border-gray-300 p-2 rounded"
                      >
                        <span className="text-sm">
                          <strong>{platform}:</strong> {url}
                        </span>
                        <button
                          onClick={() => removeSocialMedia(platform)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ),
                  )}
                </div>
              )}
            </div>
          </div>
        );

      case 4: // Capacity
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Total Rooms
                </label>
                <input
                  type="number"
                  value={formData.total_rooms}
                  onChange={(e) => updateField("total_rooms", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Room Types
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={roomTypeInput.type}
                  onChange={(e) =>
                    setRoomTypeInput({ ...roomTypeInput, type: e.target.value })
                  }
                  className="flex-1 px-3 py-2 border border-gray-300 rounded"
                  placeholder="Type (e.g., Deluxe)"
                />
                <input
                  type="number"
                  value={roomTypeInput.count}
                  onChange={(e) =>
                    setRoomTypeInput({
                      ...roomTypeInput,
                      count: e.target.value,
                    })
                  }
                  className="w-24 px-3 py-2 border border-gray-300 rounded"
                  placeholder="Count"
                />
                <button
                  onClick={addRoomType}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Add
                </button>
              </div>
              {formData.room_types && formData.room_types.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {formData.room_types.map((rt, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between border border-gray-300 items-center p-2 rounded"
                    >
                      <span className="text-sm">
                        {rt.type}: {rt.count}
                      </span>
                      <button
                        onClick={() => removeRoomType(idx)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Check-in Time
                </label>
                <input
                  type="time"
                  value={formData.check_in_time}
                  onChange={(e) => updateField("check_in_time", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Check-out Time
                </label>
                <input
                  type="time"
                  value={formData.check_out_time}
                  onChange={(e) =>
                    updateField("check_out_time", e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                />
              </div>
            </div>
          </div>
        );

      case 5: // Facilities
        return (
          <div className="space-y-4">
            <label className="block text-sm font-medium mb-2">
              Available Facilities
            </label>
            <div className="grid grid-cols-2 gap-2">
              {facilitiesList.map((facility) => (
                <label key={facility} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.facilities[facility] || false}
                    onChange={() => toggleFacility(facility)}
                    className="mr-2"
                  />
                  <span className="text-sm">{facility}</span>
                </label>
              ))}
            </div>
          </div>
        );

      case 6: // Rate & Contract
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Rate Per Night
                </label>
                <input
                  type="number"
                  value={formData.rate_per_night}
                  onChange={(e) =>
                    updateField("rate_per_night", e.target.value)
                  }
                  className={`w-full px-3 py-2 border rounded ${errors.rate_per_night ? "border-red-500" : "border-gray-300"}`}
                  placeholder="0.00"
                  step="0.01"
                />
                {errors.rate_per_night && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.rate_per_night}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Tax Percentage
                </label>
                <input
                  type="number"
                  value={formData.tax_percentage}
                  onChange={(e) =>
                    updateField("tax_percentage", e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                  step="0.01"
                />
              </div>
            </div>
            {formData.rate_per_night && formData.tax_percentage && (
              <div className="bg-blue-50 p-3 rounded">
                <p className="text-sm text-gray-700">
                  <strong>Total Rate with Tax:</strong> ₹
                  {formData.rate_per_night} + {formData.tax_percentage}% =
                  <strong>
                    {" "}
                    ₹
                    {(
                      parseFloat(formData.rate_per_night) +
                      (parseFloat(formData.rate_per_night) *
                        parseFloat(formData.tax_percentage)) /
                        100
                    ).toFixed(2)}
                  </strong>
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Contract Start Date
                </label>
                <input
                  type="date"
                  value={formData.contract_start_date}
                  onChange={(e) =>
                    updateField("contract_start_date", e.target.value)
                  }
                  className={`w-full px-3 py-2 border rounded ${errors.contract_start_date ? "border-red-500" : "border-gray-300"}`}
                />
                {errors.contract_start_date && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.contract_start_date}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Contract End Date
                </label>
                <input
                  type="date"
                  value={formData.contract_end_date}
                  onChange={(e) =>
                    updateField("contract_end_date", e.target.value)
                  }
                  className={`w-full px-3 py-2 border rounded ${errors.contract_end_date ? "border-red-500" : "border-gray-300"}`}
                />
                {errors.contract_end_date && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.contract_end_date}
                  </p>
                )}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    // <Layout>
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg border border-b overflow-hidden">
          <div className="bg-white px-6 py-4 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-slate-800">ARC Hotel</h1>
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>

          <div className="flex">
            <div className="w-64 bg-gray-50 border-r border-gray-200">
              <nav className="space-y-0">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
                        isActive
                          ? "bg-blue-500 text-white"
                          : "text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      <Icon size={20} />
                      <span className="font-medium">{tab.label}</span>
                      {isActive && <Check size={16} className="ml-auto" />}
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="flex-1 p-8">
              <div className="max-w-4xl">
                <h2 className="text-xl font-semibold mb-6">
                  {tabs[activeTab].label}
                </h2>
                {renderTabContent()}

                <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
                  <button
                    onClick={() => setActiveTab(Math.max(0, activeTab - 1))}
                    disabled={activeTab === 0}
                    className="px-6 py-2 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  {activeTab < tabs.length - 1 ? (
                    <button
                      onClick={() => setActiveTab(activeTab + 1)}
                      className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      Next
                    </button>
                  ) : (
                    <button
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="px-6 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submitting ? "Submitting..." : "Submit"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    // </Layout>
  );
};

export default ARCHotelForm;
