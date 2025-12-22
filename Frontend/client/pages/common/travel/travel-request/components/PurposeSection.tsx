import React from "react";
import { Calendar } from "lucide-react";
import { FormInput } from "./FormInput";
import { FormTextarea } from "./FormTextarea";
import { FormSelect } from "./FormSelect";
import { CityCombobox } from "./CityCombobox";
import { TimePickerField } from "./TimePickerField";
import {
  CITIES,
  GL_CODES,
} from "../lib/travel-constants";
import {
  getToday,
  getMaxDate,
  validateTripDuration,
  validateLocationPair,
  validateEndTime,
  isPastDate,
} from "../lib/travel-validation";
import type { City, GLCode } from "@/src/api/travel-api";

interface PurposeFormData {
  purpose: string;
  internal_order: string;
  general_ledger: string;
  sanction_number: string;
  advance_amount: string;
  trip_from_location: string;
  trip_from_location_label: string;
  trip_to_location: string;
  trip_to_location_label: string;
  departure_date: string;
  start_time: string;
  return_date: string;
  end_time: string; 
}

interface PurposeSectionProps {
  formData: PurposeFormData;
  setFormData: React.Dispatch<React.SetStateAction<PurposeFormData>>;
  errors: Record<string, string>;
  setErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  cities?: City[];
  glCodes?: GLCode[];
}

export const PurposeSection: React.FC<PurposeSectionProps> = ({
  formData,
  setFormData,
  errors,
  setErrors,
  cities: propCities,
  glCodes: propGLCodes,
}) => {
  const today = getToday();

  // Use props if provided, otherwise use constants
  const cities = propCities && propCities.length > 0 ? propCities : CITIES;
  const glCodes = propGLCodes && propGLCodes.length > 0 ? propGLCodes : GL_CODES;

  const handleFieldChange = (field: keyof PurposeFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Clear error on change
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }

    // Validate on change
    // if (!formData.advance_amount) setErrors((prev) => ({...prev, advance_amount: "Advance Amount is required"}));

    if (field === "departure_date" || field === "return_date") {
      const startDate = field === "departure_date" ? value : formData.departure_date;
      const endDate = field === "return_date" ? value : formData.return_date;

      if (startDate && isPastDate(startDate)) {
        setErrors((prev) => ({ ...prev, departure_date: "Start date cannot be in the past" }));
      }
      if (endDate && isPastDate(endDate)) {
        setErrors((prev) => ({ ...prev, return_date: "End date cannot be in the past" }));
      }

      if (startDate && endDate) {
        const durationError = validateTripDuration(startDate, endDate);
        if (durationError) {
          setErrors((prev) => ({ ...prev, return_date: durationError }));
        }
      }
    }

    if (field === "start_time" || field === "end_time") {
      const timeError = validateEndTime(
        formData.departure_date,
        field === "start_time" ? value : formData.start_time,
        formData.return_date,
        field === "end_time" ? value : formData.end_time
      );
      if (timeError) {
        setErrors((prev) => ({ ...prev, end_time: timeError }));
      }
    }
  };

  const handleCityChange = (
    field: "trip_from_location" | "trip_to_location",
    id: number | null,
    label: string
  ) => {
    const labelField = `${field}_label` as keyof PurposeFormData;
    setFormData((prev) => ({
      ...prev,
      [field]: id ? String(id) : "",
      [labelField]: label,
    }));

    // Clear error
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }

    // Validate location pair
    const otherField = field === "trip_from_location" ? "trip_to_location" : "trip_from_location";
    const otherValue = formData[otherField];
    const newValue = id ? String(id) : "";

    if (newValue && otherValue) {
      const locationError = validateLocationPair(
        field === "trip_from_location" ? newValue : otherValue,
        field === "trip_to_location" ? newValue : otherValue
      );
      if (locationError) {
        setErrors((prev) => ({ ...prev, [field]: locationError }));
      }
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <Calendar className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Travel Purpose & Details</h2>
          <p className="text-sm text-muted-foreground">Provide basic information about your travel</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="lg:col-span-2">
          <FormTextarea
            label="Purpose of Travel"
            required
            value={formData.purpose}
            onChange={(e) => handleFieldChange("purpose", e.target.value)}
            placeholder="Describe the purpose of your travel..."
            rows={4}
            error={errors.purpose}
          />
        </div>

        <FormInput
          label="Internal Order (IO Number)"
          required
          value={formData.internal_order}
          onChange={(e) => handleFieldChange("internal_order", e.target.value)}
          placeholder="Enter IO number"
          maxLength={19}
          error={errors.internal_order}
        />

        <FormSelect
          label="GL Code"
          required
          value={formData.general_ledger}
          onChange={(value) => handleFieldChange("general_ledger", value)}
          options={[
            { value: "", label: "Select GL Code" },
            ...glCodes.map((gl) => ({
              value: String(gl.id),
              label: `${gl.gl_code} - ${gl.vertical_name}`,
            })),
          ]}
          error={errors.general_ledger}
        />

        <FormInput
          label="Sanction Number"
          value={formData.sanction_number}
          onChange={(e) => handleFieldChange("sanction_number", e.target.value)}
          placeholder="Enter Sanction number (if applicable)"
          maxLength={50}
        />

        <FormInput
          label="Advance Amount (₹)"
          // required
          type="number"
          min="0"
          value={formData.advance_amount}
          onChange={(e) => handleFieldChange("advance_amount", e.target.value)}
          placeholder="0.00"
          // error={errors.advance_amount}
        />

        <CityCombobox
          label="Trip Origin City"
          required
          cities={cities}
          value={formData.trip_from_location ? parseInt(formData.trip_from_location) : null}
          displayValue={formData.trip_from_location_label}
          onChange={(id, label) => handleCityChange("trip_from_location", id, label)}
          placeholder="Search departure city..."
          error={errors.trip_from_location}
        />

        <CityCombobox
          label="Trip Destination City"
          required
          cities={cities}
          value={formData.trip_to_location ? parseInt(formData.trip_to_location) : null}
          displayValue={formData.trip_to_location_label}
          onChange={(id, label) => handleCityChange("trip_to_location", id, label)}
          placeholder="Search destination city..."
          error={errors.trip_to_location}
        />

        <FormInput
          label="Trip Start Date"
          required
          type="date"
          value={formData.departure_date}
          onChange={(e) => handleFieldChange("departure_date", e.target.value)}
          min={today}
          error={errors.departure_date}
        />

        {/* <FormInput
          label="Trip Start Time"
          required
          type="time"
          value={formData.start_time}
          onChange={(e) => handleFieldChange("start_time", e.target.value)}
          error={errors.start_time}
        /> */}

        <TimePickerField
          label="Trip Start Time"
          required
          value={formData.start_time}
          onChange={(e) => handleFieldChange("start_time", e)}
          error={errors.start_time}
        />

        <FormInput
          label="Trip End Date"
          required
          type="date"
          value={formData.return_date}
          onChange={(e) => handleFieldChange("return_date", e.target.value)}
          min={formData.departure_date || today}
          max={formData.departure_date ? getMaxDate(formData.departure_date) : undefined}
          error={errors.return_date}
        />

        <TimePickerField
          label="Trip End Time"
          required
          value={formData.end_time}
          onChange={(e) => handleFieldChange("end_time", e)}
          error={errors.end_time}
        />

      </div>
    </div>
  );
};