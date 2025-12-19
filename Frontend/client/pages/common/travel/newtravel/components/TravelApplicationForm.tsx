import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Calendar,
  Plane,
  Home,
  Car,
  Send,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Wallet,
  Save,
  Check,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PurposeSection } from "./PurposeSection";
import { TicketingSection } from "./TicketingSection";
import { AccommodationSection } from "./AccommodationSection";
import { ConveyanceSection } from "./ConveyanceSection";
import { AdvanceSection } from "./AdvanceSection";
import {
  getEmptyPurposeForm,
  getEmptyTicketing,
  getEmptyAccommodation,
  getEmptyConveyance,
} from "../lib/travel-constants";
import {
  validateTicketingDates,
  validateAccommodationDates,
  validateConveyanceDates,
} from "../lib/travel-validation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  travelAPI,
  locationAPI,
  type City,
  type GLCode,
  type TravelMode,
  type TravelSubOption,
  type GuestHouse,
  type ARCHotel,
} from "@/src/api/travel-api";

const STORAGE_KEY = "travel_application_form";

interface TabConfig {
  id: string;
  label: string;
  icon: React.ElementType;
}

const TABS: TabConfig[] = [
  { id: "purpose", label: "Purpose", icon: Calendar },
  { id: "ticketing", label: "Ticketing", icon: Plane },
  { id: "accommodation", label: "Accommodation", icon: Home },
  { id: "conveyance", label: "Conveyance", icon: Car },
  { id: "advance", label: "Travel Advance", icon: Wallet },
];

type SubOptionGroup = Record<string, TravelSubOption[]>;

interface TravelSubOptionsGrouped {
  ticketing: SubOptionGroup;
  accommodation: SubOptionGroup;
  conveyance: SubOptionGroup;
}

