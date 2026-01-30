import React, { useState, useEffect } from "react";
import { Car, Plus, Save, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { FormInput } from "./FormInput";
import { FormSelect } from "./FormSelect";
import { FormTextarea } from "./FormTextarea";
import { NotRequiredToggle } from "./NotRequiredToggle";
import { DataTable } from "./DataTable";
import { GuestSelector } from "./GuestSelector";
import { TimePickerField } from "./TimePickerField";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DatePickerField } from "./DatePickerField";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  VEHICLE_TYPES,
  VEHICLE_SUB_OPTIONS,
  LOCATION_TYPES,
  getEmptyConveyance,
  MAX_ADVANCE_AMOUNT,
} from "../lib/travel-constants";
import {
  isDateTimeInRange,
  validateEstimatedCost,
  validateSpecialInstructions,
  validateConveyanceLocations,
} from "../lib/travel-validation";

interface Guest {
  id?: number;
  full_name: string;
  is_colleague: boolean;
}

interface ConveyanceFormData {
  vehicle_type: string;
  vehicle_type_label: string;
  vehicle_sub_option: string;
  vehicle_sub_option_label: string;
  from_location: string;
  to_location: string;
  report_at: string;
  drop_location: string;
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
  estimated_cost: string;
  special_instruction: string;
  club_booking: boolean;
  club_booking_reason: string;
  guests: Guest[];
  distance_km?: string;
  passenger_count?: string;
  has_six_airbags?: boolean;
}

interface ConveyanceSectionProps {
  conveyance: ConveyanceFormData[];
  setConveyance: React.Dispatch<React.SetStateAction<ConveyanceFormData[]>>;
  notRequired: boolean;
  setNotRequired: (value: boolean) => void;
  tripStartDate: string;
  tripStartTime: string;
  tripEndDate: string;
  tripEndTime: string;
  travelModes: any[];
  travelSubOptions: Record<string, any[]>;
  bookingErrors?: Record<number, string>;
}

