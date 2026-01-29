import React from "react";
import { Calendar } from "lucide-react";
import { toast } from "sonner";
import { CurrencyInput } from "@/components/ui/currency-input";
import { FormInput } from "./FormInput";
import { FormTextarea } from "./FormTextarea";
import { CityCombobox } from "./CityCombobox";
import { GLCodeCombobox } from "./GLCodeCombobox";
import { TimePickerField } from "./TimePickerField";
import { DatePickerField } from "./DatePickerField";
import {
  MAX_ADVANCE_AMOUNT,
  IO_NUMBER_MINMAX_LENGTH,
  SANCTION_NUMBER_MINMAX_LENGTH,
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

  const internalOrderRef = React.useRef<HTMLInputElement>(null);
  const sanctionNumberRef = React.useRef<HTMLInputElement>(null);

  const validateAndTrapFocus = (
    field: keyof PurposeFormData,
    ref: React.RefObject<HTMLInputElement>,
    minLength: number,
    customError?: string,
  ) => {
    const value = formData[field];
    if (value && value.length > 0 && value.length < minLength) {
      setErrors((prev) => ({
        ...prev,
        [field]: customError || `Please enter at least ${minLength} digits.`,
      }));
      setTimeout(() => {
        ref.current?.focus();
      }, 0);
    }
  };

  // Use props if provided, otherwise empty
  const cities = propCities && propCities.length > 0 ? propCities : [];
  const glCodes = propGLCodes && propGLCodes.length > 0 ? propGLCodes : [];

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
      const startDate =
        field === "departure_date" ? value : formData.departure_date;
      const endDate = field === "return_date" ? value : formData.return_date;

      if (startDate && isPastDate(startDate)) {
        setErrors((prev) => ({
          ...prev,
          departure_date: "Start date cannot be in the past",
        }));
      }
      if (endDate && isPastDate(endDate)) {
        setErrors((prev) => ({
          ...prev,
          return_date: "End date cannot be in the past",
        }));
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
        field === "end_time" ? value : formData.end_time,
      );
      if (timeError) {
        setErrors((prev) => ({ ...prev, end_time: timeError }));
      }
    }

    if (field === "advance_amount") {
      const amount = parseFloat(value);
      if (!isNaN(amount) && amount > MAX_ADVANCE_AMOUNT) {
        // Cap the amount logic will happen in onBlur
        // Just show error while typing
        setErrors((prev) => ({
          ...prev,
          advance_amount: `Advance amount cannot exceed ₹${MAX_ADVANCE_AMOUNT.toLocaleString("en-IN")}`,
        }));
      }
    }
  };

  const handleAdvanceAmountBlur = () => {
    const amount = parseFloat(formData.advance_amount);
    if (!isNaN(amount) && amount > MAX_ADVANCE_AMOUNT) {
      handleFieldChange("advance_amount", MAX_ADVANCE_AMOUNT.toString());
      toast.warning(
        `Advance amount capped to max limit: ₹${MAX_ADVANCE_AMOUNT.toLocaleString("en-IN")}`,
      );
      // Clear error
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.advance_amount;
        return newErrors;
      });
    }
  };

  const handleCityChange = (
    field: "trip_from_location" | "trip_to_location",
    id: number | null,
    label: string,
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
    const otherField =
      field === "trip_from_location"
        ? "trip_to_location"
        : "trip_from_location";
    const otherValue = formData[otherField];
    const newValue = id ? String(id) : "";

    /* 
    // Validation: Origin != Destination check unlink
    if (newValue && otherValue) {
      const locationError = validateLocationPair(
        field === "trip_from_location" ? newValue : otherValue,
        field === "trip_to_location" ? newValue : otherValue,
      );
      if (locationError) {
        setErrors((prev) => ({ ...prev, [field]: locationError }));
      }
    } 
    */
  };

  const handleGLCodeChange = (id: number | null, label: string) => {
    setFormData((prev) => ({
      ...prev,
      general_ledger: id ? String(id) : "",
    }));

    // Clear error
    if (errors.general_ledger) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.general_ledger;
        return newErrors;
      });
    }
  };

  return (
    <div className="space-y-6 pl-6 pr-6 mx-auto animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <Calendar className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            Travel Purpose & Details
          </h2>
          <p className="text-sm text-muted-foreground">
            Provide basic information about your travel
          </p>
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

        <div className="space-y-2">
          <label className="text-sm font-medium">
            Internal Order (IO Number){" "}
            <span className="text-destructive">*</span>
          </label>
          <CurrencyInput
            ref={internalOrderRef}
            onBlur={() =>
              validateAndTrapFocus(
                "internal_order",
                internalOrderRef,
                IO_NUMBER_MINMAX_LENGTH,
                `Please enter exactly ${IO_NUMBER_MINMAX_LENGTH} digits.`,
              )
            }
            value={formData.internal_order}
            onValueChange={(value) =>
              handleFieldChange("internal_order", value?.toString() || "")
            }
            placeholder="Enter IO number"
            maxLength={IO_NUMBER_MINMAX_LENGTH}
            minLength={IO_NUMBER_MINMAX_LENGTH}
            className={errors.internal_order ? "border-destructive" : ""}
            required
          />
          {errors.internal_order && (
            <p className="text-sm text-destructive">{errors.internal_order}</p>
          )}
        </div>

        <GLCodeCombobox
          label="GL Code"
          required
          glCodes={glCodes}
          value={
            formData.general_ledger ? parseInt(formData.general_ledger) : null
          }
          displayValue={
            formData.general_ledger
              ? glCodes.find(
                  (gl) => gl.id === parseInt(formData.general_ledger),
                )
                ? `${glCodes.find((gl) => gl.id === parseInt(formData.general_ledger))?.gl_code} - ${glCodes.find((gl) => gl.id === parseInt(formData.general_ledger))?.vertical_name}`
                : ""
              : ""
          }
          onChange={handleGLCodeChange}
          placeholder="Search GL Code or Vertical..."
          error={errors.general_ledger}
        />

        <FormInput
          ref={sanctionNumberRef}
          label="Sanction Number"
          value={formData.sanction_number}
          onChange={(e) => handleFieldChange("sanction_number", e.target.value)}
          onBlur={() => {
            const value = formData.sanction_number;
            if (!value || value.trim().length === 0) {
              setErrors((prev) => ({
                ...prev,
                sanction_number: "Sanction Number is required",
              }));
              setTimeout(() => {
                sanctionNumberRef.current?.focus();
              }, 0);
            }
          }}
          placeholder="Enter Sanction number"
          maxLength={SANCTION_NUMBER_MINMAX_LENGTH}
          required
          error={errors.sanction_number}
        />

        {/* <div className="space-y-2">
          <label className="text-sm font-medium">Advance Amount (₹)</label>
          <CurrencyInput
            value={formData.advance_amount}
            onValueChange={(value) =>
              handleFieldChange("advance_amount", value?.toString() || "")
            }
            onBlur={handleAdvanceAmountBlur}
            placeholder="0.00"
            max={MAX_ADVANCE_AMOUNT}
            className={errors.advance_amount ? "border-destructive" : ""}
          />
          {errors.advance_amount && (
            <p className="text-sm text-destructive">{errors.advance_amount}</p>
          )}
        </div> */}

        <div className="empty-div"></div>

        <CityCombobox
          label="Trip Origin City"
          required
          cities={cities}
          value={
            formData.trip_from_location
              ? parseInt(formData.trip_from_location)
              : null
          }
          displayValue={formData.trip_from_location_label}
          onChange={(id, label) =>
            handleCityChange("trip_from_location", id, label)
          }
          placeholder="Search departure city..."
          error={errors.trip_from_location}
        />

        <CityCombobox
          label="Trip Destination City"
          required
          cities={cities}
          value={
            formData.trip_to_location
              ? parseInt(formData.trip_to_location)
              : null
          }
          displayValue={formData.trip_to_location_label}
          onChange={(id, label) =>
            handleCityChange("trip_to_location", id, label)
          }
          placeholder="Search destination city..."
          error={errors.trip_to_location}
        />

        <DatePickerField
          label="Trip Start Date"
          required
          value={formData.departure_date}
          onChange={(value) => handleFieldChange("departure_date", value)}
          min={today}
          error={errors.departure_date}
        />

        <TimePickerField
          label="Trip Start Time"
          required
          value={formData.start_time}
          onChange={(e) => handleFieldChange("start_time", e)}
          error={errors.start_time}
        />

        <DatePickerField
          label="Trip End Date"
          required
          value={formData.return_date}
          onChange={(value) => handleFieldChange("return_date", value)}
          min={formData.departure_date || today}
          max={
            formData.departure_date
              ? getMaxDate(formData.departure_date)
              : undefined
          }
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