export const TravelApplicationForm: React.FC = () => {
  const [activeTab, setActiveTab] = useState("purpose");
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draftApplicationId, setDraftApplicationId] = useState<number | null>(
    null,
  );

  // API Data
  const [cities, setCities] = useState<City[]>([]);
  const [glCodes, setGLCodes] = useState<GLCode[]>([]);
  const [travelModes, setTravelModes] = useState<TravelMode[]>([]);
  // const [travelSubOptions, setTravelSubOptions] = useState<Record<string, TravelSubOption[]>>({});
  const [travelSubOptions, setTravelSubOptions] =
    useState<TravelSubOptionsGrouped>({
      ticketing: {},
      accommodation: {},
      conveyance: {},
    });
  const [guestHouses, setGuestHouses] = useState<GuestHouse[]>([]);
  const [arcHotels, setARCHotels] = useState<ARCHotel[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Purpose form state
  const [purposeData, setPurposeData] = useState(getEmptyPurposeForm);
  const [purposeErrors, setPurposeErrors] = useState<Record<string, string>>(
    {},
  );

  // Ticketing state
  // const [ticketing, setTicketing] = useState<ReturnType<typeof getEmptyTicketing>[]>([]);
  const [ticketing, setTicketing] = useState<any[]>([]);
  const [ticketingNotRequired, setTicketingNotRequired] = useState(false);
  const [ticketingTravelModes, setTicketingTravelModes] = useState<any[]>([]);
  const [ticketingErrors, setTicketingErrors] = useState<
    Record<number, string>
  >({});

  // Accommodation state
  // const [accommodation, setAccommodation] = useState<ReturnType<typeof getEmptyAccommodation>[]>([]);
  const [accommodation, setAccommodation] = useState<any[]>([]);
  const [accommodationNotRequired, setAccommodationNotRequired] =
    useState(false);
  const [accommodationErrors, setAccommodationErrors] = useState<
    Record<number, string>
  >({});

  // Conveyance state
  // const [conveyance, setConveyance] = useState<ReturnType<typeof getEmptyConveyance>[]>([]);
  const [conveyance, setConveyance] = useState<any[]>([]);
  const [conveyanceNotRequired, setConveyanceNotRequired] = useState(false);
  const [conveyanceErrors, setConveyanceErrors] = useState<
    Record<number, string>
  >({});

  // Load API data on mount
  useEffect(() => {
    if (purposeData.departure_date && purposeData.return_date) {
      // Validate ticketing
      if (ticketing.length > 0 && !ticketingNotRequired) {
        const ticketValidation = validateTicketingDates(
          ticketing,
          purposeData.departure_date,
          purposeData.return_date,
        );
        setTicketingErrors(ticketValidation.errors);
        if (!ticketValidation.isValid) {
          toast.error(
            "Some ticket dates are outside the trip window. Please correct them.",
          );
        }
      } else {
        setTicketingErrors({});
      }

      // Validate accommodation
      if (accommodation.length > 0 && !accommodationNotRequired) {
        const accValidation = validateAccommodationDates(
          accommodation,
          purposeData.departure_date,
          purposeData.return_date,
        );
        setAccommodationErrors(accValidation.errors);
        if (!accValidation.isValid) {
          toast.error(
            "Some accommodation dates are outside the trip window. Please correct them.",
          );
        }
      } else {
        setAccommodationErrors({});
      }

      // Validate conveyance
      if (conveyance.length > 0 && !conveyanceNotRequired) {
        const convValidation = validateConveyanceDates(
          conveyance,
          purposeData.departure_date,
          purposeData.return_date,
        );
        setConveyanceErrors(convValidation.errors);
        if (!convValidation.isValid) {
          toast.error(
            "Some conveyance dates are outside the trip window. Please correct them.",
          );
        }
      } else {
        setConveyanceErrors({});
      }
    }
  }, [
    purposeData.departure_date,
    purposeData.return_date,
    ticketing,
    accommodation,
    conveyance,
    ticketingNotRequired,
    accommodationNotRequired,
    conveyanceNotRequired,
  ]);

  // Check if all bookings are valid
  const hasBookingErrors = useMemo(() => {
    return (
      Object.keys(ticketingErrors).length > 0 ||
      Object.keys(accommodationErrors).length > 0 ||
      Object.keys(conveyanceErrors).length > 0
    );
  }, [ticketingErrors, accommodationErrors, conveyanceErrors]);

  // Load API data on mount
  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingData(true);
      try {
        const [
          citiesData,
          glCodesData,
          travelModesData,
          guestHousesData,
          arcHotelsData,
        ] = await Promise.all([
          locationAPI.getAllCities(),
          travelAPI.getGLCodes(),
          travelAPI.getAllowedTravelModes(),
          travelAPI.getGuestHouses(),
          travelAPI.getARCHotels(),
        ]);

        setCities(citiesData);
        console.log(citiesData);
        setGLCodes(glCodesData);
        setTravelModes(travelModesData.modes);
        const { ticketing, accommodation, conveyance } =
          prepareSectionWiseTravelData(
            travelModesData.modes,
            travelModesData.subOptions,
          );
        setTravelSubOptions({ ticketing, accommodation, conveyance });
        setGuestHouses(guestHousesData);
        setARCHotels(arcHotelsData);
      } catch (error) {
        console.error("Failed to load master data:", error);
        toast.error("Failed to load form data. Using default values.");
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchData();
  }, []);

  // Load saved data on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.purposeData) setPurposeData(data.purposeData);
        if (data.ticketing) setTicketing(data.ticketing);
        if (data.ticketingNotRequired !== undefined)
          setTicketingNotRequired(data.ticketingNotRequired);
        if (data.accommodation) setAccommodation(data.accommodation);
        if (data.accommodationNotRequired !== undefined)
          setAccommodationNotRequired(data.accommodationNotRequired);
        if (data.conveyance) setConveyance(data.conveyance);
        if (data.conveyanceNotRequired !== undefined)
          setConveyanceNotRequired(data.conveyanceNotRequired);
        if (data.activeTab) setActiveTab(data.activeTab);
        if (data.draftApplicationId)
          setDraftApplicationId(data.draftApplicationId);
      }
    } catch (error) {
      console.error("Error loading saved form data:", error);
    }
  }, []);

  // Save data on change
  useEffect(() => {
    const data = {
      purposeData,
      ticketing,
      ticketingNotRequired,
      accommodation,
      accommodationNotRequired,
      conveyance,
      conveyanceNotRequired,
      activeTab,
      draftApplicationId,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [
    purposeData,
    ticketing,
    ticketingNotRequired,
    accommodation,
    accommodationNotRequired,
    conveyance,
    conveyanceNotRequired,
    activeTab,
    draftApplicationId,
  ]);

  // Warn on unsaved changes when leaving
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const hasData =
        purposeData.purpose ||
        ticketing.length > 0 ||
        accommodation.length > 0 ||
        conveyance.length > 0;
      if (hasData) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [purposeData, ticketing, accommodation, conveyance]);

  // --- Build Section-wise Travel Modes ---
  const prepareSectionWiseTravelData = (modes, subOptions) => {
    const ticketing = {}; // Flight + Train
    const accommodation = {}; // Accommodation
    const conveyance = {}; // All other conveyance modes

    Object.entries(subOptions).forEach(([modeId, options]) => {
      const mode = modes.find((m) => String(m.id) === modeId);
      if (!mode) return;

      switch (mode.name) {
        case "Flight":
        case "Train":
          ticketing[modeId] = options;
          break;

        case "Accommodation":
          accommodation[modeId] = options;
          break;

        default:
          // Conveyance modes (Pick-up, Radio Taxi, Car at Disposal, Own Car, etc.)
          conveyance[modeId] = options;
          break;
      }
    });

    return { ticketing, accommodation, conveyance };
  };

  const clearForm = () => {
    setPurposeData(getEmptyPurposeForm());
    setPurposeErrors({});
    setTicketing([]);
    setTicketingNotRequired(false);
    setTicketingErrors({});
    setAccommodation([]);
    setAccommodationNotRequired(false);
    setAccommodationErrors({});
    setConveyance([]);
    setConveyanceNotRequired(false);
    setConveyanceErrors({});
    setActiveTab("purpose");
    setDraftApplicationId(null);
    localStorage.removeItem(STORAGE_KEY);
    toast.success("Form cleared successfully");
    setShowClearDialog(false);
  };

  // Tab validation status
  const isPurposeValid = () => {
    return !!(
      purposeData.purpose.trim() &&
      purposeData.internal_order.trim() &&
      purposeData.general_ledger &&
      purposeData.trip_from_location &&
      purposeData.trip_to_location &&
      purposeData.departure_date &&
      purposeData.start_time &&
      purposeData.return_date &&
      purposeData.end_time
    );
  };

  const isTicketingValid = () => {
    if (ticketingNotRequired) return true;
    if (ticketing.length === 0) return false;
    return Object.keys(ticketingErrors).length === 0;
  };

  const isAccommodationValid = () => {
    if (accommodationNotRequired) return true;
    if (accommodation.length === 0) return false;
    return Object.keys(accommodationErrors).length === 0;
  };

  const isConveyanceValid = () => {
    if (conveyanceNotRequired) return true;
    if (conveyance.length === 0) return false;
    return Object.keys(conveyanceErrors).length === 0;
  };

  const isFormValid = useMemo(() => {
    const purposeValid = isPurposeValid();
    const ticketingValid = isTicketingValid();
    const accommodationValid = isAccommodationValid();
    const conveyanceValid = isConveyanceValid();

    const hasAtLeastOneBooking =
      ticketing.length > 0 ||
      accommodation.length > 0 ||
      conveyance.length > 0 ||
      (ticketingNotRequired &&
        accommodationNotRequired &&
        conveyanceNotRequired);

    return (
      purposeValid &&
      ticketingValid &&
      accommodationValid &&
      conveyanceValid &&
      hasAtLeastOneBooking &&
      !hasBookingErrors
    );
  }, [
    purposeData,
    ticketing,
    accommodation,
    conveyance,
    ticketingNotRequired,
    accommodationNotRequired,
    conveyanceNotRequired,
    ticketingErrors,
    accommodationErrors,
    conveyanceErrors,
    hasBookingErrors,
  ]);

  const getTabStatus = (
    tabId: string,
  ): "complete" | "incomplete" | "error" | "active" => {
    if (activeTab === tabId) return "active";

    switch (tabId) {
      case "purpose":
        return isPurposeValid() ? "complete" : "incomplete";
      case "ticketing":
        if (Object.keys(ticketingErrors).length > 0) return "error";
        return isTicketingValid() ? "complete" : "incomplete";
      case "accommodation":
        if (Object.keys(accommodationErrors).length > 0) return "error";
        return isAccommodationValid() ? "complete" : "incomplete";
      case "conveyance":
        if (Object.keys(conveyanceErrors).length > 0) return "error";
        return isConveyanceValid() ? "complete" : "incomplete";
      // case "advance":
      //   return "complete";
      default:
        return "incomplete";
    }
  };

  const validatePurpose = (): boolean => {
    const errors: Record<string, string> = {};
    if (!purposeData.purpose.trim()) errors.purpose = "Purpose is required";
    if (!purposeData.internal_order.trim())
      errors.internal_order = "IO number is required";
    if (!purposeData.general_ledger)
      errors.general_ledger = "GL Code is required";
    if (!purposeData.trip_from_location)
      errors.trip_from_location = "Origin city is required";
    if (!purposeData.trip_to_location)
      errors.trip_to_location = "Destination city is required";
    if (!purposeData.departure_date)
      errors.departure_date = "Start date is required";
    if (!purposeData.start_time) errors.start_time = "Start time is required";
    if (!purposeData.return_date) errors.return_date = "End date is required";
    if (!purposeData.end_time) errors.end_time = "End time is required";

    setPurposeErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateBookings = (): boolean => {
    const hasTicketing = ticketing.length > 0 || ticketingNotRequired;
    const hasAccommodation =
      accommodation.length > 0 || accommodationNotRequired;
    const hasConveyance = conveyance.length > 0 || conveyanceNotRequired;

    if (!hasTicketing && !hasAccommodation && !hasConveyance) {
      toast.error(
        "At least one booking must exist or all sections must be marked as not required",
      );
      return false;
    }

    // Check for booking date errors
    if (hasBookingErrors) {
      toast.error(
        "Some booking dates are outside the trip window. Please correct them before submitting.",
      );
      return false;
    }

    return true;
  };

  const buildPayload = (isDraft: boolean = false) => {
    console.log("purposeData: ", purposeData);
    console.log("ticketingData: ", ticketing);
    console.log("accommodationData: ", accommodation);
    console.log("conveyanceData: ", conveyance);

    return {
      purpose: purposeData.purpose,
      internal_order: purposeData.internal_order,
      general_ledger: purposeData.general_ledger,
      sanction_number: purposeData.sanction_number,
      advance_amount: purposeData.advance_amount,

      trip_details: [
        {
          from_location: purposeData?.trip_from_location,
          to_location: purposeData?.trip_to_location,
          departure_date: purposeData?.departure_date,
          start_time: purposeData?.start_time,
          return_date: purposeData?.return_date,
          end_time: purposeData?.end_time,

          bookings: [
            ...ticketing.map((t) => ({
              booking_type: parseInt(t.booking_type), // // Ticketing mode ID
              sub_option: parseInt(t.sub_option),
              estimated_cost: parseFloat(t.estimated_cost) || null,
              special_instruction: t.special_instruction,
              booking_details: {
                ticket_number: t.ticket_number,
                from_location: t.from_location,
                from_location_name: t.from_label,
                to_location: t.to_location,
                to_location_name: t.to_label,
                departure_date: t.departure_date,
                departure_time: t.departure_time,
                arrival_date: t.arrival_date,
                arrival_time: t.arrival_time,
                meal_preference: t.meal_preference,
              },
            })),
            ...accommodation.map((a) => ({
              booking_type: a.accommodation_type, // Accommodation mode ID
              sub_option: parseInt(a.accommodation_sub_option),
              estimated_cost: parseFloat(a.estimated_cost),
              special_instruction: a.special_instruction || "",
              booking_details: {
                // guest_house_id: parseInt(a.guest_house) || '',
                // guest_house: a.guest_house || '',
                // guest_house_id: parseInt(a.guest_house) || '',
                // guest_house: a.guest_house || '',
                // guest_house_preferences: a.guest_house_preferences || [],
                guest_house_preferences: [], // Removed as per request
                place: a.place,
                check_in_date: a.check_in_date,
                check_out_date: a.check_out_date,
                check_in_time: a.check_in_time,
                check_out_time: a.check_out_time,
              },
            })),
            ...conveyance.map((c) => ({
              booking_type: parseInt(c.vehicle_type), // Conveyance mode ID
              sub_option: parseInt(c.vehicle_sub_option),
              estimated_cost: parseFloat(c.estimated_cost),
              special_instruction: c.special_instruction || "",
              booking_details: {
                from_location: c.from_location,
                to_location: c.to_location,
                report_at: c.report_at,
                drop_location: c.drop_location,
                start_date: c.start_date,
                start_time: c.start_time || "",
                club_booking: !!c.club_booking,
                club_reason: c.club_reason?.trim() || "",
                not_required: !!c.not_required,
                has_six_airbags: c.has_six_airbags,
                distance_km: c.distance_km,
                guests: (c.guests || []).map((g) => ({
                  id: g.id || null,
                  name: g.full_name,
                  employee_id: g.employee_id || null,
                  is_internal: !!g.employee_id, // employee = internal guest
                  is_external: !g.employee_id, // non-employee = external
                })),
              },
            })),
          ],
        },
      ],

      // purpose: purposeData,
      // ticketing: ticketingNotRequired ? [] : ticketing,
      // accommodation: accommodationNotRequired ? [] : accommodation,
      // conveyance: conveyanceNotRequired ? [] : conveyance,
      // ticketingNotRequired,
      // accommodationNotRequired,
      // conveyanceNotRequired,
      // is_draft: isDraft,
    };
  };

  function extractErrorMessage(error: any): string {
    if (!error) return "Something went wrong.";

    // 1️⃣ If backend returned the nested error as a Python string
    if (typeof error === "string") {
      const msg = parsePythonErrorString(error);
      if (msg) return msg;
      return error;
    }

    // 2️⃣ If it's an array
    if (Array.isArray(error)) {
      return extractErrorMessage(error[0]);
    }

    // 3️⃣ If it's an object
    if (typeof error === "object") {
      const firstKey = Object.keys(error)[0];
      return extractErrorMessage(error[firstKey]);
    }

    return "Unexpected error occurred.";
  }

  function parsePythonErrorString(pyString: string): string | null {
    // Extract content inside ErrorDetail(string='...')
    const regex = /ErrorDetail\(string='([^']+)'/;
    const match = pyString.match(regex);

    if (match && match[1]) {
      return match[1];
    }

    // Extract plain text after "{'duplicate': "
    const altRegex = /'([^']+)'/;
    const altMatch = pyString.match(altRegex);

    if (altMatch && altMatch[1]) {
      return altMatch[1];
    }

    return null;
  }

  const handleSaveAsDraft = async () => {
    setIsSaving(true);
    try {
      const payload = buildPayload(true);

      if (draftApplicationId) {
        await travelAPI.updateApplication(draftApplicationId, payload);
        toast.success("Draft updated successfully");
      } else {
        const result = await travelAPI.createApplication(payload);
        setDraftApplicationId(result.id);
        toast.success("Draft saved successfully");
      }
    } catch (error: any) {
      console.error("Failed to save draft:", error);
      console.log("RAW ERROR:", error.response?.data);
      console.log("RAW ERRORS:", error.response?.data?.errors);

      const backendErrors = error.response?.data?.errors;
      const message = extractErrorMessage(backendErrors);
      // toast.error(error.response?.errors?.trip_0?.duplicate || "Failed to save draft. Please try again.");
      toast.error(message || "Failed to save draft. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  /*
  response: 
    "{\"success\":false,\"message\":\"Validation failed\",\"data\":null,\"errors\":{\"trip_0\":\"{'duplicate': ErrorDetail(string='You already have an active travel application overlapping this period.', code='invalid')}\"}}"
  responseText: 
    "{\"success\":false,\"message\":\"Validation failed\",\"data\":null,\"errors\":{\"trip_0\":\"{'duplicate': ErrorDetail(string='You already have an active travel application overlapping this period.', code='invalid')}\"}}"
   */

  const handleSubmit = async () => {
    if (!validatePurpose()) {
      setActiveTab("purpose");
      toast.error("Please fill all required fields in Purpose section");
      return;
    }

    if (!validateBookings()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = buildPayload(false);

      let applicationId = draftApplicationId;

      if (applicationId) {
        await travelAPI.updateApplication(applicationId, payload);
      } else {
        const result = await travelAPI.createApplication(payload);
        applicationId = result.id;
      }

      // Submit the application
      if (applicationId) {
        await travelAPI.submitApplication(applicationId);
      }

      toast.success("Travel application submitted successfully!");
      clearForm();
    } catch (error: any) {
      console.error("Failed to submit application:", error);
      const backendErrors = error.response?.data?.errors;
      const message = extractErrorMessage(backendErrors);
      toast.error(message || "Failed to submit application. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentTabIndex = TABS.findIndex((t) => t.id === activeTab);

  const goToPrevTab = () => {
    if (currentTabIndex > 0) {
      setActiveTab(TABS[currentTabIndex - 1].id);
    }
  };

  const goToNextTab = () => {
    if (currentTabIndex < TABS.length - 1) {
      setActiveTab(TABS[currentTabIndex + 1].id);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Plane className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-foreground">
                  Travel Application
                </h1>
                <p className="text-xs text-muted-foreground">
                  {draftApplicationId
                    ? `Draft #${draftApplicationId}`
                    : "Create new request"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => setShowClearDialog(true)}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Clear
              </Button>
              <Button
                variant="outline"
                onClick={handleSaveAsDraft}
                disabled={isSaving}
              >
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? "Saving..." : "Save Draft"}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !isFormValid}
                title={
                  !isFormValid
                    ? "Please complete all required fields and fix any errors"
                    : "Submit application"
                }
              >
                <Send className="w-4 h-4 mr-2" />
                {isSubmitting ? "Submitting..." : "Submit"}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Booking Errors Alert */}
      {hasBookingErrors && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <Alert className="border-destructive/50 bg-destructive/10">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <AlertDescription className="text-destructive">
              <strong>Booking Date Errors:</strong> Some booking dates are
              outside the trip window ({purposeData.departure_date} to{" "}
              {purposeData.return_date}). Please review and correct the
              highlighted bookings before submitting.
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Tab Navigation */}
      <nav className="bg-card border-b border-border sticky top-16 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex overflow-x-auto scrollbar-hide">
            {TABS.map((tab, index) => {
              const Icon = tab.icon;
              const status = getTabStatus(tab.id);
              const isActive = status === "active";
              const isCompleted = status === "complete";
              const isError = status === "error";

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2 px-6 py-4 font-medium transition-all border-b-2 whitespace-nowrap min-w-fit",
                    isActive
                      ? "text-primary border-primary bg-primary/5"
                      : isError
                        ? "text-destructive border-destructive hover:bg-destructive/5"
                        : isCompleted
                          ? "text-green-600 border-green-500 hover:bg-muted/50"
                          : "text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/50",
                  )}
                >
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : isError
                          ? "bg-destructive text-destructive-foreground"
                          : isCompleted
                            ? "bg-green-500 text-white"
                            : "bg-muted text-muted-foreground",
                    )}
                  >
                    {isError ? (
                      <AlertTriangle className="w-4 h-4" />
                    ) : isCompleted && !isActive ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      index + 1
                    )}
                  </div>
                  <Icon size={18} />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoadingData ? (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading form data...</p>
            </div>
          </div>
        ) : (
          <div className="min-h-[60vh]">
            {activeTab === "purpose" && (
              <PurposeSection
                formData={purposeData}
                setFormData={setPurposeData}
                errors={purposeErrors}
                setErrors={setPurposeErrors}
                cities={cities}
                glCodes={glCodes}
              />
            )}

            {activeTab === "ticketing" && (
              <TicketingSection
                ticketing={ticketing}
                setTicketing={setTicketing}
                notRequired={ticketingNotRequired}
                setNotRequired={setTicketingNotRequired}
                tripStartDate={purposeData.departure_date}
                tripEndDate={purposeData.return_date}
                cities={cities}
                travelModes={travelModes.filter(
                  (m) => m.name === "Flight" || m.name === "Train",
                )}
                travelSubOptions={travelSubOptions.ticketing}
                bookingErrors={ticketingErrors}
              />
            )}

            {activeTab === "accommodation" && (
              <AccommodationSection
                accommodation={accommodation}
                setAccommodation={setAccommodation}
                notRequired={accommodationNotRequired}
                setNotRequired={setAccommodationNotRequired}
                tripStartDate={purposeData.departure_date}
                tripEndDate={purposeData.return_date}
                travelModes={travelModes.filter(
                  (m) => m.name === "Accommodation",
                )}
                travelSubOptions={travelSubOptions.accommodation}
                guestHouses={guestHouses}
                arcHotels={arcHotels}
                cities={cities}
                bookingErrors={accommodationErrors}
              />
            )}

            {activeTab === "conveyance" && (
              <ConveyanceSection
                conveyance={conveyance}
                setConveyance={setConveyance}
                notRequired={conveyanceNotRequired}
                setNotRequired={setConveyanceNotRequired}
                tripStartDate={purposeData.departure_date}
                tripEndDate={purposeData.return_date}
                travelModes={travelModes.filter(
                  (m) => !["Flight", "Train", "Accommodation"].includes(m.name),
                )}
                travelSubOptions={travelSubOptions.conveyance}
                bookingErrors={conveyanceErrors}
              />
            )}

            {activeTab === "advance" && (
              <AdvanceSection
                ticketing={ticketing}
                accommodation={accommodation}
                conveyance={conveyance}
                otherExpenses={Number(purposeData.advance_amount || 0)}
              />
            )}
          </div>
        )}

        {/* Navigation Footer */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
          <Button
            variant="outline"
            onClick={goToPrevTab}
            disabled={currentTabIndex === 0}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>

          <div className="flex items-center gap-2">
            {TABS.map((tab) => {
              const status = getTabStatus(tab.id);
              return (
                <div
                  key={tab.id}
                  className={cn(
                    "w-2.5 h-2.5 rounded-full transition-colors cursor-pointer",
                    status === "active"
                      ? "bg-primary"
                      : status === "error"
                        ? "bg-destructive"
                        : status === "complete"
                          ? "bg-green-500"
                          : "bg-muted",
                  )}
                  onClick={() => setActiveTab(tab.id)}
                />
              );
            })}
          </div>

          {currentTabIndex < TABS.length - 1 ? (
            <Button onClick={goToNextTab}>
              Next
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !isFormValid}
            >
              <Send className="w-4 h-4 mr-2" />
              {isSubmitting ? "Submitting..." : "Submit Application"}
            </Button>
          )}
        </div>
      </main>

      {/* Clear Form Confirmation Dialog */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Form?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all entered data and cannot be undone. Are you
              sure you want to clear the form?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={clearForm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Clear Form
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
