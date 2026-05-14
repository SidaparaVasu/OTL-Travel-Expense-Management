import React, {
  useState,
  useEffect,
  useContext,
  useCallback,
  useMemo,
} from "react";
import { useNavigate } from "react-router-dom";
import { EditModeContext } from "@/src/contexts/EditModeContext";
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
  Info,
  Users,
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
import { TravelForSection } from "./TravelForSection";
import {
  getEmptyPurposeForm,
  getEmptyTicketing,
  getEmptyAccommodation,
  getEmptyConveyance,
  LOCATION_TYPES,
} from "../lib/travel-constants";
import {
  validateTicketingDates,
  validateAccommodationDates,
  validateConveyanceDates,
  isPastDate,
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  travelAPI,
  locationAPI,
  type City,
  type GLCode,
  type TravelMode,
  type TravelSubOption,
  type GuestHouse,
  type ARCHotel,
  type MealPreference,
} from "@/src/api/travel-api";
import { authAPI } from "@/src/api/auth";
import { ROUTES } from "@/routes/routes";
import { GuestProfile } from "@/src/types/travel.types";

const STORAGE_KEY = "travel_application_form";

type BulkBookingCategory = "ticketing" | "accommodation" | "conveyance";

const getBulkFileClientKey = (
  category: BulkBookingCategory,
  index: number,
) => `${category}-${index}`;

interface TabConfig {
  id: string;
  label: string;
  icon: React.ElementType;
}

