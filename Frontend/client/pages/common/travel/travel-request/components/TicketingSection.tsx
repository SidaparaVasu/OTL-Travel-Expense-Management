import React, { useState, useEffect } from "react";
import { Plane, Plus, Save, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { FormInput } from "./FormInput";
import { FormSelect } from "./FormSelect";
import { FormTextarea } from "./FormTextarea";
import { CityCombobox } from "./CityCombobox";
import { NotRequiredToggle } from "./NotRequiredToggle";
import { DataTable } from "./DataTable";
import {
  getBookingRowActions,
  type BookingRowLockFields,
} from "../lib/booking-row-actions";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DatePickerField } from "./DatePickerField";
import { TimePickerField } from "./TimePickerField";
import { BulkFileUploadWidget } from "./BulkFileUploadWidget";
import {
  TRAVEL_MODES,
  TRAVEL_SUB_OPTIONS,
  getEmptyTicketing,
  STRICT_ADVANCE_BOOKING,
  MAX_ADVANCE_AMOUNT,
} from "../lib/travel-constants";
import {
  isDateTimeInRange,
  validateAdvanceBooking,
  validateLocationPair,
  validateEstimatedCost,
  validateSpecialInstructions,
} from "../lib/travel-validation";
import {
  travelAPI,
  locationAPI,
  type City,
  type TravelMode,
  type TravelSubOption,
} from "@/src/api/travel-api";

interface TicketingFormData extends BookingRowLockFields {
  booking_type: string;
  sub_option: string;
  from_location: string;
  ticket_number: string;
  from_label: string;
  to_location: string;
  to_label: string;
  departure_date: string;
  departure_time: string;
  arrival_date: string;
  arrival_time: string;
  estimated_cost: string;
  meal_preference?: string;
  special_instruction: string;
  is_self_arranged?: boolean;
  // Bulk file fields
  bulk_booking_file?: File | null;
  existing_bulk_booking_file?: string | null;
  remove_bulk_booking_file?: boolean;
}

interface TicketingSectionProps {
  ticketing: TicketingFormData[];
  setTicketing: React.Dispatch<React.SetStateAction<TicketingFormData[]>>;
  notRequired: boolean;
  setNotRequired: (value: boolean) => void;
  tripStartDate: string;
  tripStartTime: string;
  tripEndDate: string;
  tripEndTime: string;
  cities?: City[];
  travelModes?: TravelMode[];
  travelSubOptions?: Record<string, TravelSubOption[]>;
  bookingErrors?: Record<number, string>;
  /** Who the application is for — bulk file only shown for guest/self_guest */
  travelFor?: "self" | "guest" | "self_guest";
  onCloseRow?: (index: number) => void;
}