export const ConveyanceSection: React.FC<ConveyanceSectionProps> = ({
  conveyance,
  setConveyance,
  notRequired,
  setNotRequired,
  tripStartDate,
  tripStartTime,
  tripEndDate,
  tripEndTime,
  travelModes,
  travelSubOptions,
  bookingErrors = {},
}) => {
  const [form, setForm] = useState<ConveyanceFormData>({
    ...getEmptyConveyance(),
    distance_km: "",
    passenger_count: "1",
    has_six_airbags: true,
  });
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showAirbagWarning, setShowAirbagWarning] = useState(false);

  const currentSubOptions = form.vehicle_type
    ? travelSubOptions[form.vehicle_type] || []
    : [];

  const modeName = form.vehicle_type_label?.toLowerCase() || "";
  const isOwnCar =
    modeName.includes("own car") ||
    modeName.includes("own") ||
    modeName.includes("personal") ||
    modeName.includes("personal car");
  const isCarAtDisposal = modeName.includes("disposal");
  const isRadioTaxi = modeName.includes("radio");
  const isPickupDrop =
    modeName.includes("pick-up") || modeName.includes("pickup");

  const getVehicleTypeName = (id: string) => {
    return VEHICLE_TYPES.find((v) => String(v.id) === id)?.name || "";
  };

  // Show warning when Car at Disposal is selected
  useEffect(() => {
    if (isCarAtDisposal && form.start_time && form.end_time) {
      toast.warning(
        `This booking applies from ${form.start_time} to ${form.end_time} (full shift)`,
        { duration: 5000 },
      );
    }
  }, [isCarAtDisposal, form.start_time, form.end_time]);

  // Show airbag warning
  useEffect(() => {
    if (isOwnCar && form.has_six_airbags === false) {
      setShowAirbagWarning(true);
    } else {
      setShowAirbagWarning(false);
    }
  }, [isOwnCar, form.has_six_airbags]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!form.vehicle_type) newErrors.vehicle_type = "Vehicle type is required";
    if (!form.vehicle_sub_option)
      newErrors.vehicle_sub_option = "Sub-option is required";
    if (!form.from_location)
      newErrors.from_location = "From location is required";
    if (!form.to_location) newErrors.to_location = "To location is required";
    if (!form.report_at) newErrors.report_at = "Report at is required";
    if (!form.drop_location)
      newErrors.drop_location = "Drop location is required";
    if (!form.start_date) newErrors.start_date = "Start date is required";
    if (!form.end_date) newErrors.end_date = "End date is required";
    if (!form.start_time) newErrors.start_time = "Start time is required";
    if (!form.end_time) newErrors.end_time = "End time is required";
    // if (!form.estimated_cost) newErrors.estimated_cost = "Advance Amount is required";

    // Distance validation (Required for all types now)
    if (!form.distance_km) {
      newErrors.distance_km = "Distance is required";
    } else {
      const distance = parseFloat(form.distance_km);
      if (isNaN(distance) || distance <= 0) {
        newErrors.distance_km = "Enter valid distance";
      } else {
        const isSelfArrangedDisposal =
          isCarAtDisposal &&
          (form.vehicle_sub_option_label || "")
            .toLowerCase()
            .includes("self-arranged");

        if ((isOwnCar || isSelfArrangedDisposal) && distance > 150) {
          // Show CHRO approval toast but allow submission
          toast.warning(
            "CHRO approval required for distance exceeding 150 km",
            {
              duration: 5000,
            },
          );
        }
      }
    }

    // Passenger count validation
    if (!form.passenger_count || parseInt(form.passenger_count) < 1) {
      newErrors.passenger_count = "At least 1 passenger required";
    }

    // Location validation - DISABLED: Allow same location for from and to
    // if (form.from_location === form.to_location && form.from_location) {
    //   newErrors.to_location = "From and To locations cannot be the same";
    // }

    // Conveyance location validation (residence/hotel <-> airport/station)
    const conveyanceError = validateConveyanceLocations(
      form.report_at,
      form.drop_location,
    );
    if (conveyanceError && !isCarAtDisposal) {
      newErrors.drop_location = conveyanceError;
    }

    // Date & Time range validation
    if (form.start_date && form.start_time && tripStartDate && tripEndDate) {
      if (
        !isDateTimeInRange(
          form.start_date,
          form.start_time,
          tripStartDate,
          tripStartTime,
          tripEndDate,
          tripEndTime,
        )
      ) {
        newErrors.start_date = "Start time must be within trip period";
      }
    }
    if (form.end_date && form.end_time && tripStartDate && tripEndDate) {
      if (
        !isDateTimeInRange(
          form.end_date,
          form.end_time,
          tripStartDate,
          tripStartTime,
          tripEndDate,
          tripEndTime,
        )
      ) {
        newErrors.end_date = "End time must be within trip period";
      }
    }

    // End after start
    if (form.start_date && form.end_date && form.end_date < form.start_date) {
      newErrors.end_date = "End date cannot be before start date";
    }

    // Club booking reason required if not club booking
    if (!form.club_booking && !form.club_booking_reason.trim()) {
      newErrors.club_booking_reason =
        "Reason is required when not club booking";
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

    // Show Car at Disposal warning on submit
    if (isCarAtDisposal) {
      toast.info(
        "Car at Disposal: Full shift will be applied from start time to end time.",
        {
          duration: 5000,
        },
      );
    }

    if (editIndex !== null) {
      const updated = [...conveyance];
      updated[editIndex] = { ...form };
      setConveyance(updated);
      toast.success("Conveyance updated successfully");
    } else {
      setConveyance([...conveyance, { ...form }]);
      toast.success("Conveyance added successfully");
    }

    setForm({
      ...getEmptyConveyance(),
      distance_km: "",
      passenger_count: "1",
      has_six_airbags: true,
    });

    setEditIndex(null);
    setErrors({});
  };

  const handleEdit = (index: number) => {
    setEditIndex(index);
    setForm(conveyance[index]);
    setErrors({});
  };

  const handleDelete = (index: number) => {
    if (window.confirm("Delete this conveyance?")) {
      setConveyance(conveyance.filter((_, i) => i !== index));
      if (editIndex !== null && editIndex >= index) {
        setForm({
          ...getEmptyConveyance(),
          distance_km: "",
          has_six_airbags: true,
        });
        setEditIndex(null);
        setErrors({});
      }
      toast.success("Conveyance deleted");
    }
  };

  const handleTypeChange = (typeId: string) => {
    const type = travelModes.find((t) => String(t.id) === typeId);
    setForm({
      ...getEmptyConveyance(),
      vehicle_type: typeId,
      vehicle_type_label: type?.name || "",
      distance_km: "",
      passenger_count: "1",
      has_six_airbags: true,
    });
    setErrors({});

    // Show Car at Disposal warning immediately
    if (isCarAtDisposal) {
      toast.warning(
        "Car at Disposal: Full shift will be applied from start time to end time.",
        {
          duration: 5000,
        },
      );
    }
    setErrors({});
  };

  const columns = [
    {
      label: "Vehicle",
      render: (row: ConveyanceFormData) => {
        const type = travelModes.find((t) => String(t.id) === row.vehicle_type);
        const subOption = travelSubOptions[row.vehicle_type]?.find(
          (s) => String(s.id) === row.vehicle_sub_option,
        );
        return `${type?.name || ""} - ${subOption?.name || ""}`;
      },
    },
    {
      label: "Route",
      render: (row: ConveyanceFormData) =>
        `${row.from_location} → ${row.to_location}`,
    },
    {
      label: "Pick-up / Drop",
      render: (row: ConveyanceFormData) =>
        `${row.report_at} → ${row.drop_location}`,
    },
    {
      label: "Date & Time",
      render: (row: ConveyanceFormData) =>
        `${row.start_date} ${row.start_time} - ${row.end_date} ${row.end_time}`,
    },
    {
      label: "Cost (₹)",
      align: "right" as const,
      render: (row: ConveyanceFormData) =>
        `₹${Number(row.estimated_cost || 0).toLocaleString("en-IN")}`,
    },
  ];

  const locationOptions = [
    { value: "", label: "Select location" },
    ...LOCATION_TYPES.map((loc) => ({ value: loc, label: loc })),
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <Car className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            Local Conveyance
          </h2>
          <p className="text-sm text-muted-foreground">
            Add your local travel requirements
          </p>
        </div>
      </div>

      <NotRequiredToggle
        checked={notRequired}
        onChange={(checked) => {
          setNotRequired(checked);
          if (checked) {
            setForm({
              ...getEmptyConveyance(),
              distance_km: "",
              has_six_airbags: true,
            });
            setEditIndex(null);
            setErrors({});
          }
        }}
        section="conveyance"
      />

      {!notRequired && (
        <>
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground mb-4">
              {editIndex !== null ? "Edit Conveyance" : "Add New Conveyance"}
            </h3>

            {/* Own Car Warning */}
            {isOwnCar && (
              <Alert className="mb-4 border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800 dark:text-amber-200">
                  <strong>Own Car Policy:</strong> Maximum 150 km allowed.
                  Distance exceeding 150 km requires CHRO approval. Car must
                  have 6 airbags.
                </AlertDescription>
              </Alert>
            )}

            {/* Airbag Warning */}
            {showAirbagWarning && (
              <Alert className="mb-4 border-destructive/50 bg-destructive/10">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <AlertDescription className="text-destructive">
                  <strong>Warning:</strong> Your car does not have 6 airbags.
                  This may affect your reimbursement eligibility.
                </AlertDescription>
              </Alert>
            )}

            {/* Car at Disposal Info */}
            {isCarAtDisposal && (
              <Alert className="mb-4 border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900">
                <AlertTriangle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800 dark:text-blue-200">
                  <strong>Car at Disposal:</strong> This booking applies from
                  start time to end time (full shift).
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              {/* Row 1: Vehicle Type, Sub-Option, Airbags (if own car) */}
              <div className={isOwnCar ? "md:col-span-2" : "md:col-span-3"}>
                <FormSelect
                  label="Vehicle Type"
                  required
                  value={form.vehicle_type}
                  onChange={handleTypeChange}
                  options={[
                    { value: "", label: "Select vehicle type" },
                    ...travelModes.map((m) => ({
                      value: String(m.id),
                      label: m.name,
                    })),
                  ]}
                  error={errors.vehicle_type}
                />
              </div>

              <div className={isOwnCar ? "md:col-span-2" : "md:col-span-3"}>
                <FormSelect
                  label="Vehicle Sub-Option"
                  required
                  value={form.vehicle_sub_option}
                  onChange={(value) => {
                    const sub = currentSubOptions.find(
                      (s) => String(s.id) === value,
                    );
                    setForm({
                      ...form,
                      vehicle_sub_option: value,
                      vehicle_sub_option_label: sub?.name || "",
                    });
                  }}
                  options={[
                    {
                      value: "",
                      label: form.vehicle_type
                        ? "Select sub-option"
                        : "Select type first",
                    },
                    ...currentSubOptions.map((s) => ({
                      value: String(s.id),
                      label: s.name,
                    })),
                  ]}
                  disabled={!form.vehicle_type}
                  error={errors.vehicle_sub_option}
                />
              </div>

              {/* Own Car specific fields (Airbag checkbox) */}
              {isOwnCar && (
                <div className="md:col-span-2 flex items-end">
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30 w-full h-[42px]">
                    <Checkbox
                      id="has_six_airbags"
                      checked={form.has_six_airbags}
                      onCheckedChange={(checked) =>
                        setForm({ ...form, has_six_airbags: !!checked })
                      }
                    />
                    <label
                      htmlFor="has_six_airbags"
                      className="text-sm font-medium text-foreground cursor-pointer truncate"
                      title="Car has 6 airbags (required for reimbursement)"
                    >
                      Car has 6 airbags
                    </label>
                  </div>
                </div>
              )}

              {/* Row 2: From, To */}
              <div className="md:col-span-3">
                <FormInput
                  label="From Location"
                  required
                  value={form.from_location}
                  onChange={(e) =>
                    setForm({ ...form, from_location: e.target.value })
                  }
                  placeholder="Enter from location"
                  error={errors.from_location}
                />
              </div>

              <div className="md:col-span-3">
                <FormInput
                  label="To Location"
                  required
                  value={form.to_location}
                  onChange={(e) =>
                    setForm({ ...form, to_location: e.target.value })
                  }
                  placeholder="Enter to location"
                  error={errors.to_location}
                />
              </div>

              {/* Row 3: Report At, Drop Location */}
              <div className="md:col-span-3">
                <FormSelect
                  label="Report At"
                  required
                  value={form.report_at}
                  onChange={(value) => setForm({ ...form, report_at: value })}
                  options={locationOptions}
                  error={errors.report_at}
                />
              </div>

              <div className="md:col-span-3">
                <FormSelect
                  label="Drop Location"
                  required
                  value={form.drop_location}
                  onChange={(value) =>
                    setForm({ ...form, drop_location: value })
                  }
                  options={locationOptions}
                  error={errors.drop_location}
                />
              </div>

              {/* Row 4: Start Date, Start Time */}
              <div className="md:col-span-3">
                <DatePickerField
                  label="Start Date"
                  required
                  value={form.start_date}
                  onChange={(value) => setForm({ ...form, start_date: value })}
                  min={tripStartDate}
                  max={tripEndDate}
                  error={errors.start_date}
                />
              </div>

              <div className="md:col-span-3">
                <TimePickerField
                  label="Start Time"
                  required
                  value={form.start_time}
                  onChange={(value) => setForm({ ...form, start_time: value })}
                  error={errors.start_time}
                />
              </div>

              {/* Row 5: End Date, End Time */}
              <div className="md:col-span-3">
                <DatePickerField
                  label="End Date"
                  required
                  value={form.end_date}
                  onChange={(value) => setForm({ ...form, end_date: value })}
                  min={form.start_date || tripStartDate}
                  max={tripEndDate}
                  error={errors.end_date}
                />
              </div>

              <div className="md:col-span-3">
                <TimePickerField
                  label="End Time"
                  required
                  value={form.end_time}
                  onChange={(value) => setForm({ ...form, end_time: value })}
                  error={errors.end_time}
                />
              </div>

              {/* Row 6: No. of Person, Approx KM, Advance Amount */}
              <div className="md:col-span-2 space-y-1.5 align-bottom">
                <label className="text-sm font-medium">
                  No. of Person <span className="text-destructive">*</span>
                </label>
                <CurrencyInput
                  value={form.passenger_count}
                  onValueChange={(value) =>
                    setForm({
                      ...form,
                      passenger_count: value?.toString() || "",
                    })
                  }
                  placeholder="Passenger count"
                  className={errors.passenger_count ? "border-destructive" : ""}
                />
                {errors.passenger_count && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.passenger_count}
                  </p>
                )}
              </div>

              <div className="md:col-span-2 space-y-1.5">
                <label className="text-sm font-medium">
                  Approx. K.M. (Two-way distance)
                  <span className="text-destructive">*</span>
                </label>
                <CurrencyInput
                  value={form.distance_km || ""}
                  onValueChange={(value) => {
                    const valStr = value?.toString() || "";
                    setForm({ ...form, distance_km: valStr });
                    const isSelfArrangedDisposal =
                      isCarAtDisposal &&
                      (form.vehicle_sub_option_label || "")
                        .toLowerCase()
                        .includes("self-arranged");
                    if (
                      (isOwnCar || isSelfArrangedDisposal) &&
                      value &&
                      value > 150
                    ) {
                      toast.warning(
                        "CHRO approval required for distance exceeding 150 km",
                      );
                    }
                  }}
                  placeholder="Enter distance"
                  className={errors.distance_km ? "border-destructive" : ""}
                />
                {errors.distance_km && (
                  <p className="text-sm text-destructive">
                    {errors.distance_km}
                  </p>
                )}
              </div>

              <div className="md:col-span-2 space-y-2">
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
                  className={errors.estimated_cost ? "border-destructive" : ""}
                />
                {errors.estimated_cost && (
                  <p className="text-sm text-destructive">
                    {errors.estimated_cost}
                  </p>
                )}
              </div>

              {/* Club Booking */}
              <div className="md:col-span-6 space-y-4">
                <div className="flex items-center gap-3 p-4 rounded-lg border border-border bg-muted/30">
                  <Checkbox
                    id="club_booking"
                    checked={form.club_booking}
                    onCheckedChange={(checked) =>
                      setForm({
                        ...form,
                        club_booking: !!checked,
                        club_booking_reason: "",
                      })
                    }
                  />
                  <label
                    htmlFor="club_booking"
                    className="text-sm font-medium text-foreground cursor-pointer"
                  >
                    Club Booking (shared with other travelers)
                  </label>
                </div>

                {!form.club_booking && (
                  <FormInput
                    label="Reason for not club booking"
                    required
                    value={form.club_booking_reason}
                    onChange={(e) =>
                      setForm({ ...form, club_booking_reason: e.target.value })
                    }
                    placeholder="Enter reason"
                    error={errors.club_booking_reason}
                  />
                )}
              </div>

              {/* Guests */}
              <div className="md:col-span-6">
                <GuestSelector
                  selectedGuests={form.guests}
                  setSelectedGuests={(guests) => setForm({ ...form, guests })}
                />
              </div>

              {/* Special Instructions */}
              <div className="md:col-span-6">
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

            <div className="flex justify-between items-center gap-3 mt-6">
              <div className="md:col-span-6">
                <span className="text-destructive">
                  Note : Create a separate line item for each Car Booking
                  request.
                </span>
              </div>
              <div className="flex justify-end items-center gap-3">
                {editIndex !== null && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setForm({
                        ...getEmptyConveyance(),
                        distance_km: "",
                        passenger_count: "1",
                        has_six_airbags: true,
                      });
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
                      <Save className="w-4 h-4 mr-2" /> Update Conveyance
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" /> Add Conveyance
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          <DataTable
            columns={columns}
            data={conveyance}
            onEdit={handleEdit}
            onDelete={handleDelete}
            emptyMessage="No conveyance added yet"
            rowErrors={bookingErrors}
          />
        </>
      )}
    </div>
  );
};