const TABS: TabConfig[] = [
  { id: "travel_for", label: "Traveller(s)", icon: Users },
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
  const navigate = useNavigate();
  const { setEditMode } = useContext(EditModeContext);

  const [activeTab, setActiveTab] = useState("travel_for");
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draftApplicationId, setDraftApplicationId] = useState<number | null>(
    null,
  );

  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [editApplicationId, setEditApplicationId] = useState<number | null>(
    null,
  );
  const [isLoadingEditData, setIsLoadingEditData] = useState(false);
  const [originalStatus, setOriginalStatus] = useState<string | null>(null);
  const [applicationCreatedAt, setApplicationCreatedAt] = useState<string | null>(null);

  // Guest Logic
  const [travelFor, setTravelFor] = useState<"self" | "guest" | "self_guest">(
    "self",
  );
  const [selectedGuests, setSelectedGuests] = useState<GuestProfile[]>([]);

  // Detect edit mode from URL parameters
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const editId = searchParams.get("edit");

    if (editId) {
      setIsEditMode(true);
      setEditApplicationId(Number(editId));
    }
  }, []);

  // API Data
  const [cities, setCities] = useState<City[]>([]);
  const [glCodes, setGLCodes] = useState<GLCode[]>([]);
  const [travelModes, setTravelModes] = useState<TravelMode[]>([]);
  const [mealPreferences, setMealPreferences] = useState<MealPreference[]>([]);

  // Policy & Permission State
  const [canSubmitBackdated, setCanSubmitBackdated] = useState(false);
  const [backdatedExpiry, setBackdatedExpiry] = useState<string | null>(null);

  // Self Preferences
  const [selfPreferences, setSelfPreferences] = useState<{
    flight_meal_preference?: number;
    accommodation_meal_preference?: number;
  }>({});

  const [travelSubOptions, setTravelSubOptions] =
    useState<TravelSubOptionsGrouped>({
      ticketing: {},
      accommodation: {},
      conveyance: {},
    });
  const [guestHouses, setGuestHouses] = useState<GuestHouse[]>([]);
  const [arcHotels, setARCHotels] = useState<ARCHotel[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Approver data from user profile
  const [userId, setUserId] = useState<number | null>(null);
  const [userGrade, setUserGrade] = useState<string | null>(null);
  const [approverData, setApproverData] = useState<{
    full_name: string;
    email: string;
    grade: string | null;
    employee_code: string;
  } | null>(null);

  // Selected approver state
  const [selectedApproverId, setSelectedApproverId] = useState<number | null>(null);
  const [selectedApproverDetails, setSelectedApproverDetails] = useState<{
    full_name: string;
    email: string;
    grade: string | null;
    employee_id: string | null;
    is_temp_authorized?: boolean;
  } | null>(null);

  // Purpose form state
  const [purposeData, setPurposeData] = useState(getEmptyPurposeForm);
  const [purposeErrors, setPurposeErrors] = useState<Record<string, string>>(
    {},
  );

  // Ticketing state
  const [ticketing, setTicketing] = useState<any[]>([]);
  const [ticketingNotRequired, setTicketingNotRequired] = useState(false);
  const [ticketingErrors, setTicketingErrors] = useState<
    Record<number, string>
  >({});

  // Accommodation state
  const [accommodation, setAccommodation] = useState<any[]>([]);
  const [accommodationNotRequired, setAccommodationNotRequired] =
    useState(false);
  const [accommodationErrors, setAccommodationErrors] = useState<
    Record<number, string>
  >({});

  // Conveyance state
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
          purposeData.start_time,
          purposeData.return_date,
          purposeData.end_time,
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
          purposeData.start_time,
          purposeData.return_date,
          purposeData.end_time,
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
          purposeData.start_time,
          purposeData.return_date,
          purposeData.end_time,
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
    purposeData.start_time,
    purposeData.return_date,
    purposeData.end_time,
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
        // Fetch profile to check back-dated permission
        authAPI.getProfile().then(res => {
          if (res) {
            setCanSubmitBackdated(res.can_submit_backdated || false);
            setBackdatedExpiry(res.backdated_expiry || null);
          }
        }).catch(err => console.error("Profile fetch failed:", err));

        const [
          citiesData,
          glCodesData,
          travelModesData,
          guestHousesData,
          mealPreferencesData,
        ] = await Promise.all([
          locationAPI.getAllCities(),
          travelAPI.getActiveGLCodes(),
          travelAPI.getAllowedTravelModes(),
          travelAPI.getGuestHouses(),
          travelAPI.getMealPreferences(),
          // travelAPI.getARCHotelsDropdown(),
        ]);

        setCities(citiesData);
        setGLCodes(glCodesData);
        setTravelModes(travelModesData.modes);
        setMealPreferences(mealPreferencesData);
        const { ticketing, accommodation, conveyance } =
          prepareSectionWiseTravelData(
            travelModesData.modes,
            travelModesData.subOptions,
          );
        setTravelSubOptions({ ticketing, accommodation, conveyance });
        setGuestHouses(guestHousesData);
        // setARCHotels(arcHotelsData); // Removed initial load
      } catch (error) {
        console.error("Failed to load master data:", error);
        toast.error("Failed to load form data. Using default values.");
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchData();
  }, []);

  // Fetch ARC Hotels based on trip location
  useEffect(() => {
    const fetchFilteredARCHotels = async () => {
      const cityIds: number[] = [];
      if (purposeData.trip_from_location) {
        cityIds.push(purposeData.trip_from_location);
      }
      if (purposeData.trip_to_location) {
        cityIds.push(purposeData.trip_to_location);
      }

      if (cityIds.length > 0) {
        // Only fetch if we have at least one city selected
        try {
          const hotels = await travelAPI.getARCHotelsDropdown(cityIds);
          setARCHotels(hotels);
        } catch (error) {
          console.error("Failed to fetch filtered ARC hotels", error);
        }
      } else {
        // If no cities selected, maybe clear the list or show all?
        // showing all might be too heavy (4000+). Let's keep it empty or show all if needed.
        // For now, let's just clear it to encourage selection.
        setARCHotels([]);
      }
    };

    fetchFilteredARCHotels();
  }, [purposeData.trip_from_location, purposeData.trip_to_location]);

  // Fetch user profile to get approver details
  useEffect(() => {
    const fetchApproverData = async () => {
      try {
        const profileData = await authAPI.getProfile();
        if (profileData?.id) {
          setUserId(profileData.id);
        }

        // Capture user's own grade for approver field contextual messaging
        if (profileData?.profile?.grade_name) {
          setUserGrade(profileData.profile.grade_name);
        }

        // Extract reporting_manager_details from organizational profile
        if (profileData?.profile?.reporting_manager_details) {
          const manager = profileData.profile.reporting_manager_details;
          setApproverData({
            full_name: manager.name || "N/A",
            email: manager.email || "N/A",
            grade: manager.grade || null,
            employee_code:
              manager.employee_code || manager.employee_id || "N/A",
          });
        }
      } catch (error) {
        console.error("Failed to load approver data:", error);
        // Keep approverData as null if fetch fails
      }
    };

    fetchApproverData();
  }, []);

  // Fetch application data for editing
  useEffect(() => {
    if (isEditMode && editApplicationId && !isLoadingData) {
      const fetchApplicationForEdit = async () => {
        setIsLoadingEditData(true);
        try {
          const response =
            await travelAPI.getApplicationForEdit(editApplicationId);

          if (!response.data.can_edit) {
            toast.error(response.data.reason || "Cannot edit this application");
            navigate(ROUTES.travelApplicationList);
            return;
          }

          const app = response.data.application;

          // Store original status to determine if we need to call submit later
          setOriginalStatus(app.status);
          setApplicationCreatedAt(app.created_at || null);

          // Populate Travel For & Guests
          if (app.travel_for) setTravelFor(app.travel_for);
          if (app.travelers) {
            const guests = app.travelers
              .filter((t: any) => t.guest) // Only guest travelers
              .map((t: any) => ({
                id: t.guest,
                first_name: t.first_name || "",
                last_name: t.last_name || "",
                email: t.email || "",
                contact_number: t.contact_number || "",
                gender: t.gender || "O",
                age: t.age || undefined,
                nationality_type: t.nationality_type || "indian",
              }));
            // Ideally we should have full guest profile, but for now map what we have
            // Or fetch guest details if needed.
            // Assuming basic display fields are present in traveler serializer response
            setSelectedGuests(guests);

            // Set Self Preferences
            const selfTraveler = app.travelers.find((t: any) => t.user); // or matches current user
            if (selfTraveler) {
              setSelfPreferences({
                flight_meal_preference: selfTraveler.flight_meal_preference,
                accommodation_meal_preference:
                  selfTraveler.accommodation_meal_preference,
              });
            }
          }

          // Pre-fill purpose data
          if (app.trip_details && app.trip_details.length > 0) {
            const trip = app.trip_details[0];

            setPurposeData({
              trip_id: trip.id || null, // Preserve Trip ID
              purpose: app.purpose || "",
              internal_order: app.internal_order || "",
              general_ledger: app.general_ledger || null,
              sanction_number: app.sanction_number || "",
              advance_amount: app.advance_amount
                ? String(app.advance_amount)
                : "",
              trip_from_location: trip.from_location || null,
              trip_to_location: trip.to_location || null,
              departure_date: trip.departure_date || "",
              start_time: trip.start_time || "",
              return_date: trip.return_date || "",
              end_time: trip.end_time || "",
              is_back_dated: !!(trip.departure_date && app.created_at && trip.departure_date < app.created_at.split('T')[0]),
            });

            // Pre-fill bookings
            if (trip.bookings && trip.bookings.length > 0) {
              const ticketingData: any[] = [];
              const accommodationData: any[] = [];
              const conveyanceData: any[] = [];

              trip.bookings.forEach((booking: any) => {
                // Use booking_type_name directly from API response for reliable categorization
                const modeName = booking.booking_type_name || 
                  travelModes.find((m) => m.id === booking.booking_type)?.name || "";

                // Skip system-generated bulk bookings — not editable
                if (modeName === "Bulk Booking" || booking.booking_details?.is_system_generated) {
                  return;
                }

                if (modeName === "Flight" || modeName === "Train") {
                  // Ticketing
                  ticketingData.push({
                    id: booking.id,
                    booking_type: String(booking.booking_type),
                    sub_option: String(booking.sub_option),
                    estimated_cost: booking.estimated_cost || "",
                    special_instruction: booking.special_instruction || "",
                    ticket_number: booking.booking_details?.ticket_number || "",
                    is_self_arranged:
                      booking.booking_details?.is_self_arranged || false,
                    from_location:
                      booking.booking_details?.from_location || null,
                    from_label:
                      booking.booking_details?.from_location_name || "",
                    to_location: booking.booking_details?.to_location || null,
                    to_label: booking.booking_details?.to_location_name || "",
                    departure_date:
                      booking.booking_details?.departure_date || "",
                    departure_time:
                      booking.booking_details?.departure_time || "",
                    arrival_date: booking.booking_details?.arrival_date || "",
                    arrival_time: booking.booking_details?.arrival_time || "",
                    meal_preference:
                      booking.booking_details?.meal_preference || "",
                    // Bulk file — pre-fill from server for edit mode
                    existing_bulk_booking_file: booking.bulk_booking_file || null,
                    bulk_booking_file: null,
                    remove_bulk_booking_file: false,
                  });
                } else if (modeName === "Accommodation") {
                  // Accommodation
                  accommodationData.push({
                    id: booking.id,
                    accommodation_type: String(booking.booking_type),
                    accommodation_type_label: booking.booking_type_name || "",
                    accommodation_sub_option: String(booking.sub_option),
                    accommodation_sub_option_label:
                      booking.sub_option_name || "",
                    estimated_cost: booking.estimated_cost || "",
                    special_instruction: booking.special_instruction || "",
                    place: booking.booking_details?.place || null,
                    check_in_date: booking.booking_details?.check_in_date || "",
                    check_in_time: booking.booking_details?.check_in_time || "",
                    check_out_date:
                      booking.booking_details?.check_out_date || "",
                    check_out_time:
                      booking.booking_details?.check_out_time || "",
                    meal_preference:
                      booking.booking_details?.meal_preference || "",
                    arc_hotel_preferences:
                      booking.booking_details?.arc_hotel_preferences || [],
                    // Bulk file — pre-fill from server for edit mode
                    existing_bulk_booking_file: booking.bulk_booking_file || null,
                    bulk_booking_file: null,
                    remove_bulk_booking_file: false,
                  });
                } else {
                  // Conveyance — only push if modeName is known (not empty/unmatched)
                  if (!modeName) return;

                  const reportAt = booking.booking_details?.report_at || "";
                  const dropLocation =
                    booking.booking_details?.drop_location || "";

                  const isReportAtCustom =
                    reportAt &&
                    !LOCATION_TYPES.includes(reportAt) &&
                    reportAt !== "Other";
                  const isDropLocationCustom =
                    dropLocation &&
                    !LOCATION_TYPES.includes(dropLocation) &&
                    dropLocation !== "Other";

                  conveyanceData.push({
                    id: booking.id,
                    vehicle_type: String(booking.booking_type),
                    vehicle_type_label: booking.booking_type_name || "",
                    vehicle_sub_option: String(booking.sub_option),
                    vehicle_sub_option_label: booking.sub_option_name || "",
                    estimated_cost: booking.estimated_cost || "",
                    special_instruction: booking.special_instruction || "",
                    from_location:
                      booking.booking_details?.from_location || null,
                    to_location: booking.booking_details?.to_location || null,
                    report_at: isReportAtCustom ? "Other" : reportAt,
                    report_at_other: isReportAtCustom ? reportAt : "",
                    drop_location: isDropLocationCustom
                      ? "Other"
                      : dropLocation,
                    drop_location_other: isDropLocationCustom
                      ? dropLocation
                      : "",
                    start_date: booking.booking_details?.start_date || "",
                    start_time: booking.booking_details?.start_time || "",
                    end_date: booking.booking_details?.end_date || "",
                    end_time: booking.booking_details?.end_time || "",
                    club_booking:
                      booking.booking_details?.club_booking || false,
                    club_reason: booking.booking_details?.club_reason || "",
                    not_required:
                      booking.booking_details?.not_required || false,
                    has_six_airbags:
                      booking.booking_details?.has_six_airbags || false,
                    distance_km: booking.booking_details?.distance_km || "",
                    passenger_count:
                      booking.booking_details?.passenger_count || "1",
                    guests: (booking.booking_details?.guests || []).map(
                      (g: any) => ({
                        id: g.id || null,
                        full_name: g.name || "",
                        employee_id: g.employee_id || null,
                      }),
                    ),
                    // Bulk file — pre-fill from server for edit mode
                    existing_bulk_booking_file: booking.bulk_booking_file || null,
                    bulk_booking_file: null,
                    remove_bulk_booking_file: false,
                  });
                }
              });

              setTicketing(ticketingData);
              setAccommodation(accommodationData);
              setConveyance(conveyanceData);

              // Set "not required" flags if no bookings in that category
              setTicketingNotRequired(
                ticketingData.length === 0 && trip.no_bookings_required,
              );
              setAccommodationNotRequired(
                accommodationData.length === 0 && trip.no_bookings_required,
              );
              setConveyanceNotRequired(
                conveyanceData.length === 0 && trip.no_bookings_required,
              );
            }
          }

          // Set the application ID for updating
          setDraftApplicationId(app.id);

          // Pre-fill selected approver if set
          if (app.selected_approver) {
            setSelectedApproverId(app.selected_approver);
            // selected_approver_name is available from serializer
            if (app.selected_approver_name) {
              setSelectedApproverDetails({
                full_name: app.selected_approver_name,
                email: "",
                grade: null,
                employee_id: null,
              });
            }
          }

          toast.success("Application loaded for editing");
        } catch (error: any) {
          console.error("Failed to load application for editing:", error);
          toast.error(
            error.response?.data?.message || "Failed to load application",
          );
          navigate(ROUTES.travelApplicationList);
        } finally {
          setIsLoadingEditData(false);
        }
      };

      fetchApplicationForEdit();
    }
  }, [
    isEditMode,
    editApplicationId,
    isLoadingData,
    travelModes,
    navigate,
    // Add dependencies if needed for self preferences logic in edit (handled inside)
  ]);

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

        // Load Guest Data
        if (data.travelFor) setTravelFor(data.travelFor);
        if (data.selectedGuests) setSelectedGuests(data.selectedGuests);
        if (data.selfPreferences) setSelfPreferences(data.selfPreferences);
        if (data.selectedApproverId) setSelectedApproverId(data.selectedApproverId);
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
      travelFor,
      selectedGuests,
      selfPreferences,
      selectedApproverId,
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
    travelFor,
    selectedGuests,
    selfPreferences,
    selectedApproverId,
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

      // Hide legacy "Bulk Booking" travel mode from new applications
      if (mode.name === "Bulk Booking") return;

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
    setActiveTab("travel_for");
    setDraftApplicationId(null);
    setTravelFor("self");
    setSelectedGuests([]);
    setSelectedApproverId(null);
    setSelectedApproverDetails(null);
    localStorage.removeItem(STORAGE_KEY);
    setShowClearDialog(false);
  };

  const handleCancelEdit = useCallback(() => {
    setIsEditMode(false);
    setEditApplicationId(null);
    clearForm();
    navigate(ROUTES.travelApplicationList);
  }, [navigate]);

  // Register cancel function with context when in edit mode
  useEffect(() => {
    if (isEditMode) {
      setEditMode(true, handleCancelEdit);
    } else {
      setEditMode(false, null);
    }

    return () => setEditMode(false, null);
  }, [isEditMode, setEditMode, handleCancelEdit]);

  // Tab validation status
  const isTravelForValid = () => {
    // Approver is always required
    if (!selectedApproverId) return false;
    if (travelFor === "self") return true;
    return selectedGuests.length > 0;
  };

  const isPurposeValid = () => {
    return !!(
      purposeData.purpose.trim() &&
      purposeData.internal_order.trim() &&
      purposeData.internal_order.length === 9 &&
      purposeData.general_ledger &&
      purposeData.sanction_number &&
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
    const travelForValid = isTravelForValid();
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
      travelForValid &&
      purposeValid &&
      ticketingValid &&
      accommodationValid &&
      conveyanceValid &&
      hasAtLeastOneBooking &&
      !hasBookingErrors
    );
  }, [
    travelFor,
    selectedGuests,
    selectedApproverId,
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
      case "travel_for":
        return isTravelForValid() ? "complete" : "incomplete";
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

  const validatePurpose = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (!purposeData.purpose.trim()) errors.purpose = "Purpose is required";

    if (!purposeData.internal_order.trim()) {
      errors.internal_order = "IO number is required";
    } else if (purposeData.internal_order.length !== 9) {
      errors.internal_order = "IO Number must be exactly 9 digits";
    }

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
    return errors;
  };

  const validateBookings = (): boolean => {
    // Validate Travel For First
    if (!isTravelForValid()) {
      toast.error("Please ensure travel guest details are correct.");
      return false;
    }

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
    const travelersPayload: any[] = [];
    if (travelFor === "self" || travelFor === "self_guest") {
      travelersPayload.push({
        user: userId,
        flight_meal_preference: selfPreferences.flight_meal_preference,
        accommodation_meal_preference:
          selfPreferences.accommodation_meal_preference,
      });
    }
    if (travelFor === "guest" || travelFor === "self_guest") {
      selectedGuests.forEach((g) => {
        travelersPayload.push({
          guest: g.id,
          flight_meal_preference: g.flight_meal_preference,
          accommodation_meal_preference: g.accommodation_meal_preference,
        });
      });
    }

    return {
      purpose: purposeData.purpose,
      travel_for: travelFor,
      travelers_data: travelersPayload,
      selected_approver: selectedApproverId,
      internal_order: purposeData.internal_order,
      general_ledger: purposeData.general_ledger,
      sanction_number: purposeData.sanction_number,
      advance_amount: purposeData.advance_amount
        ? parseFloat(purposeData.advance_amount)
        : 0,

      trip_details: [
        {
          id: purposeData.trip_id || (purposeData as any).trip_id || undefined, // Pass ID if exists
          from_location: purposeData?.trip_from_location || null,
          to_location: purposeData?.trip_to_location || null,
          departure_date: purposeData?.departure_date || null,
          start_time: purposeData?.start_time || null,
          return_date: purposeData?.return_date || null,
          end_time: purposeData?.end_time || null,
          no_bookings_required:
            ticketingNotRequired &&
            accommodationNotRequired &&
            conveyanceNotRequired,

          bookings: [
            ...ticketing.map((t, index) => ({
              id: (t as any).id || undefined, // Pass ID if exists
              booking_type: parseInt(t.booking_type), // // Ticketing mode ID
              sub_option: parseInt(t.sub_option),
              estimated_cost: parseFloat(t.estimated_cost) || null,
              special_instruction: t.special_instruction,
              booking_details: {
                is_self_arranged: !!t.is_self_arranged, // Add Flag
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
                bulk_file_client_key: getBulkFileClientKey("ticketing", index),
              },
            })),
            ...accommodation.map((a, index) => ({
              id: (a as any).id || undefined, // Pass ID if exists
              booking_type: a.accommodation_type, // Accommodation mode ID
              sub_option: parseInt(a.accommodation_sub_option),
              estimated_cost: parseFloat(a.estimated_cost),
              special_instruction: a.special_instruction || "",
              booking_details: {
                guest_house_preferences: [],
                arc_hotel_preferences: a.arc_hotel_preferences || [],
                place: a.place,
                check_in_date: a.check_in_date,
                check_out_date: a.check_out_date,
                check_in_time: a.check_in_time,
                check_out_time: a.check_out_time,
                meal_preference: a.meal_preference,
                bulk_file_client_key: getBulkFileClientKey(
                  "accommodation",
                  index,
                ),
              },
            })),
            ...conveyance.map((c, index) => ({
              id: (c as any).id || undefined, // Pass ID if exists
              booking_type: parseInt(c.vehicle_type), // Conveyance mode ID
              sub_option: parseInt(c.vehicle_sub_option),
              estimated_cost: parseFloat(c.estimated_cost),
              special_instruction: c.special_instruction || "",
              booking_details: {
                from_location: c.from_location,
                to_location: c.to_location,
                report_at:
                  c.report_at === "Other" ? c.report_at_other : c.report_at,
                drop_location:
                  c.drop_location === "Other"
                    ? c.drop_location_other
                    : c.drop_location,
                start_date: c.start_date,
                start_time: c.start_time || "",
                end_date: c.end_date,
                end_time: c.end_time || "",
                club_booking: !!c.club_booking,
                club_reason: c.club_reason?.trim() || "",
                not_required: !!c.not_required,
                has_six_airbags: c.has_six_airbags,
                distance_km: c.distance_km,
                passenger_count: c.passenger_count,
                guests: (c.guests || []).map((g) => ({
                  id: g.id || null,
                  name: g.full_name,
                  employee_id: g.employee_id || null,
                  is_internal: !!g.employee_id, // employee = internal guest
                  is_external: !g.employee_id, // non-employee = external
                })),
                bulk_file_client_key: getBulkFileClientKey("conveyance", index),
              },
            })),
          ],
        },
      ],
    };
  };

  const normalizeApplicationResponse = (response: any) =>
    response?.data?.application || response?.data || response;

  const uploadPendingBookingBulkFiles = async (applicationId: number) => {
    const savedApp = normalizeApplicationResponse(
      await travelAPI.getApplication(applicationId),
    );
    const savedBookings: any[] =
      savedApp?.trip_details?.flatMap((trip: any) => trip.bookings ?? []) ?? [];

    const allItems = [
      ...ticketing.map((booking: any, index) => ({
        ...booking,
        _category: "ticketing" as BulkBookingCategory,
        _bulkFileClientKey: getBulkFileClientKey("ticketing", index),
      })),
      ...accommodation.map((booking: any, index) => ({
        ...booking,
        _category: "accommodation" as BulkBookingCategory,
        _bulkFileClientKey: getBulkFileClientKey("accommodation", index),
      })),
      ...conveyance.map((booking: any, index) => ({
        ...booking,
        _category: "conveyance" as BulkBookingCategory,
        _bulkFileClientKey: getBulkFileClientKey("conveyance", index),
      })),
    ];

    for (const item of allItems) {
      const hasNewFile = item.bulk_booking_file instanceof File;
      const shouldRemoveExisting =
        item.remove_bulk_booking_file && !item.bulk_booking_file;

      if (!hasNewFile && !shouldRemoveExisting) {
        continue;
      }

      const savedBooking = item.id
        ? savedBookings.find((booking: any) => booking.id === item.id)
        : savedBookings.find(
            (booking: any) =>
              booking.booking_details?.bulk_file_client_key ===
              item._bulkFileClientKey,
          );

      if (!savedBooking) {
        throw new Error(
          `Could not match saved ${item._category} booking for bulk file operation.`,
        );
      }

      if (hasNewFile) {
        await travelAPI.uploadBookingBulkFile(
          savedBooking.id,
          item.bulk_booking_file,
        );
      } else if (shouldRemoveExisting) {
        await travelAPI.removeBookingBulkFile(savedBooking.id);
      }
    }
  };

  function extractErrorMessage(error: any): string {
    if (!error) return "Something went wrong.";
    if (typeof error === "string") {
      const msg = parsePythonErrorString(error);
      if (msg) return msg;
      return error;
    }
    if (Array.isArray(error)) {
      return extractErrorMessage(error[0]);
    }
    if (typeof error === "object") {
      const firstKey = Object.keys(error)[0];
      return extractErrorMessage(error[firstKey]);
    }
    return "Unexpected error occurred.";
  }

  function parsePythonErrorString(pyString: string): string | null {
    const regex = /ErrorDetail\(string='([^']+)'/;
    const match = pyString.match(regex);
    if (match && match[1]) {
      return match[1];
    }
    const altRegex = /'([^']+)'/;
    const altMatch = pyString.match(altRegex);
    if (altMatch && altMatch[1]) {
      return altMatch[1];
    }
    return null;
  }

  const handleSaveAsDraft = async () => {
    if (!purposeData.purpose.trim()) {
      toast.error("Purpose is required to save as draft");
      setActiveTab("purpose");
      return;
    }

    setIsSaving(true);
    try {
      // Hard Enforcement: Re-validate back-dated permission before saving draft
      if (purposeData.is_back_dated) {
        const profile = await authAPI.getProfile();
        if (!profile?.can_submit_backdated) {
          setCanSubmitBackdated(false);
          setBackdatedExpiry(null);
          setPurposeData(prev => ({ ...prev, is_back_dated: false }));
          toast.error("Your back-dated submission window has expired. Please request a new allowance from your Admin.");
          setActiveTab("purpose");
          setIsSaving(false);
          return;
        }
      }

      const payload = buildPayload(true);
      let applicationId = draftApplicationId;

      if (applicationId) {
        await travelAPI.updateApplication(applicationId, payload);
        await uploadPendingBookingBulkFiles(applicationId);
        toast.success("Draft updated successfully");
        clearForm();
        navigate(ROUTES.travelApplicationList);
      } else {
        const result: any = await travelAPI.createApplication(payload as any);
        const newId = result.data?.id || result.id;

        if (newId) {
          await uploadPendingBookingBulkFiles(newId);
          setDraftApplicationId(newId);
          toast.success("Draft saved successfully");
          clearForm();
          navigate(ROUTES.travelApplicationList);
        } else {
          toast.error("Failed to save draft. No ID returned.");
        }
      }
    } catch (error: any) {
      console.error("Failed to save draft:", error);
      const responseData = error.response?.data;
      const backendErrors = responseData?.errors;
      let message = extractErrorMessage(backendErrors);
      if (
        message === "Something went wrong." ||
        message === "Unexpected error occurred."
      ) {
        if (responseData?.message) {
          message = responseData.message;
        } else if (responseData && typeof responseData === "object") {
          const retry = extractErrorMessage(responseData);
          if (
            retry !== "Something went wrong." &&
            retry !== "Unexpected error occurred."
          ) {
            message = retry;
          }
        }
      }
      toast.error(message || "Failed to save draft. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!isTravelForValid()) {
      toast.error("Please ensure travel guest details are correct.");
      setActiveTab("travel_for");
      return;
    }

    // Hard Enforcement: Re-validate back-dated permission before submission
    if (purposeData.is_back_dated) {
      setIsSubmitting(true);
      try {
        const profile = await authAPI.getProfile();
        if (!profile?.can_submit_backdated) {
          setCanSubmitBackdated(false);
          setBackdatedExpiry(null);
          setPurposeData(prev => ({ ...prev, is_back_dated: false }));
          toast.error("Your back-dated submission window has expired. Please request a new allowance from your Admin.");
          setActiveTab("purpose");
          setIsSubmitting(false);
          return;
        }
      } catch (err) {
        toast.error("Failed to verify submission eligibility. Please try again.");
        setIsSubmitting(false);
        return;
      } finally {
        setIsSubmitting(false);
      }
    }

    const purposeErrors = validatePurpose();
    if (Object.keys(purposeErrors).length > 0) {
      setActiveTab("purpose");
      if (
        purposeErrors.internal_order === "IO Number must be exactly 9 digits"
      ) {
        toast.error("IO Number must be exactly 9 digits");
      } else {
        toast.error("Please fill all required fields in Purpose section");
      }
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
        const result: any = await travelAPI.createApplication(payload as any);
        applicationId = result.data?.id || result.id;
      }

      if (applicationId) {
        const shouldCallSubmit = !isEditMode || originalStatus === "draft";

        await uploadPendingBookingBulkFiles(applicationId);

        if (shouldCallSubmit) {
          await travelAPI.submitApplication(applicationId);
        }

        const successMessage = isEditMode
          ? "Travel application updated successfully!"
          : "Travel application submitted successfully!";
        toast.success(successMessage);
        clearForm();
        navigate(ROUTES.travelApplicationList);
      } else {
        toast.error("Failed to create application. Please try again.");
      }
    } catch (error: any) {
      console.error("Failed to submit application:", error);
      const responseData = error.response?.data;
      const backendErrors = responseData?.errors;
      let message = extractErrorMessage(backendErrors);

      if (
        message === "Something went wrong." ||
        message === "Unexpected error occurred."
      ) {
        if (responseData?.message) {
          message = responseData.message;
        } else if (responseData && typeof responseData === "object") {
          const retry = extractErrorMessage(responseData);
          if (
            retry !== "Something went wrong." &&
            retry !== "Unexpected error occurred."
          ) {
            message = retry;
          }
        }
      }

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
    if (activeTab === "travel_for" && !isTravelForValid()) {
      toast.error("Please add at least one guest or select 'Self' travel.");
      return;
    }
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
                  {isEditMode
                    ? "Update Travel Application"
                    : "Travel Application"}
                </h1>
                <p className="text-xs text-black">
                  {isEditMode
                    ? "Editing Application"
                    : draftApplicationId
                      ? `Draft #${draftApplicationId}`
                      : "Create new request"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Approver Info */}
              {(selectedApproverDetails || approverData) && (
                <div className="flex items-center gap-2 text-sm text-black mr-2">
                  <span>
                    {selectedApproverDetails ? "Selected Approver" : "Approver Details"}
                  </span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-muted hover:bg-muted/80 transition-colors">
                        <Info className="w-3.5 h-3.5 text-black" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80" align="end">
                      <div className="space-y-3">
                        <h4 className="font-semibold text-sm text-black border-b pb-2">
                          {selectedApproverDetails
                            ? "Selected Approver"
                            : "Approver Details (Reporting Manager)"}
                        </h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-black">Name:</span>
                            <span className="font-semibold text-primary">
                              {selectedApproverDetails
                                ? selectedApproverDetails.full_name
                                : approverData?.full_name}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-black">Email:</span>
                            <span className="font-semibold text-foreground">
                              {selectedApproverDetails
                                ? selectedApproverDetails.email
                                : approverData?.email}
                            </span>
                          </div>
                          {(selectedApproverDetails?.grade || approverData?.grade) && (
                            <div className="flex justify-between">
                              <span className="text-black">Grade:</span>
                              <span className="font-semibold text-foreground">
                                {selectedApproverDetails
                                  ? selectedApproverDetails.grade
                                  : approverData?.grade}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-black">Employee Code:</span>
                            <span className="font-semibold text-foreground">
                              {selectedApproverDetails
                                ? (selectedApproverDetails.employee_id || "N/A")
                                : approverData?.employee_code}
                            </span>
                          </div>
                          {selectedApproverDetails?.is_temp_authorized && (
                            <div className="flex justify-between">
                              <span className="text-black">Authorization:</span>
                              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                                Temporary
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              <Button
                variant="outline"
                onClick={() => setShowClearDialog(true)}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Clear Form
              </Button>

              {/* Cancel Edit button - only in edit mode */}
              {isEditMode && (
                <Button
                  variant="outline"
                  onClick={() => {
                    if (
                      confirm(
                        "Cancel editing? All unsaved changes will be lost.",
                      )
                    ) {
                      clearForm();
                      navigate(ROUTES.travelApplicationList);
                    }
                  }}
                  className="text-orange-600 border-orange-300 hover:bg-orange-50 hover:text-orange-600"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Cancel Edit
                </Button>
              )}

              {/* Save Draft button - hide in edit mode */}
              {/* {!isEditMode && ( */}
              <Button
                variant="outline"
                onClick={handleSaveAsDraft}
                disabled={isSaving}
              >
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? "Saving..." : "Save Draft"}
              </Button>
              {/* )} */}

              {/* Submit/Update button */}
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !isFormValid}
                title={
                  !isFormValid
                    ? "Please complete all required fields and fix any errors"
                    : isEditMode
                      ? "Update application"
                      : "Submit application"
                }
              >
                {isEditMode ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    {isSubmitting ? "Updating..." : "Update & Submit"}
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    {isSubmitting ? "Submitting..." : "Submit"}
                  </>
                )}
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
              <strong>Booking Date Issues:</strong> Some booking dates are
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
          <div className="flex overflow-x-auto scrollbar-hide no-scrollbar">
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
            {activeTab === "travel_for" && (
              <TravelForSection
                travelFor={travelFor}
                setTravelFor={setTravelFor}
                selectedGuests={selectedGuests}
                setSelectedGuests={setSelectedGuests}
                mealPreferences={mealPreferences}
                selfPreferences={selfPreferences}
                setSelfPreferences={setSelfPreferences}
                selectedApproverId={selectedApproverId}
                userGrade={userGrade}
                onApproverSelected={(approver) => {
                  setSelectedApproverId(approver?.id ?? null);
                  setSelectedApproverDetails(
                    approver
                      ? {
                          full_name: approver.name,
                          email: approver.email,
                          grade: approver.grade,
                          employee_id: approver.employee_id,
                          is_temp_authorized: approver.is_temp_authorized,
                        }
                      : null,
                  );
                }}
              />
            )}

            {activeTab === "purpose" && (
              <PurposeSection
                formData={purposeData}
                setFormData={setPurposeData}
                errors={purposeErrors}
                setErrors={setPurposeErrors}
                cities={cities}
                glCodes={glCodes}
                canSubmitBackdated={canSubmitBackdated}
                backdatedExpiry={backdatedExpiry}
                applicationCreatedAt={applicationCreatedAt}
                isEditMode={isEditMode}
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
                travelFor={travelFor}
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
                defaultCityId={
                  purposeData.trip_to_location
                    ? Number(purposeData.trip_to_location)
                    : null
                }
                defaultCityLabel={purposeData.trip_to_location_label}
                travelFor={travelFor}
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
                  (m) => !["Flight", "Train", "Accommodation", "Bulk Booking"].includes(m.name),
                )}
                travelSubOptions={travelSubOptions.conveyance}
                bookingErrors={conveyanceErrors}
                travelFor={travelFor}
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