export const TicketingSection: React.FC<TicketingSectionProps> = ({
  ticketing,
  setTicketing,
  notRequired,
  setNotRequired,
  tripStartDate,
  tripStartTime,
  tripEndDate,
  tripEndTime,
  cities: propCities,
  travelModes: propModes,
  travelSubOptions: propSubOptions,
  bookingErrors = {},
  travelFor = "self",
  onCloseRow,
}) => {
  const [form, setForm] = useState<TicketingFormData>({
    ...getEmptyTicketing(),
    ticket_number: "",
  });
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Use props if provided, otherwise use constants
  const cities = propCities && propCities.length > 0 ? propCities : [];
  const travelModes = propModes && propModes.length > 0 ? propModes : [];
  console.log("travel modes in ticketing section: ", travelModes);
  // const travelSubOptions = propSubOptions && Object.keys(propSubOptions).length > 0 ? propSubOptions : [];
  const travelSubOptions =
    propSubOptions && Object.keys(propSubOptions).length > 0
      ? propSubOptions
      : {};
  console.log("travel sub modes in ticketing section: ", travelSubOptions);
  const currentSubOptions = form.booking_type
    ? travelSubOptions[form.booking_type] || []
    : [];

  const getModeNameById = (modeId: string) => {
    return travelModes.find((m) => String(m.id) === modeId)?.name;
  };

  const getTicketLabel = () => {
    const modeName = getModeNameById(form.booking_type);
    if (modeName === "Flight") return "Flight No. / Flight Name";
    if (modeName === "Train") return "Train No. / Train Name";
    return "Ticket No. / Name";
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!form.booking_type) newErrors.booking_type = "Travel mode is required";
    if (!form.sub_option) newErrors.sub_option = "Sub-option is required";
    if (!form.ticket_number?.trim())
      newErrors.ticket_number = `${getTicketLabel()} is required`;
    if (!form.from_location)
      newErrors.from_location = "From location is required";
    if (!form.to_location) newErrors.to_location = "To location is required";
    if (!form.departure_date)
      newErrors.departure_date = "Departure date is required";
    if (!form.departure_time)
      newErrors.departure_time = "Departure time is required";
    if (!form.arrival_date) newErrors.arrival_date = "Arrival date is required";
    if (!form.arrival_time) newErrors.arrival_time = "Arrival time is required";
    // if (!form.estimated_cost) newErrors.estimated_cost = "Advance Amount is required";

    // Location validation
    const locationError = validateLocationPair(
      form.from_location,
      form.to_location,
    );
    if (locationError) newErrors.to_location = locationError;

    // Date & Time range validation
    if (
      form.departure_date &&
      form.departure_time &&
      tripStartDate &&
      tripEndDate
    ) {
      if (
        !isDateTimeInRange(
          form.departure_date,
          form.departure_time,
          tripStartDate,
          tripStartTime,
          tripEndDate,
          tripEndTime,
        )
      ) {
        newErrors.departure_date = "Departure time must be within trip period";
      }
    }
    if (
      form.arrival_date &&
      form.arrival_time &&
      tripStartDate &&
      tripEndDate
    ) {
      if (
        !isDateTimeInRange(
          form.arrival_date,
          form.arrival_time,
          tripStartDate,
          tripStartTime,
          tripEndDate,
          tripEndTime,
        )
      ) {
        newErrors.arrival_date = "Arrival time must be within trip period";
      }
    }

    // Arrival after departure
    if (
      form.departure_date &&
      form.arrival_date &&
      form.arrival_date < form.departure_date
    ) {
      newErrors.arrival_date = "Arrival date cannot be before departure date";
    }

    // Advance booking validation
    if (form.departure_date && form.booking_type) {
      const modeName = getModeNameById(form.booking_type);
      if (modeName === "Flight" || modeName === "Train") {
        const advanceError = validateAdvanceBooking(
          form.departure_date,
          modeName,
        );
        if (advanceError) {
          if (STRICT_ADVANCE_BOOKING) {
            newErrors.departure_date = advanceError;
          } else {
            toast.warning(advanceError, {
              duration: 5000,
            });
          }
        }
      }
    }

    // Cost validation
    if (form.estimated_cost.trim() !== "") {
      const costError = validateEstimatedCost(form.estimated_cost);
      if (costError) newErrors.estimated_cost = costError;

      const cost = parseFloat(form.estimated_cost);
      if (!isNaN(cost) && cost > MAX_ADVANCE_AMOUNT) {
        newErrors.estimated_cost = `Advance Amount cannot exceed ₹${MAX_ADVANCE_AMOUNT.toLocaleString("en-IN")}`;
      }
    }

    // CEO approval warning for flights
    if (form.booking_type && getModeNameById(form.booking_type) === "Flight") {
      const cost = parseFloat(form.estimated_cost);
      if (!isNaN(cost) && cost > 10000) {
        toast.warning("CEO approval required for flights above ₹10,000");
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
    const cost = parseFloat(form.estimated_cost);
    if (!isNaN(cost) && cost > MAX_ADVANCE_AMOUNT) {
      setForm({
        ...form,
        estimated_cost: MAX_ADVANCE_AMOUNT.toString(),
      });
      toast.warning(
        `Advance Amount capped to max limit: ₹${MAX_ADVANCE_AMOUNT.toLocaleString(
          "en-IN",
        )}`,
      );
    }
  };

  const handleSubmit = () => {
    if (!validateForm()) {
      toast.error("Please fix validation errors before adding");
      return;
    }

    if (editIndex !== null) {
      const updated = [...ticketing];
      updated[editIndex] = { ...form };
      setTicketing(updated);
      toast.success("Ticket updated successfully");
    } else {
      setTicketing([...ticketing, { ...form }]);
      toast.success("Ticket added successfully");
    }

    setForm({ ...getEmptyTicketing(), ticket_number: "" });
    setEditIndex(null);
    setErrors({});
  };

  const handleEdit = (index: number) => {
    setEditIndex(index);
    setForm(ticketing[index]);
    setErrors({});
  };

  const handleDelete = (index: number) => {
    if (window.confirm("Delete this ticket?")) {
      setTicketing(ticketing.filter((_, i) => i !== index));
      if (editIndex !== null && editIndex >= index) {
        setForm({ ...getEmptyTicketing(), ticket_number: "" });
        setEditIndex(null);
        setErrors({});
      }
      toast.success("Ticket deleted");
    }
  };

  const handleModeChange = (modeId: string) => {
    setForm({
      ...getEmptyTicketing(),
      ticket_number: "",
      booking_type: modeId,
    });
    setErrors({});
  };

  const columns = [
    {
      label: "Travel Mode",
      render: (row: TicketingFormData) => {
        const mode = travelModes.find((m) => String(m.id) === row.booking_type);
        const subOption = travelSubOptions[row.booking_type]?.find(
          (s) => String(s.id) === row.sub_option,
        );
        return (
          <div className="flex items-center gap-2">
            <span>{`${mode?.name || row.booking_type} - ${subOption?.name || row.sub_option}`}</span>
            {row.is_self_arranged && (
              <div
                className="flex items-center text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full"
                title="Self Arranged"
              >
                <UserCheck className="w-3 h-3 mr-1" />
                Self
              </div>
            )}
          </div>
        );
      },
    },
    {
      label: "Ticket/Name",
      render: (row: TicketingFormData) => row.ticket_number || "-",
    },
    {
      label: "Route",
      render: (row: TicketingFormData) => {
        const fromCity = cities.find((c) => String(c.id) === row.from_location);
        const toCity = cities.find((c) => String(c.id) === row.to_location);
        return `${fromCity?.city_name || row.from_label} → ${toCity?.city_name || row.to_label}`;
      },
    },
    {
      label: "Departure",
      render: (row: TicketingFormData) =>
        `${row.departure_date} ${row.departure_time || ""}`,
    },
    {
      label: "Arrival",
      render: (row: TicketingFormData) =>
        row.arrival_date
          ? `${row.arrival_date} ${row.arrival_time || ""}`
          : "-",
    },
    {
      label: "Advance Amount (₹)",
      align: "right" as const,
      render: (row: TicketingFormData) =>
        `₹${Number(row.estimated_cost || 0).toLocaleString("en-IN")}`,
    },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <Plane className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            Flight & Train Bookings
          </h2>
          <p className="text-sm text-muted-foreground">
            Add your ticketing requirements
          </p>
        </div>
      </div>

      <NotRequiredToggle
        checked={notRequired}
        onChange={(checked) => {
          setNotRequired(checked);
          if (checked) {
            setForm({ ...getEmptyTicketing(), ticket_number: "" });
            setEditIndex(null);
            setErrors({});
          }
        }}
        section="ticketing"
      />

      {!notRequired && (
        <>
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground mb-4">
              {editIndex !== null ? "Edit Ticket" : "Add New Ticket"}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              {/* Row 1: Travel Mode, Class, Ticket No */}
              <div className="md:col-span-2">
                <FormSelect
                  label="Travel Mode"
                  required
                  value={form.booking_type}
                  onChange={handleModeChange}
                  options={[
                    { value: "", label: "Select travel mode" },
                    ...travelModes.map((m) => ({
                      value: String(m.id),
                      label: m.name,
                    })),
                  ]}
                  error={errors.booking_type}
                />
              </div>

              <div className="md:col-span-2">
                <FormSelect
                  label="Class"
                  required
                  value={form.sub_option}
                  onChange={(value) => setForm({ ...form, sub_option: value })}
                  options={[
                    {
                      value: "",
                      label: form.booking_type
                        ? "Select sub-option"
                        : "Select mode first",
                    },
                    ...currentSubOptions.map((s) => ({
                      value: String(s.id),
                      label: s.name,
                    })),
                  ]}
                  disabled={!form.booking_type}
                  error={errors.sub_option}
                />
              </div>

              <div className="md:col-span-2">
                <FormInput
                  label={getTicketLabel()}
                  required
                  value={form.ticket_number || ""}
                  onChange={(e) =>
                    setForm({ ...form, ticket_number: e.target.value })
                  }
                  placeholder={
                    getModeNameById(form.booking_type) === "Flight"
                      ? "e.g., AI-302 / Air India"
                      : "e.g., 12301 / Rajdhani Express"
                  }
                  error={errors.ticket_number}
                />
              </div>

              <div className="md:col-span-6 flex w-full pb-2 pt-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="is_self_arranged"
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    checked={form.is_self_arranged || false}
                    onChange={(e) =>
                      setForm({ ...form, is_self_arranged: e.target.checked })
                    }
                  />
                  <label
                    htmlFor="is_self_arranged"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Self-arranged?
                  </label>
                </div>
              </div>

              {/* Row 2: From, To */}
              <div className="md:col-span-3">
                <CityCombobox
                  label="From"
                  required
                  cities={cities}
                  value={
                    form.from_location ? parseInt(form.from_location) : null
                  }
                  displayValue={form.from_label}
                  onChange={(id, label) =>
                    setForm({
                      ...form,
                      from_location: id ? String(id) : "",
                      from_label: label,
                    })
                  }
                  placeholder="Departure city"
                  error={errors.from_location}
                />
              </div>

              <div className="md:col-span-3">
                <CityCombobox
                  label="To"
                  required
                  cities={cities}
                  value={form.to_location ? parseInt(form.to_location) : null}
                  displayValue={form.to_label}
                  onChange={(id, label) =>
                    setForm({
                      ...form,
                      to_location: id ? String(id) : "",
                      to_label: label,
                    })
                  }
                  placeholder="Arrival city"
                  error={errors.to_location}
                />
              </div>

              {/* Row 3: Departure Date, Departure Time */}
              <div className="md:col-span-3">
                <DatePickerField
                  label="Departure Date"
                  required
                  value={form.departure_date}
                  onChange={(value) =>
                    setForm({ ...form, departure_date: value })
                  }
                  min={tripStartDate}
                  max={tripEndDate}
                  error={errors.departure_date}
                />
              </div>

              <div className="md:col-span-3">
                <TimePickerField
                  label="Departure Time"
                  required
                  value={form.departure_time}
                  onChange={(value) =>
                    setForm({ ...form, departure_time: value })
                  }
                  error={errors.departure_time}
                />
              </div>

              {/* Row 4: Arrival Date, Arrival Time */}
              <div className="md:col-span-3">
                <DatePickerField
                  label="Arrival Date"
                  required
                  value={form.arrival_date}
                  onChange={(value) =>
                    setForm({ ...form, arrival_date: value })
                  }
                  min={tripStartDate}
                  max={tripEndDate}
                  error={errors.arrival_date}
                />
              </div>

              <div className="md:col-span-3">
                <TimePickerField
                  label="Arrival Time"
                  required
                  value={form.arrival_time}
                  onChange={(value) =>
                    setForm({ ...form, arrival_time: value })
                  }
                  error={errors.arrival_time}
                />
              </div>

              {/* Row 5: Advance Amount, Meal Preference */}
              <div className="md:col-span-3 space-y-2">
                <label className="text-sm font-medium">
                  Advance Amount (₹)
                </label>
                <CurrencyInput
                  value={form.estimated_cost}
                  onValueChange={(value) =>
                    setForm({
                      ...form,
                      estimated_cost: value?.toString() || "",
                    })
                  }
                  onBlur={handleCostBlur}
                  placeholder="0.00"
                  max={MAX_ADVANCE_AMOUNT}
                  className={errors.estimated_cost ? "border-destructive" : ""}
                />
                {errors.estimated_cost && (
                  <p className="text-sm text-destructive">
                    {errors.estimated_cost}
                  </p>
                )}
              </div>

              {/* Meal Preference - DISABLED (Moved to Travelers Section) */}
              {/* <div className="md:col-span-3">
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
                    { value: "No Food", label: "No Food" },
                  ]}
                />
              </div> */}

              {/* Row 6: Special Instructions */}
              <div className="md:col-span-6">
                <FormTextarea
                  label="Special Instructions"
                  value={form.special_instruction}
                  onChange={(e) =>
                    setForm({ ...form, special_instruction: e.target.value })
                  }
                  placeholder="Write any special request for your ticket (example: window seat, lower berth, meal preference)"
                  rows={2}
                  maxLength={500}
                  error={errors.special_instruction}
                />
              </div>

              {/* Row 7: Bulk File Upload — guest applications only */}
              {travelFor !== "self" && (
                <div className="md:col-span-6">
                  <BulkFileUploadWidget
                    category="ticketing"
                    file={form.bulk_booking_file ?? null}
                    existingFileUrl={form.existing_bulk_booking_file ?? null}
                    onChange={(file) =>
                      setForm({ ...form, bulk_booking_file: file })
                    }
                    onRemoveExisting={() =>
                      setForm({
                        ...form,
                        existing_bulk_booking_file: null,
                        remove_bulk_booking_file: true,
                      })
                    }
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              {editIndex !== null && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setForm({ ...getEmptyTicketing(), ticket_number: "" });
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
                    <Save className="w-4 h-4 mr-2" /> Update Ticket
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" /> Add Ticket
                  </>
                )}
              </Button>
            </div>
          </div>

          <DataTable
            columns={columns}
            data={ticketing}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onClose={onCloseRow}
            getRowActions={(row) => getBookingRowActions(row)}
            emptyMessage="No tickets added yet"
            rowErrors={bookingErrors}
          />
        </>
      )}
    </div>
  );
};
