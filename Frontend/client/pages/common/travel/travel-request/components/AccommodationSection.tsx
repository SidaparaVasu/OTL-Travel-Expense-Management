import React, { useState, useEffect, useMemo } from "react";
import { Home, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { FormInput } from "./FormInput";
import { FormSelect } from "./FormSelect";
import { FormTextarea } from "./FormTextarea";
import { NotRequiredToggle } from "./NotRequiredToggle";
import { DataTable } from "./DataTable";
import { GuestHouseSelector } from "./GuestHouseSelector";
import { ARCHotelSelector } from "./ARCHotelSelector";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { TimePickerField } from "./TimePickerField";
import { CityCombobox } from "./CityCombobox";
import { DatePickerField } from "./DatePickerField";
import { getEmptyAccommodation } from "../lib/travel-constants";
import {
  isDateInRange,
  validateEstimatedCost,
  validateSpecialInstructions,
  isAmountWithinLimit,
} from "../lib/travel-validation";

interface AccommodationFormData {
  accommodation_type: string;
  accommodation_type_label: string;
  accommodation_sub_option: string;
  accommodation_sub_option_label: string;
  guest_house_preferences: number[];
  arc_hotel_preferences: number[];
  place: string;
  place_label: string;
  check_in_date: string;
  check_in_time: string;
  check_out_date: string;
  check_out_time: string;
  estimated_cost: string;
  meal_preference?: string;
  special_instruction: string;
}

interface AccommodationSectionProps {
  accommodation: AccommodationFormData[];
  setAccommodation: React.Dispatch<
    React.SetStateAction<AccommodationFormData[]>
  >;
  notRequired: boolean;
  setNotRequired: (value: boolean) => void;
  tripStartDate: string;
  tripEndDate: string;
  travelModes: any[];
  travelSubOptions: Record<string, any>;
  guestHouses: any[];
  arcHotels: any[];
  cities: any[];
  bookingErrors?: Record<number, string>;
}

export const AccommodationSection: React.FC<AccommodationSectionProps> = ({
  accommodation,
  setAccommodation,
  notRequired,
  setNotRequired,
  tripStartDate,
  tripEndDate,
  travelModes,
  travelSubOptions,
  guestHouses,
  arcHotels,
  cities,
  bookingErrors = {},
}) => {
  const [form, setForm] = useState<AccommodationFormData>(
    getEmptyAccommodation(),
  );
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const currentSubOptions = travelSubOptions[form.accommodation_type] || [];
  console.log("In AccommodationSection: ", currentSubOptions);
  console.log("FormData: ", form);

  const mode = form.accommodation_sub_option_label?.toLowerCase() || "";
  const isGuestHouseSelected =
    mode.includes("guest house") || mode.includes("guest");
  const isARCHotelSelected =
    mode.includes("company arranged") ||
    mode.includes("company") ||
    mode.includes("company-tied") ||
    mode.includes("ARC") ||
    mode.includes("arc");
  const isSelfArranged =
    mode.includes("self arranged") || mode.includes("self");

  const selectedSubOption = form.accommodation_sub_option
    ? currentSubOptions.find(
        (s) => String(s.id) === form.accommodation_sub_option,
      )
    : undefined;

  const selectedCity = cities.find((c) => String(c.id) === form.place);

  let derivedCityCategory: string | undefined;

  if (isSelfArranged) {
    const selectedCity = cities.find((c) => String(c.id) === form.place);
    derivedCityCategory = selectedCity?.category_name;
  } else if (isGuestHouseSelected) {
    // For guest house, try to get category from selection or require place selection
    if (form.guest_house_preferences.length > 0) {
      const gh = guestHouses.find(
        (g) => g.id === form.guest_house_preferences[0],
      );
      console.log(gh, gh?.city, gh?.city_category);
      derivedCityCategory = gh?.city_category;
    } else if (form.place) {
      // Fallback to place selection if no guest house selected
      const selectedCity = cities.find((c) => String(c.id) === form.place);
      derivedCityCategory = selectedCity?.category_name;
    }
  } else if (isARCHotelSelected && form.arc_hotel_preferences.length > 0) {
    const hotel = arcHotels.find((h) => h.id === form.arc_hotel_preferences[0]);
    derivedCityCategory = hotel?.city_category;
  }

  const selectedLimit = selectedSubOption?.limits?.find(
    (l) => l.city_category === derivedCityCategory,
  );
  const maxAllowed = selectedLimit?.max_amount;
  console.log("selectedSubOption: ", selectedSubOption);
  console.log("selectedSubOption.limits: ", selectedSubOption?.limits);
  console.log("selectedCity: ", selectedCity);
  console.log("derivedCityCategory: ", derivedCityCategory);
  console.log("selectedLimit: ", selectedLimit, " maxAllowed: ", maxAllowed);

  // Auto-select sub-option based on accommodation type change
  useEffect(() => {
    // Do nothing if type is empty OR sub-options not loaded
    if (!form.accommodation_type_label || currentSubOptions.length === 0)
      return;

    const type = form.accommodation_type_label.toLowerCase();

    // Guest House
    if (type.includes("company") || type.includes("company arranged")) {
      const guestHouse = currentSubOptions.find((opt) =>
        opt.name.toLowerCase().includes("guest"),
      );

      if (
        guestHouse &&
        form.accommodation_sub_option !== String(guestHouse.id)
      ) {
        setForm((prev) => ({
          ...prev,
          accommodation_sub_option: String(guestHouse.id),
          accommodation_sub_option_label: guestHouse.name,
          arc_hotel_preferences: [],
          place: "",
        }));
      }
    }

    // ARC / Company-tied Hotels
    else if (
      type.includes("arc") ||
      type.includes("company-tied") ||
      type.includes("hotel")
    ) {
      const arcHotel = currentSubOptions.find((opt) =>
        opt.name.toLowerCase().includes("hotel"),
      );

      if (arcHotel && form.accommodation_sub_option !== String(arcHotel.id)) {
        setForm((prev) => ({
          ...prev,
          accommodation_sub_option: String(arcHotel.id),
          accommodation_sub_option_label: arcHotel.name,
          guest_house_preferences: [],
          place: "",
        }));
      }
    }

    // Self-arranged Stay
    else if (type.includes("self")) {
      const selfArranged = currentSubOptions.find((opt) =>
        opt.name.toLowerCase().includes("self"),
      );

      if (
        selfArranged &&
        form.accommodation_sub_option !== String(selfArranged.id)
      ) {
        setForm((prev) => ({
          ...prev,
          accommodation_sub_option: String(selfArranged.id),
          accommodation_sub_option_label: selfArranged.name,
          guest_house_preferences: [],
          arc_hotel_preferences: [],
          place: "",
        }));
      }
    }
  }, [form.accommodation_type_label, currentSubOptions]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!form.accommodation_type)
      newErrors.accommodation_type = "Accommodation type is required";
    if (!form.accommodation_sub_option)
      newErrors.accommodation_sub_option = "Sub-option is required";
    if (!form.check_in_date)
      newErrors.check_in_date = "Check-in date is required";
    if (!form.check_out_date)
      newErrors.check_out_date = "Check-out date is required";
    if (!form.check_in_time)
      newErrors.check_in_time = "Check-in time is required";
    if (!form.check_out_time)
      newErrors.check_out_time = "Check-out time is required";
    // if (!form.estimated_cost) newErrors.estimated_cost = "Estimated cost is required";

    // Guest house preferences required for Guest House - REMOVED CHECK
    // if (isGuestHouseSelected && form.guest_house_preferences.length === 0) {
    //   newErrors.guest_house_preferences = "At least one guest house preference is required";
    // }

    // Companies-tied Hotels (ARC Hotels) preferences required for Companies-tied Hotels (ARC Hotels)
    if (isARCHotelSelected && form.arc_hotel_preferences.length === 0) {
      newErrors.arc_hotel_preferences =
        "At least one hotel preference is required";
    }

    // Place required for Guest House to determine city category
    if (isGuestHouseSelected && !form.place) {
      newErrors.place = "Location is required to determine entitlement limit";
    }

    // Place required for self-arranged accommodation
    if (isSelfArranged && !form.place) {
      newErrors.place = "Location is required";
    }

    // Date range validation
    if (form.check_in_date && tripStartDate && tripEndDate) {
      if (!isDateInRange(form.check_in_date, tripStartDate, tripEndDate)) {
        newErrors.check_in_date = "Check-in must be within trip dates";
      }
    }
    if (form.check_out_date && tripStartDate && tripEndDate) {
      if (!isDateInRange(form.check_out_date, tripStartDate, tripEndDate)) {
        newErrors.check_out_date = "Check-out must be within trip dates";
      }
    }

    // Check-out after check-in
    if (
      form.check_in_date &&
      form.check_out_date &&
      form.check_out_date < form.check_in_date
    ) {
      newErrors.check_out_date =
        "Check-out date cannot be before check-in date";
    }

    // Validate estimated cost against entitlement
    if (form.estimated_cost && form.estimated_cost.trim() !== "") {
      const cost = Number(form.estimated_cost);
      
      // First check if cost is a valid number
      const costError = validateEstimatedCost(form.estimated_cost);
      if (costError) {
        newErrors.estimated_cost = costError;
      } else if (form.accommodation_sub_option && !derivedCityCategory) {
        // Cannot determine limit without city category
        newErrors.estimated_cost = "Please select accommodation location to determine entitlement limit";
      } else if (maxAllowed === undefined && form.accommodation_sub_option) {
        // Limit should be defined but isn't found
        newErrors.estimated_cost = "Cannot determine entitlement limit. Please contact support.";
      } else if (maxAllowed !== undefined && cost > maxAllowed) {
        // Cost exceeds limit
        newErrors.estimated_cost = `Maximum allowed is ₹${maxAllowed.toLocaleString('en-IN')} for ${derivedCityCategory}`;
      }
    }

    // Special instructions
    const instructionError = validateSpecialInstructions(
      form.special_instruction,
    );
    if (instructionError) newErrors.special_instruction = instructionError;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCostBlur = () => {
    if (maxAllowed && Number(form.estimated_cost) > maxAllowed) {
      setForm({
        ...form,
        estimated_cost: String(maxAllowed),
      });
      toast.warning(`Amount capped to maximum allowed: ₹${maxAllowed.toLocaleString('en-IN')}`);
    }
  };

  const entitlement = useMemo(() => {
    if (!form.accommodation_sub_option) return null;

    const sub = currentSubOptions.find(
      (s) => String(s.id) === form.accommodation_sub_option,
    );
    if (!sub || !sub.limits?.length) return null;

    // derive city category here
    const category = derivedCityCategory;
    if (!category) return null;

    const limit = sub.limits.find((l) => l.city_category === category);
    return limit || null;
  }, [form.accommodation_sub_option, derivedCityCategory, currentSubOptions]);

  const handleCostChange = (value: number | undefined) => {
    const valueStr = value?.toString() || "";
    setForm({ ...form, estimated_cost: valueStr });

    // Clear error when user is typing
    if (errors.estimated_cost) {
      setErrors((prev) => ({
        ...prev,
        estimated_cost: "",
      }));
    }
  };

  const handleSubmit = () => {
    if (!validateForm()) {
      toast.error("Please fix validation errors before adding");
      return;
    }

    // Additional check: ensure limit is enforced (should already be caught by validateForm)
    if (form.estimated_cost && maxAllowed !== undefined) {
      const cost = Number(form.estimated_cost);
      if (cost > maxAllowed) {
        toast.error(`Amount exceeds maximum allowed: ₹${maxAllowed.toLocaleString('en-IN')}`);
        return; // BLOCK ADD
      }
    }

    if (editIndex !== null) {
      const updated = [...accommodation];
      updated[editIndex] = { ...form };
      setAccommodation(updated);
      toast.success("Accommodation updated successfully");
    } else {
      setAccommodation([...accommodation, { ...form }]);
      toast.success("Accommodation added successfully");
    }

    setForm(getEmptyAccommodation());
    setEditIndex(null);
    setErrors({});
  };

  const handleEdit = (index: number) => {
    setEditIndex(index);
    setForm(accommodation[index]);
    setErrors({});
  };

  const handleDelete = (index: number) => {
    if (window.confirm("Delete this accommodation?")) {
      setAccommodation(accommodation.filter((_, i) => i !== index));
      if (editIndex !== null && editIndex >= index) {
        setForm(getEmptyAccommodation());
        setEditIndex(null);
        setErrors({});
      }
      toast.success("Accommodation deleted");
    }
  };

  const handleTypeChange = (typeId: string) => {
    const mode = travelModes.find((m) => String(m.id) === typeId);
    setForm({
      ...getEmptyAccommodation(),
      accommodation_type: typeId,
      accommodation_type_label: mode?.name || "",
    });
    setErrors({});
  };

  const columns = [
    {
      label: "Type",
      render: (row: AccommodationFormData) => {
        const type = travelModes.find(
          (t) => String(t.id) === row.accommodation_type,
        );
        const subOption = travelSubOptions[row.accommodation_type]?.find(
          (s) => String(s.id) === row.accommodation_sub_option,
        );
        return `${type?.name || ""} - ${subOption?.name || ""}`;
      },
    },
    {
      label: "Accommodation",
      render: (row: AccommodationFormData) => {
        // 1. Guest House selected
        // 1. Guest House selected
        if (
          row.accommodation_sub_option_label?.toLowerCase().includes("guest")
          // && row.guest_house_preferences?.length > 0
        ) {
          // return row.guest_house_preferences
          //   .map((id) => guestHouses.find((gh) => gh.id === id)?.name)
          //   .filter(Boolean)
          //   .join(", ");
          return "Guest House";
        }

        // 2. ARC / Company-tied Hotels
        if (
          row.accommodation_sub_option_label?.toLowerCase().includes("hotel") &&
          row.arc_hotel_preferences?.length > 0
        ) {
          return row.arc_hotel_preferences
            .map((id) => arcHotels.find((h) => h.id === id)?.name)
            .filter(Boolean)
            .join(", ");
        }

        // 3. Self-arranged Stay
        if (
          row.accommodation_sub_option_label?.toLowerCase().includes("self")
        ) {
          return row.place_label || "N/A";
        }

        // 4. Default
        return "-";
      },
    },
    {
      label: "Check-in",
      render: (row: AccommodationFormData) =>
        `${row.check_in_date} ${row.check_in_time || ""}`,
    },
    {
      label: "Check-out",
      render: (row: AccommodationFormData) =>
        `${row.check_out_date} ${row.check_out_time || ""}`,
    },
    {
      label: "Cost (₹)",
      align: "right" as const,
      render: (row: AccommodationFormData) =>
        `₹${Number(row.estimated_cost || 0).toLocaleString("en-IN")}`,
    },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <Home className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            Accommodation
          </h2>
          <p className="text-sm text-muted-foreground">
            Add your accommodation requirements
          </p>
        </div>
      </div>

      <NotRequiredToggle
        checked={notRequired}
        onChange={(checked) => {
          setNotRequired(checked);
          if (checked) {
            setForm(getEmptyAccommodation());
            setEditIndex(null);
            setErrors({});
          }
        }}
        section="accommodation"
      />

      {!notRequired && (
        <>
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground mb-4">
              {editIndex !== null
                ? "Edit Accommodation"
                : "Add New Accommodation"}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormSelect
                label="Accommodation Type"
                required
                value={form.accommodation_type}
                onChange={handleTypeChange}
                options={[
                  { value: "", label: "Select type" },
                  ...travelModes.map((m) => ({
                    value: String(m.id),
                    label: m.name,
                  })),
                ]}
                error={errors.accommodation_type}
              />

              <FormSelect
                label="Accommodation Mode"
                required
                value={form.accommodation_sub_option}
                onChange={(value) => {
                  const subOption = currentSubOptions.find(
                    (s) => String(s.id) === value,
                  );
                  setForm({
                    ...form,
                    accommodation_sub_option: value,
                    accommodation_sub_option_label: subOption?.name || "",
                    guest_house_preferences: [],
                    arc_hotel_preferences: [],
                    place: "",
                  });
                }}
                options={[
                  {
                    value: "",
                    label: form.accommodation_type
                      ? "Select sub-option"
                      : "Select type first",
                  },
                  ...currentSubOptions.map((s) => ({
                    value: String(s.id),
                    label: s.name,
                  })),
                ]}
                disabled={!form.accommodation_type}
                error={errors.accommodation_sub_option}
              />

              {isGuestHouseSelected ? (
                <CityCombobox
                  label="Place/Location"
                  required
                  cities={cities}
                  value={form.place ? parseInt(form.place) : null}
                  displayValue={form.place_label}
                  onChange={(id, label) =>
                    setForm({
                      ...form,
                      place: id ? String(id) : "",
                      place_label: label,
                    })
                  }
                  placeholder="Enter location for entitlement calculation"
                  error={errors.place}
                />
              ) : isARCHotelSelected ? (
                <ARCHotelSelector
                  selectedPreferences={form.arc_hotel_preferences}
                  setSelectedPreferences={(prefs) =>
                    setForm({ ...form, arc_hotel_preferences: prefs })
                  }
                  arcHotels={arcHotels}
                  error={errors.arc_hotel_preferences}
                />
              ) : (
                <CityCombobox
                  label="Place/Location"
                  required
                  cities={cities}
                  value={form.place ? parseInt(form.place) : null}
                  displayValue={form.place_label}
                  onChange={(id, label) =>
                    setForm({
                      ...form,
                      place: id ? String(id) : "",
                      place_label: label,
                    })
                  }
                  placeholder="Enter location"
                  error={errors.place}
                />
              )}

              <DatePickerField
                label="Check-in Date"
                required
                value={form.check_in_date}
                onChange={(value) => setForm({ ...form, check_in_date: value })}
                min={tripStartDate}
                max={tripEndDate}
                error={errors.check_in_date}
              />

              <TimePickerField
                label="Check-in Time"
                required
                value={form.check_in_time}
                onChange={(value) => setForm({ ...form, check_in_time: value })}
                error={errors.check_in_time}
              />

              <DatePickerField
                label="Check-out Date"
                required
                value={form.check_out_date}
                onChange={(value) =>
                  setForm({ ...form, check_out_date: value })
                }
                min={form.check_in_date || tripStartDate}
                max={tripEndDate}
                error={errors.check_out_date}
              />

              <TimePickerField
                label="Check-out Time"
                required
                value={form.check_out_time}
                onChange={(value) =>
                  setForm({ ...form, check_out_time: value })
                }
                error={errors.check_out_time}
              />

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Estimated Cost (₹)
                  {maxAllowed !== undefined && (
                    <span className="text-xs text-muted-foreground ml-2 font-normal">
                      (Max: ₹{maxAllowed.toLocaleString('en-IN')})
                    </span>
                  )}
                </label>
                <CurrencyInput
                  value={form.estimated_cost}
                  onValueChange={handleCostChange}
                  onBlur={handleCostBlur}
                  placeholder={
                    maxAllowed !== undefined
                      ? `Max allowed ₹${maxAllowed.toLocaleString('en-IN')}`
                      : "Enter estimated cost"
                  }
                  className={errors.estimated_cost ? "border-destructive" : ""}
                />
                {/* {maxAllowed !== undefined && !errors.estimated_cost && derivedCityCategory && (
                  <p className="text-xs text-muted-foreground">
                    Maximum allowed: ₹{maxAllowed.toLocaleString('en-IN')} for {derivedCityCategory}
                  </p>
                )} */}
                {errors.estimated_cost && (
                  <p className="text-sm text-destructive">
                    {errors.estimated_cost}
                  </p>
                )}
              </div>

              <FormSelect
                label="Meal Preference"
                value={form.meal_preference || ""}
                onChange={(value) =>
                  setForm({ ...form, meal_preference: value })
                }
                options={[
                  { value: "", label: "Select Meal Preference" },
                  { value: "Vegeterian Food", label: "Vegeterian Food" },
                  {
                    value: "Non. Vegeterian Food",
                    label: "Non. Vegeterian Food",
                  },
                  // { value: "No Food", label: "No Food" },
                ]}
              />

              <div className="md:col-span-3">
                <FormTextarea
                  label="Special Instructions"
                  value={form.special_instruction}
                  onChange={(e) =>
                    setForm({ ...form, special_instruction: e.target.value })
                  }
                  placeholder="Any special requirements..."
                  rows={2}
                  error={errors.special_instruction}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              {editIndex !== null && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setForm(getEmptyAccommodation());
                    setEditIndex(null);
                    setErrors({});
                  }}
                >
                  Cancel
                </Button>
              )}
              <Button onClick={handleSubmit}>
                {editIndex !== null ? (
                  <>
                    <Save className="w-4 h-4 mr-2" /> Update Accommodation
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" /> Add Accommodation
                  </>
                )}
              </Button>
            </div>
          </div>

          <DataTable
            columns={columns}
            data={accommodation}
            onEdit={handleEdit}
            onDelete={handleDelete}
            emptyMessage="No accommodation added yet"
            rowErrors={bookingErrors}
          />
        </>
      )}
    </div>
  );
};
