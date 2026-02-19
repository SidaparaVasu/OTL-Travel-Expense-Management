import React, { useState, useEffect } from "react";
import { travelAPI } from "@/src/api/travel";
import { masterAPI } from "@/src/api/master";
import { locationAPI } from "@/src/api/master_location";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Plus,
  Edit2,
  Trash2,
  Search,
  Filter,
  Plane,
  Train,
  Car,
  Hotel,
  CheckCircle,
  XCircle,
  ChevronDown,
  CircleAlert,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const MODE_ICONS = {
  Flight: Plane,
  Train: Train,
  Conveyance: Car,
  Accommodation: Hotel,
};

// Multi-select dropdown component
function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
  valueKey = "id",
  labelKey = "name",
  placeholder = "Select...",
  error,
  required = false,
}) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleOption = (optionValue) => {
    if (selected.includes(optionValue)) {
      onChange(selected.filter((v) => v !== optionValue));
    } else {
      onChange([...selected, optionValue]);
    }
  };

  const getDisplayText = () => {
    if (selected.length === 0) return placeholder;
    if (selected.length === 1) {
      const item = options.find((o) => o[valueKey] === selected[0]);
      return item ? item[labelKey] : placeholder;
    }
    return `${selected.length} selected`;
  };

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3 py-2 text-left bg-white border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 flex items-center justify-between ${error ? "border-red-500" : "border-gray-300"}`}
      >
        <span className="text-sm text-slate-700">{getDisplayText()}</span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
            {options.length === 0 ? (
              <div className="px-3 py-2 text-sm text-slate-500">
                No options available
              </div>
            ) : (
              options.map((option) => (
                <label
                  key={option[valueKey]}
                  className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(option[valueKey])}
                    onChange={() => toggleOption(option[valueKey])}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-slate-700">
                    {option[labelKey]}
                  </span>
                </label>
              ))
            )}
          </div>
        </>
      )}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}

export default function GradeEntitlementMaster() {
  const { toast } = useToast();

  const [data, setData] = useState([]);
  const [grades, setGrades] = useState([]);
  const [travelSubOptions, setTravelSubOptions] = useState([]);
  const [cityCategories, setCityCategories] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterGrade, setFilterGrade] = useState("all");
  const [filterMode, setFilterMode] = useState("all");
  const [formErrors, setFormErrors] = useState({});

  const [expandedGrades, setExpandedGrades] = useState({});

  const [form, setForm] = useState({
    grade: "",
    sub_option: "",
    city_category: "",
    max_amount: "",
    is_allowed: true,
    // Bulk creation fields
    grades: [],
    sub_options: [],
    city_categories: [],
  });

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [entRes, gradeRes, subRes, cityRes] = await Promise.all([
        travelAPI.getGradeEntitlement(),
        masterAPI.getGrades(),
        travelAPI.getTravelSubOptions(),
        locationAPI.getCityCategories(),
      ]);
      setData(entRes.data || []);
      setGrades(gradeRes.data.results || []);
      setTravelSubOptions(subRes.results || subRes.data || subRes || []);
      setCityCategories(cityRes.data.data.results || []);
    } catch (error) {
      console.error("Failed to fetch data", error);
      toast({
        title: "Error",
        description: "Failed to load data. Please refresh the page.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    // Clear error for this field when user starts typing
    if (formErrors[key]) {
      setFormErrors((prev) => ({ ...prev, [key]: null }));
    }
  };

  const validateForm = () => {
    const errors = {};

    const hasAccommodation = form.sub_options.some(isAccommodationSubOption);

    if (hasAccommodation && form.city_categories.length === 0) {
      errors.city_categories = "City category is required for accommodation";
    }

    if (selectedItem) {
      // Edit mode - single record validation
      if (!form.grade) errors.grade = "Grade is required";
      if (!form.sub_option) errors.sub_option = "Travel sub-option is required";
    } else {
      // Create mode - bulk validation
      if (form.grades.length === 0)
        errors.grades = "At least one grade is required";
      if (form.sub_options.length === 0)
        errors.sub_options = "At least one travel sub-option is required";
    }

    if (form.max_amount && isNaN(parseFloat(form.max_amount))) {
      errors.max_amount = "Max amount must be a valid number";
    }
    if (form.max_amount && parseFloat(form.max_amount) < 0) {
      errors.max_amount = "Max amount cannot be negative";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const resetForm = () => {
    setForm({
      grade: "",
      sub_option: "",
      city_category: "",
      max_amount: "",
      is_allowed: true,
      grades: [],
      sub_options: [],
      city_categories: [],
    });
    setFormErrors({});
    setSelectedItem(null);
  };

  const handleOpen = (item = null) => {
    if (item) {
      setSelectedItem(item);
      setForm({
        grade: String(item.grade),
        sub_option: String(item.sub_option),
        city_category: item.city_category ? String(item.city_category) : "all",
        max_amount: item.max_amount || "",
        is_allowed: item.is_allowed,
        grades: [],
        sub_options: [],
        city_categories: [],
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast({
        title: "Validation Error",
        description: "Please fill all required fields correctly",
        variant: "destructive",
      });
      return;
    }

    try {
      if (selectedItem) {
        // Edit mode - single record update
        const submitData = {
          grade: form.grade,
          sub_option: form.sub_option,
          city_category:
            form.city_category === "all" ? null : form.city_category || null,
          max_amount: form.max_amount ? parseFloat(form.max_amount) : null,
          is_allowed: form.is_allowed,
        };

        await travelAPI.updateGradeEntitlement(selectedItem.id, submitData);
        toast({
          title: "Success",
          description: "Entitlement updated successfully",
        });
      } else {
        // Create mode - bulk creation
        const recordsToCreate = [];

        form.grades.forEach((gradeId) => {
          form.sub_options.forEach((subOptionId) => {
            const isAccommodation = isAccommodationSubOption(subOptionId);

            if (isAccommodation) {
              form.city_categories.forEach((cityId) => {
                recordsToCreate.push({
                  grade: gradeId,
                  sub_option: subOptionId,
                  city_category: cityId,
                  max_amount: form.max_amount
                    ? parseFloat(form.max_amount)
                    : null,
                  is_allowed: form.is_allowed,
                });
              });
            } else {
              recordsToCreate.push({
                grade: gradeId,
                sub_option: subOptionId,
                city_category: null,
                max_amount: form.max_amount
                  ? parseFloat(form.max_amount)
                  : null,
                is_allowed: form.is_allowed,
              });
            }
          });
        });

        await travelAPI.bulkCreateGradeEntitlements({
          records: recordsToCreate,
        });
        toast({
          title: "Success",
          description: `Successfully created ${recordsToCreate.length} entitlement record(s)`,
        });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchAll();
    } catch (error) {
      console.error("Save failed", error);

      // Handle specific error responses
      if (error.response?.data) {
        const errorData = error.response.data;

        // Handle unique constraint violation
        if (errorData.non_field_errors || errorData.detail) {
          const message = errorData.non_field_errors?.[0] || errorData.detail;
          if (
            message.includes("unique") ||
            message.includes("already exists")
          ) {
            toast({
              title: "Duplicate Entry",
              description:
                "An entitlement with this combination already exists",
              variant: "destructive",
            });
            return;
          }
        }

        // Handle field-specific errors
        const fieldErrors = {};
        Object.keys(errorData).forEach((key) => {
          if (Array.isArray(errorData[key])) {
            fieldErrors[key] = errorData[key][0];
          }
        });

        if (Object.keys(fieldErrors).length > 0) {
          setFormErrors(fieldErrors);
          toast({
            title: "Validation Error",
            description: "Please check the form for errors",
            variant: "destructive",
          });
          return;
        }
      }

      // Generic error
      toast({
        title: "Error",
        description: "Failed to save entitlement. Please try again.",
        variant: "destructive",
      });
    }
  };

  const confirmDelete = async () => {
    try {
      await travelAPI.deleteGradeEntitlement(selectedItem.id);
      setIsDeleteOpen(false);
      setSelectedItem(null);
      fetchAll();
      toast({
        title: "Success",
        description: "Entitlement deleted successfully",
      });
    } catch (error) {
      console.error("Delete failed", error);

      if (error.response?.status === 404) {
        toast({
          title: "Not Found",
          description: "This record no longer exists",
          variant: "destructive",
        });
      } else if (error.response?.data?.detail) {
        toast({
          title: "Error",
          description: error.response.data.detail,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to delete record. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  // Get unique modes from data
  const uniqueModes = [
    ...new Set(data.map((item) => item.mode_name).filter(Boolean)),
  ];

  // Filter data
  const filteredData = data.filter((item) => {
    const matchesSearch =
      item.grade_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sub_option_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.mode_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.city_category_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesGrade =
      filterGrade === "all" || String(item.grade) === filterGrade;
    const matchesMode = filterMode === "all" || item.mode_name === filterMode;

    return matchesSearch && matchesGrade && matchesMode;
  });

  // Group data by grade
  const groupedData = filteredData.reduce((acc, item) => {
    const gradeName = item.grade_name;
    if (!acc[gradeName]) acc[gradeName] = [];
    acc[gradeName].push(item);
    return acc;
  }, {});

  // Calculate number of records to be created
  const calculateRecordsCount = () => {
    if (selectedItem) return 1;
    const cityCount = form.city_categories.length || 1;
    return form.grades.length * form.sub_options.length * cityCount;
  };

  const isAccommodationSubOption = (subOptionId) => {
    const sub = travelSubOptions.find((s) => s.id === subOptionId);
    return sub?.mode_name === "Accommodation";
  };

  const isAccommodationEdit =
    travelSubOptions.find((t) => t.id === Number(form.sub_option))
      ?.mode_name === "Accommodation";

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading entitlements...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gradient-to-br from-slate-50 to-gray-100 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-3xl font-bold text-slate-800">
              Grade Entitlement Master
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Manage travel entitlements for different grades
            </p>
          </div>
          <Button
            onClick={() => handleOpen()}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
          >
            <Plus size={16} /> Add Entitlement
          </Button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[250px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search by grade, option, or city..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filterGrade} onValueChange={setFilterGrade}>
              <SelectTrigger className="w-[180px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by Grade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Grades</SelectItem>
                {grades.map((g) => (
                  <SelectItem key={g.id} value={String(g.id)}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterMode} onValueChange={setFilterMode}>
              <SelectTrigger className="w-[180px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by Mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modes</SelectItem>
                {uniqueModes.map((mode) => (
                  <SelectItem key={mode} value={mode}>
                    {mode}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Data Display */}
        {filteredData.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="p-6 bg-slate-100 rounded-full">
                <Plane className="w-12 h-12 text-slate-400" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-slate-800 mb-2">
                  No entitlements found
                </h3>
                <p className="text-slate-500 mb-4">
                  {searchTerm || filterGrade !== "all" || filterMode !== "all"
                    ? "Try adjusting your filters"
                    : "Get started by adding your first entitlement"}
                </p>
              </div>
              {!searchTerm && filterGrade === "all" && filterMode === "all" && (
                <Button
                  onClick={() => handleOpen()}
                  className="flex items-center gap-2"
                >
                  <Plus size={16} /> Add Entitlement
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedData).map(([gradeName, items]) => {
              const isExpanded = expandedGrades[gradeName] || false;

              return (
                <div
                  key={gradeName}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
                >
                  {/* Header - make it clickable */}
                  <button
                    onClick={() =>
                      setExpandedGrades((prev) => ({
                        ...prev,
                        [gradeName]: !prev[gradeName],
                      }))
                    }
                    className="w-full bg-gradient-to-r from-blue-50 to-purple-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between hover:bg-blue-50/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <ChevronDown
                        className={`w-5 h-5 text-slate-600 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      />
                      <div className="text-left">
                        <h3 className="text-lg font-semibold text-slate-800">
                          {gradeName}
                        </h3>
                        <p className="text-sm text-slate-600">
                          {items.length} entitlement
                          {items.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                  </button>
                  {/* Table - only show when expanded */}
                  {isExpanded && (
                    <div className="overflow-x-auto">
                      <table className="min-w-full">
                        <thead className="bg-gray-50">
                          <tr className="whitespace-nowrap">
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                              Mode
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                              Travel Option
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">
                              City Category
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">
                              Max Amount
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                              Status
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {items.map((item) => {
                            const ModeIcon = MODE_ICONS[item.mode_name] || Car;
                            return (
                              <tr
                                key={item.id}
                                className="hover:bg-gray-50 transition-colors whitespace-nowrap"
                              >
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-2">
                                    <ModeIcon className="w-4 h-4 text-blue-600" />
                                    <span className="font-medium text-slate-700">
                                      {item.mode_name}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-slate-700">
                                  {item.sub_option_name}
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-sm">
                                    {item.city_category_name || "All Cities"}
                                  </span>
                                </td>
                                <td className="px-6 py-4 font-medium text-slate-700 text-center">
                                  {item.max_amount
                                    ? `₹${parseFloat(item.max_amount).toLocaleString()}`
                                    : "—"}
                                </td>
                                <td className="px-6 py-4">
                                  {item.is_allowed ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                      <CheckCircle className="w-3 h-3" />
                                      Allowed
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                                      <XCircle className="w-3 h-3" />
                                      Not Allowed
                                    </span>
                                  )}
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleOpen(item)}
                                      className="hover:bg-blue-50 hover:text-blue-600"
                                    >
                                      <Edit2 size={16} />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setSelectedItem(item);
                                        setIsDeleteOpen(true);
                                      }}
                                      className="hover:bg-red-50 hover:text-red-600"
                                    >
                                      <Trash2 size={16} />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Add/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold">
                {selectedItem
                  ? "Edit Entitlement"
                  : "Add Entitlement (Bulk Create)"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {selectedItem ? (
                // Edit Mode - Single Selection
                <>
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                      Grade <span className="text-red-500">*</span>
                    </label>
                    <Select
                      value={form.grade}
                      onValueChange={(v) => handleChange("grade", v)}
                    >
                      <SelectTrigger
                        className={formErrors.grade ? "border-red-500" : ""}
                      >
                        <SelectValue placeholder="Select Grade" />
                      </SelectTrigger>
                      <SelectContent>
                        {grades.map((g) => (
                          <SelectItem key={g.id} value={String(g.id)}>
                            {g.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formErrors.grade && (
                      <p className="text-red-500 text-xs mt-1">
                        {formErrors.grade}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                      Travel Sub-Option <span className="text-red-500">*</span>
                    </label>
                    <Select
                      value={form.sub_option}
                      onValueChange={(v) => handleChange("sub_option", v)}
                    >
                      <SelectTrigger
                        className={
                          formErrors.sub_option ? "border-red-500" : ""
                        }
                      >
                        <SelectValue placeholder="Select Sub Option" />
                      </SelectTrigger>
                      <SelectContent>
                        {travelSubOptions.map((t) => (
                          <SelectItem key={t.id} value={String(t.id)}>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-500">
                                {t.mode_name}
                              </span>
                              <span>→</span>
                              <span>{t.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formErrors.sub_option && (
                      <p className="text-red-500 text-xs mt-1">
                        {formErrors.sub_option}
                      </p>
                    )}
                  </div>

                  {isAccommodationEdit && (
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                        City Category
                      </label>
                      <Select
                        value={form.city_category}
                        onValueChange={(v) => handleChange("city_category", v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All cities" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All cities</SelectItem>
                          {cityCategories.map((c) => (
                            <SelectItem key={c.id} value={String(c.id)}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </>
              ) : (
                // Create Mode - Multi-Selection
                <>
                  <MultiSelectDropdown
                    label="Grades"
                    options={grades}
                    selected={form.grades}
                    onChange={(selected) => handleChange("grades", selected)}
                    placeholder="Select grades"
                    error={formErrors.grades}
                    required
                  />

                  <MultiSelectDropdown
                    label="Travel Sub-Options"
                    options={travelSubOptions.map((t) => ({
                      ...t,
                      name: `${t.mode_name} → ${t.name}`,
                    }))}
                    selected={form.sub_options}
                    onChange={(selected) =>
                      handleChange("sub_options", selected)
                    }
                    placeholder="Select sub-options"
                    error={formErrors.sub_options}
                    required
                  />

                  {form.sub_options.some(isAccommodationSubOption) && (
                    <MultiSelectDropdown
                      label="City Categories (Required for Accommodation)"
                      options={cityCategories}
                      selected={form.city_categories}
                      onChange={(selected) =>
                        handleChange("city_categories", selected)
                      }
                      placeholder="Select city categories"
                      required
                    />
                  )}
                </>
              )}

              <div>
                <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                  Max Amount (₹)
                </label>
                <Input
                  type="number"
                  placeholder="Enter maximum amount"
                  value={form.max_amount}
                  onChange={(e) => handleChange("max_amount", e.target.value)}
                  className={formErrors.max_amount ? "border-red-500" : ""}
                  min="0"
                  step="0.01"
                />
                {formErrors.max_amount && (
                  <p className="text-red-500 text-xs mt-1">
                    {formErrors.max_amount}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                <Switch
                  checked={form.is_allowed}
                  onCheckedChange={(v) => handleChange("is_allowed", v)}
                />
                <div>
                  <span className="font-medium text-slate-700">Is Allowed</span>
                  <p className="text-xs text-slate-500">
                    Enable this entitlement for the selected grade
                  </p>
                </div>
              </div>

              {/* Info Box for Bulk Creation */}
              {!selectedItem &&
                form.grades.length > 0 &&
                form.sub_options.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                    <p className="text-sm text-blue-800 font-medium mb-2">
                      Records to be created:
                    </p>
                    <p className="text-sm text-blue-700">
                      {form.grades.length} grade(s) × {form.sub_options.length}{" "}
                      option(s) × {form.city_categories.length || 1} city/cities
                      =
                      <strong className="ml-1 text-blue-900">
                        {calculateRecordsCount()} records
                      </strong>
                    </p>
                  </div>
                )}
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {selectedItem
                  ? "Update"
                  : `Create ${!selectedItem && calculateRecordsCount() > 1 ? `(${calculateRecordsCount()} records)` : ""}`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Deletion</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-slate-600">
                Are you sure you want to delete this entitlement? This action
                cannot be undone.
              </p>
              {selectedItem && (
                <div className="mt-4 p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm">
                    <span className="font-medium">Grade:</span>{" "}
                    {selectedItem.grade_name}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Option:</span>{" "}
                    {selectedItem.sub_option_name}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">City:</span>{" "}
                    {selectedItem.city_category_name || "All Cities"}
                  </p>
                </div>
              )}
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmDelete}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
