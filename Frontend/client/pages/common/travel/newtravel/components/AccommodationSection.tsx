import React, { useState, useEffect } from "react";
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
import { TimePickerField } from "./TimePickerField";
import {
  getEmptyAccommodation,
} from "../lib/travel-constants";
import {
  isDateInRange,
  validateEstimatedCost,
  validateSpecialInstructions,
} from "../lib/travel-validation";

interface AccommodationFormData {
  accommodation_type: string;
  accommodation_type_label: string;
  accommodation_sub_option: string;
  accommodation_sub_option_label: string;
  guest_house_preferences: number[];
  arc_hotel_preferences: number[];
  place: string;
  check_in_date: string;
  check_in_time: string;
  check_out_date: string;
  check_out_time: string;
  estimated_cost: string;
  special_instruction: string;
}

interface AccommodationSectionProps {
  accommodation: AccommodationFormData[];
  setAccommodation: React.Dispatch<React.SetStateAction<AccommodationFormData[]>>;
  notRequired: boolean;
  setNotRequired: (value: boolean) => void;
  tripStartDate: string;
  tripEndDate: string;
  travelModes: any[];
  travelSubOptions: Record<string, any>;
  guestHouses: any[];
  arcHotels: any[];
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
  bookingErrors = {},
}) => {
  const [form, setForm] = useState<AccommodationFormData>(getEmptyAccommodation());
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const currentSubOptions = travelSubOptions[form.accommodation_type] || [];
  console.log("In AccommodationSection: ", currentSubOptions);
  console.log("FormData: ", form);

  const mode = form.accommodation_sub_option_label?.toLowerCase() || "";
  const isGuestHouseSelected = mode.includes("guest house") || mode.includes("guest");
  const isARCHotelSelected = mode.includes("company arranged") || mode.includes("company") || mode.includes("company-tied") || mode.includes("ARC") || mode.includes("arc");
  const isSelfArranged = mode.includes("self arranged") || mode.includes("self");

  // Auto-select sub-option based on accommodation type change
  useEffect(() => {
    // Do nothing if type is empty OR sub-options not loaded
    if (!form.accommodation_type_label || currentSubOptions.length === 0) return;

    const type = form.accommodation_type_label.toLowerCase();

    // Guest House
    if (type.includes("company") || type.includes("company arranged")) {
      const guestHouse = currentSubOptions.find(opt =>
        opt.name.toLowerCase().includes("guest")
      );

      if (
        guestHouse &&
        form.accommodation_sub_option !== String(guestHouse.id)
      ) {
        setForm(prev => ({
          ...prev,
          accommodation_sub_option: String(guestHouse.id),
          accommodation_sub_option_label: guestHouse.name,
          arc_hotel_preferences: [],
          place: "",
        }));
      }
    }

    // ARC / Company-tied Hotels
    else if (type.includes("arc") || type.includes("company-tied") || type.includes("hotel")) {
      const arcHotel = currentSubOptions.find(opt =>
        opt.name.toLowerCase().includes("hotel")
      );

      if (
        arcHotel &&
        form.accommodation_sub_option !== String(arcHotel.id)
      ) {
        setForm(prev => ({
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
      const selfArranged = currentSubOptions.find(opt =>
        opt.name.toLowerCase().includes("self")
      );

      if (
        selfArranged &&
        form.accommodation_sub_option !== String(selfArranged.id)
      ) {
        setForm(prev => ({
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

    if (!form.accommodation_type) newErrors.accommodation_type = "Accommodation type is required";
    if (!form.accommodation_sub_option) newErrors.accommodation_sub_option = "Sub-option is required";
    if (!form.check_in_date) newErrors.check_in_date = "Check-in date is required";
    if (!form.check_out_date) newErrors.check_out_date = "Check-out date is required";
    if (!form.check_in_time) newErrors.check_in_time = "Check-in time is required";
    if (!form.check_out_time) newErrors.check_out_time = "Check-out time is required";
    // if (!form.estimated_cost) newErrors.estimated_cost = "Estimated cost is required";

    // Guest house preferences required for Guest House
    if (isGuestHouseSelected && form.guest_house_preferences.length === 0) {
      newErrors.guest_house_preferences = "At least one guest house preference is required";
    }

    // Companies-tied Hotels (ARC Hotels) preferences required for Companies-tied Hotels (ARC Hotels)
    if (isARCHotelSelected && form.arc_hotel_preferences.length === 0) {
      newErrors.arc_hotel_preferences = "At least one hotel preference is required";
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
    if (form.check_in_date && form.check_out_date && form.check_out_date < form.check_in_date) {
      newErrors.check_out_date = "Check-out date cannot be before check-in date";
    }

    // Cost validation
    if (form.estimated_cost.trim() !== "") {
      const costError = validateEstimatedCost(form.estimated_cost);
      if (costError) newErrors.estimated_cost = costError;
    }

    // Special instructions
    const instructionError = validateSpecialInstructions(form.special_instruction);
    if (instructionError) newErrors.special_instruction = instructionError;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateForm()) {
      toast.error("Please fix validation errors before adding");
      return;
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
    setForm({ ...getEmptyAccommodation(), accommodation_type: typeId, accommodation_type_label: mode?.name || "", });
    setErrors({});
  };

  const columns = [
    {
      label: "Type",
      render: (row: AccommodationFormData) => {
        const type = travelModes.find((t) => String(t.id) === row.accommodation_type);
        const subOption = travelSubOptions[row.accommodation_type]?.find(
          (s) => String(s.id) === row.accommodation_sub_option
        );
        return `${type?.name || ""} - ${subOption?.name || ""}`;
      },
    },
    {
      label: "Accommodation",
      render: (row: AccommodationFormData) => {
        // 1. Guest House selected
        if (
          row.accommodation_sub_option_label?.toLowerCase().includes("guest") &&
          row.guest_house_preferences?.length > 0
        ) {
          return row.guest_house_preferences
            .map((id) => guestHouses.find((gh) => gh.id === id)?.name)
            .filter(Boolean)
            .join(", ");
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
        if (row.accommodation_sub_option_label?.toLowerCase().includes("self")) {
          return row.place || "N/A";
        }

        // 4. Default
        return "-";
      },
    },
    {
      label: "Check-in",
      render: (row: AccommodationFormData) => `${row.check_in_date} ${row.check_in_time || ""}`,
    },
    {
      label: "Check-out",
      render: (row: AccommodationFormData) => `${row.check_out_date} ${row.check_out_time || ""}`,
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
          <h2 className="text-xl font-semibold text-foreground">Accommodation</h2>
          <p className="text-sm text-muted-foreground">Add your accommodation requirements</p>
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
              {editIndex !== null ? "Edit Accommodation" : "Add New Accommodation"}
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
                onChange={
                  (value) => {
                    const subOption = currentSubOptions.find((s) => String(s.id) === value);
                    setForm({
                      ...form, accommodation_sub_option: value,
                      accommodation_sub_option_label: subOption?.name || "",
                      guest_house_preferences: [], arc_hotel_preferences: [], place: ""
                    })
                  }}
                options={[
                  { value: "", label: form.accommodation_type ? "Select sub-option" : "Select type first" },
                  ...currentSubOptions.map((s) => ({
                    value: String(s.id),
                    label: s.name,
                  })),
                ]}
                disabled={!form.accommodation_type}
                error={errors.accommodation_sub_option}
              />

              {isGuestHouseSelected ? (
                <GuestHouseSelector
                  selectedPreferences={form.guest_house_preferences}
                  setSelectedPreferences={(prefs) =>
                    setForm({ ...form, guest_house_preferences: prefs })
                  }
                  guestHouses={guestHouses}
                  error={errors.guest_house_preferences}
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
                <FormInput
                  label="Place/Location"
                  value={form.place}
                  onChange={(e) => setForm({ ...form, place: e.target.value })}
                  placeholder="Enter location"
                />
              )}

              <FormInput
                label="Check-in Date"
                required
                type="date"
                value={form.check_in_date}
                onChange={(e) => setForm({ ...form, check_in_date: e.target.value })}
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

              {/* <FormInput
                label="Check-in Time"
                required
                type="time"
                value={form.check_in_time}
                onChange={(e) => setForm({ ...form, check_in_time: e.target.value })}
                error={errors.check_in_time}
              /> */}

              <FormInput
                label="Check-out Date"
                required
                type="date"
                value={form.check_out_date}
                onChange={(e) => setForm({ ...form, check_out_date: e.target.value })}
                min={form.check_in_date || tripStartDate}
                max={tripEndDate}
                error={errors.check_out_date}
              />

              <TimePickerField
                label="Check-out Time"
                required
                value={form.check_out_time}
                onChange={(value) => setForm({ ...form, check_out_time: value })}
                error={errors.check_out_time}
              />

              {/* <FormInput
                label="Check-out Time"
                required
                type="time"
                value={form.check_out_time}
                onChange={(e) => setForm({ ...form, check_out_time: e.target.value })}
                error={errors.check_out_time}
              /> */}

              <FormInput
                label="Estimated Cost (₹)"
                // required
                type="number"
                min="0"
                value={form.estimated_cost}
                onChange={(e) => setForm({ ...form, estimated_cost: e.target.value })}
                placeholder="0.00"
                error={errors.estimated_cost}
              />

              <div className="md:col-span-3">
                <FormTextarea
                  label="Special Instructions"
                  value={form.special_instruction}
                  onChange={(e) => setForm({ ...form, special_instruction: e.target.value })}
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