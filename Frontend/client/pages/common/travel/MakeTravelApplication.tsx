import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTravelStore } from "@/src/store/travelStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Trash2, Save, AlertCircle } from "lucide-react";
import { TripDetail, Booking } from "@/src/types/travel.types";
import {
  validateTravelApplication,
  getErrorMessage,
  ValidationError,
  validateField,
} from "@/src/validation/travelValidation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { travelAPI } from "@/src/api/travel";

export default function MakeTravelApplication() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    locations,
    travelModes,
    glCodes,
    loadMasterData,
    createApplication,
    isLoading,
  } = useTravelStore();

  const [formData, setFormData] = useState({
    purpose: "",
    internal_order: "",
    general_ledger: "",
    sanction_number: "",
    advance_amount: 0,
  });

  const [trips, setTrips] = useState<TripDetail[]>([
    {
      from_location: 0,
      to_location: 0,
      departure_date: "",
      return_date: "",
      trip_purpose: "",
      guest_count: 0,
      bookings: [],
    },
  ]);

  const [validationErrors, setValidationErrors] = useState<ValidationError[]>(
    [],
  );
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [subOptions, setSubOptions] = useState<Record<number, any[]>>({});

  useEffect(() => {
    loadMasterData();
  }, []);

  console.log(trips);

  const queryClient = useQueryClient();

  const submitMutation = useMutation({
    mutationFn: (id: number) => travelAPI.submitApplication(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] }); // refresh list
    },
  });

  const loadSubOptions = async (
    modeId: number,
    bookingIndex: number,
    tripIndex: number,
  ) => {
    if (!subOptions[modeId]) {
      const { travelAPI } = await import("@/src/api/travel");
      const options = await travelAPI.getTravelSubOptions(modeId);
      setSubOptions((prev) => ({ ...prev, [modeId]: options }));
    }
  };

  // const handleBlur = (field: string) => {
  //   setTouched(prev => ({ ...prev, [field]: true }));
  //   // Run validation on blur
  //   const errors = validateTravelApplication(formData, trips);
  //   setValidationErrors(errors);
  // };

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));

    // Validate only that field
    const fieldErrors = validateField(field, formData, trips);

    setValidationErrors((prev) => {
      // Remove any previous error for that field
      const filtered = prev.filter((e) => e.field !== field);
      return [...filtered, ...fieldErrors];
    });
  };

  const addTrip = () => {
    setTrips([
      ...trips,
      {
        from_location: 0,
        to_location: 0,
        departure_date: "",
        return_date: "",
        trip_purpose: "",
        guest_count: 0,
        bookings: [],
      },
    ]);
  };

  const removeTrip = (index: number) => {
    if (trips.length > 1) {
      setTrips(trips.filter((_, i) => i !== index));
    }
  };

  const updateTrip = (index: number, field: keyof TripDetail, value: any) => {
    const updated = [...trips];
    updated[index] = { ...updated[index], [field]: value };
    setTrips(updated);
    // Revalidate after update
    const errors = validateTravelApplication(formData, updated);
    setValidationErrors(errors);
  };

  const addBooking = (tripIndex: number) => {
    const updated = [...trips];
    updated[tripIndex].bookings.push({
      booking_type: 0,
      sub_option: 0,
      estimated_cost: "0",
      booking_details: {},
    });
    setTrips(updated);
  };

  const removeBooking = (tripIndex: number, bookingIndex: number) => {
    const updated = [...trips];
    updated[tripIndex].bookings = updated[tripIndex].bookings.filter(
      (_, i) => i !== bookingIndex,
    );
    setTrips(updated);
    // Revalidate
    const errors = validateTravelApplication(formData, updated);
    setValidationErrors(errors);
  };

  const updateBooking = (
    tripIndex: number,
    bookingIndex: number,
    field: keyof Booking,
    value: any,
  ) => {
    const updated = [...trips];
    updated[tripIndex].bookings[bookingIndex] = {
      ...updated[tripIndex].bookings[bookingIndex],
      [field]: value,
    };
    setTrips(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Mark all fields as touched
    setTouched({
      purpose: true,
      internal_order: true,
      general_ledger: true,
      sanction_number: true,
    });

    // Run full validation
    const errors = validateTravelApplication(formData, trips);
    setValidationErrors(errors);

    if (errors.length > 0) {
      toast({
        title: "Validation Error",
        description: `${errors[0].message}`,
        variant: "destructive",
      });
      console.log(`Please fix ${errors.length} error(s) before submitting.`);
      // return;
    }

    // Validation
    // if (!formData || !formData.internal_order || !formData.general_ledger || !formData.sanction_number) {
    //   toast({ title: 'Error', description: 'Please fill all required fields', variant: 'destructive' });
    //   return;
    // }
    // if (!formData.purpose || !formData.internal_order || !formData.general_ledger || !formData.sanction_number) {
    //   toast({ title: 'Error', description: 'Please fill all required fields', variant: 'destructive' });
    //   return;
    // }

    // if (trips.length === 0) {
    //   toast({ title: 'Error', description: 'Please add at least one trip', variant: 'destructive' });
    //   return;
    // }

    // for (let i = 0; i < trips.length; i++) {
    //   const trip = trips[i];
    //   if (!trip.from_location || !trip.to_location || !trip.departure_date || !trip.return_date) {
    //     toast({
    //       title: 'Error',
    //       description: `Please complete all fields for Trip ${i + 1}`,
    //       variant: 'destructive'
    //     });
    //     return;
    //   }

    //   if (trip.bookings.length === 0) {
    //     toast({
    //       title: 'Error',
    //       description: `Please add at least one booking for Trip ${i + 1}`,
    //       variant: 'destructive'
    //     });
    //     return;
    //   }
    // }

    try {
      const application = await createApplication({
        ...formData,
        status: "draft",
        general_ledger: parseInt(formData.general_ledger),
        trip_details: trips.map((trip) => ({
          ...trip,
          from_location: parseInt(trip.from_location as any),
          to_location: parseInt(trip.to_location as any),
          bookings: trip.bookings.map((booking) => ({
            ...booking,
            booking_type: parseInt(booking.booking_type as any),
            sub_option: booking.sub_option
              ? parseInt(booking.sub_option as any)
              : undefined,
          })),
        })),
      });

      toast({
        title: "Success",
        description: "Travel application created successfully",
      });
      setTimeout(() => {
        navigate(`/travel/travel-application-list`);
      }, 3000);
    } catch (error: any) {
      console.log(error);
      toast({
        title: "Failed",
        description:
          error.response?.data?.message ||
          JSON.parse(error.request.response).non_field_errors[0] ||
          "Failed to create application",
        variant: "destructive",
      });
    }
  };

  const ErrorMessage = ({
    field,
    tripIndex,
    bookingIndex,
  }: {
    field: string;
    tripIndex?: number;
    bookingIndex?: number;
  }) => {
    const shouldShow = touched[field] || validationErrors.length > 0;
    const error = getErrorMessage(
      validationErrors,
      field,
      tripIndex,
      bookingIndex,
    );

    if (!shouldShow || !error) return null;

    return <p className="text-sm text-red-600 mt-1">{error}</p>;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-semibold">Create Travel Application</h1>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/travel/travel-application-list")}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            <Save className="w-4 h-4 mr-2" />
            {isLoading ? "Saving..." : "Save Draft"}
          </Button>
        </div>
      </div>

      {/* Validation Summary */}
      {/* {validationErrors.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please fix {validationErrors.length} validation error(s) before proceeding
            </AlertDescription>
          </Alert>
        )} */}

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="purpose">Purpose of Travel *</Label>
            <Textarea
              id="purpose"
              value={formData.purpose}
              onChange={(e) =>
                setFormData({ ...formData, purpose: e.target.value })
              }
              onBlur={() => handleBlur("purpose")}
              className={
                getErrorMessage(validationErrors, "purpose")
                  ? "border-red-500"
                  : ""
              }
              required
            />
            <ErrorMessage field="purpose" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="internal_order">Internal Order (IO) *</Label>
            <Input
              id="internal_order"
              value={formData.internal_order}
              onChange={(e) =>
                setFormData({ ...formData, internal_order: e.target.value })
              }
              onBlur={() => handleBlur("internal_order")}
              className={
                getErrorMessage(validationErrors, "internal_order")
                  ? "border-red-500"
                  : ""
              }
              required
            />
            <ErrorMessage field="internal_order" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="general_ledger">GL Code *</Label>
            <Select
              value={formData.general_ledger}
              onValueChange={(value) => {
                setFormData({ ...formData, general_ledger: value });
                // handleBlur('general_ledger');
              }}
              required
            >
              <SelectTrigger
                className={
                  getErrorMessage(validationErrors, "general_ledger")
                    ? "border-red-500"
                    : ""
                }
              >
                <SelectValue placeholder="Select GL Code" />
              </SelectTrigger>
              <SelectContent>
                {glCodes?.results?.map((gl) => (
                  <SelectItem key={gl.id} value={gl.id.toString()}>
                    {gl.gl_code} - {gl.vertical_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* <ErrorMessage field="general_ledger" /> */}
          </div>
          <div className="space-y-2">
            <Label htmlFor="sanction_number">Sanction Number *</Label>
            <Input
              id="sanction_number"
              value={formData.sanction_number}
              onChange={(e) =>
                setFormData({ ...formData, sanction_number: e.target.value })
              }
              onBlur={() => handleBlur("sanction_number")}
              className={
                getErrorMessage(validationErrors, "sanction_number")
                  ? "border-red-500"
                  : ""
              }
              required
            />
            <ErrorMessage field="sanction_number" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="advance_amount">Advance Amount (₹)</Label>
            <Input
              id="advance_amount"
              type="number"
              min={0}
              // value={formData.advance_amount}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  advance_amount:
                    Number(e.target.value) < 0 ? 0 : Number(e.target.value),
                })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Trip Details */}
      {trips.map((trip, tripIndex) => (
        <Card key={tripIndex}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Trip {tripIndex + 1}</CardTitle>
            {trips.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeTrip(tripIndex)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>From Location *</Label>
                <Select
                  value={trip.from_location.toString()}
                  onValueChange={(value) =>
                    updateTrip(tripIndex, "from_location", parseInt(value))
                  }
                >
                  <SelectTrigger
                    className={
                      getErrorMessage(
                        validationErrors,
                        "from_location",
                        tripIndex,
                      )
                        ? "border-red-500"
                        : ""
                    }
                  >
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations?.results?.map((loc) => (
                      <SelectItem
                        key={loc.location_id}
                        value={loc.location_id.toString()}
                      >
                        {loc.location_name} ({loc.city_name})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <ErrorMessage field="from_location" tripIndex={tripIndex} />
              </div>
              <div className="space-y-2">
                <Label>To Location *</Label>
                <Select
                  value={trip.to_location.toString()}
                  onValueChange={(value) =>
                    updateTrip(tripIndex, "to_location", parseInt(value))
                  }
                >
                  <SelectTrigger
                    className={
                      getErrorMessage(
                        validationErrors,
                        "to_location",
                        tripIndex,
                      )
                        ? "border-red-500"
                        : ""
                    }
                  >
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations?.results?.map((loc) => (
                      <SelectItem
                        key={loc.location_id}
                        value={loc.location_id.toString()}
                      >
                        {loc.location_name} ({loc.city_name})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <ErrorMessage field="to_location" tripIndex={tripIndex} />
              </div>
              <div className="space-y-2">
                <Label>Departure Date *</Label>
                <Input
                  type="date"
                  value={trip.departure_date}
                  onChange={(e) =>
                    updateTrip(tripIndex, "departure_date", e.target.value)
                  }
                  className={
                    getErrorMessage(
                      validationErrors,
                      "departure_date",
                      tripIndex,
                    )
                      ? "border-red-500"
                      : ""
                  }
                  required
                />
                <ErrorMessage field="departure_date" tripIndex={tripIndex} />
              </div>
              <div className="space-y-2">
                <Label>Return Date *</Label>
                <Input
                  type="date"
                  value={trip.return_date}
                  onChange={(e) =>
                    updateTrip(tripIndex, "return_date", e.target.value)
                  }
                  className={
                    getErrorMessage(validationErrors, "return_date", tripIndex)
                      ? "border-red-500"
                      : ""
                  }
                  required
                />
                <ErrorMessage field="return_date" tripIndex={tripIndex} />
              </div>
              <div className="space-y-2">
                <Label>Trip Purpose</Label>
                <Input
                  value={trip.trip_purpose}
                  onChange={(e) =>
                    updateTrip(tripIndex, "trip_purpose", e.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Guest Count</Label>
                <Input
                  type="number"
                  min={0}
                  value={trip.guest_count}
                  onChange={(e) =>
                    updateTrip(
                      tripIndex,
                      "guest_count",
                      parseInt(e.target.value) || 0,
                    )
                  }
                />
              </div>
            </div>

            {/* Bookings */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">Bookings</h3>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => addBooking(tripIndex)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Booking
                </Button>
              </div>

              {trip.bookings.map((booking, bookingIndex) => (
                <div
                  key={bookingIndex}
                  className="border rounded-lg p-4 space-y-4"
                >
                  <div className="flex justify-between items-center">
                    <h4 className="text-sm font-medium">
                      Booking {bookingIndex + 1}
                    </h4>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeBooking(tripIndex, bookingIndex)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Travel Mode *</Label>
                      <Select
                        value={booking.booking_type.toString()}
                        onValueChange={(value) => {
                          updateBooking(
                            tripIndex,
                            bookingIndex,
                            "booking_type",
                            parseInt(value),
                          );
                          loadSubOptions(
                            parseInt(value),
                            bookingIndex,
                            tripIndex,
                          );
                        }}
                      >
                        <SelectTrigger
                          className={
                            getErrorMessage(
                              validationErrors,
                              "booking_type",
                              tripIndex,
                              bookingIndex,
                            )
                              ? "border-red-500"
                              : ""
                          }
                        >
                          <SelectValue placeholder="Select mode" />
                        </SelectTrigger>
                        <SelectContent>
                          {travelModes?.results?.map((mode) => (
                            <SelectItem
                              key={mode.id}
                              value={mode.id.toString()}
                            >
                              {mode.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <ErrorMessage
                        field="booking_type"
                        tripIndex={tripIndex}
                        bookingIndex={bookingIndex}
                      />
                    </div>

                    {booking.booking_type > 0 &&
                      subOptions[booking.booking_type] && (
                        <div className="space-y-2">
                          <Label>Sub Option</Label>
                          <Select
                            value={booking.sub_option?.toString() || ""}
                            onValueChange={(value) =>
                              updateBooking(
                                tripIndex,
                                bookingIndex,
                                "sub_option",
                                parseInt(value),
                              )
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select option" />
                            </SelectTrigger>
                            <SelectContent>
                              {subOptions[booking.booking_type].results.map(
                                (opt: any) => (
                                  <SelectItem
                                    key={opt.id}
                                    value={opt.id.toString()}
                                  >
                                    {opt.name}
                                  </SelectItem>
                                ),
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                    <div className="space-y-2">
                      <Label>Estimated Cost (₹) *</Label>
                      <Input
                        type="number"
                        min={0}
                        value={booking.estimated_cost}
                        onChange={(e) =>
                          updateBooking(
                            tripIndex,
                            bookingIndex,
                            "estimated_cost",
                            e.target.value,
                          )
                        }
                        className={
                          getErrorMessage(
                            validationErrors,
                            "estimated_cost",
                            tripIndex,
                            bookingIndex,
                          )
                            ? "border-red-500"
                            : ""
                        }
                        required
                      />
                      <ErrorMessage
                        field="estimated_cost"
                        tripIndex={tripIndex}
                        bookingIndex={bookingIndex}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={addTrip}
        className="w-full"
      >
        <Plus className="w-4 h-4 mr-2" />
        Add Another Trip
      </Button>

      <div className="flex justify-between items-center">
        <span></span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/travel/travel-application-list")}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            <Save className="w-4 h-4 mr-2" />
            {isLoading ? "Saving..." : "Save Draft"}
          </Button>
        </div>
      </div>
    </form>
  );
}
