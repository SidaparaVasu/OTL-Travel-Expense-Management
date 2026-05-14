import React, { useState, useEffect, useMemo } from "react";
import {
  User,
  Users,
  Plus,
  Trash2,
  Search,
  Check,
  X,
  Loader2,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Combobox,
  ComboboxInput,
  ComboboxOptions,
  ComboboxOption,
} from "@headlessui/react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { GuestProfile } from "@/src/types/travel.types";
import { guestProfileAPI } from "@/src/api/guest-profile";
import { travelAPI, type MealPreference, type EligibleApprover } from "@/src/api/travel-api";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Plane, Building, Utensils } from "lucide-react";

interface TravelForSectionProps {
  travelFor: "self" | "guest" | "self_guest";
  setTravelFor: (value: "self" | "guest" | "self_guest") => void;
  selectedGuests: GuestProfile[];
  setSelectedGuests: (guests: GuestProfile[]) => void;
  mealPreferences: MealPreference[];
  selfPreferences: {
    flight_meal_preference?: number;
    accommodation_meal_preference?: number;
  };
  setSelfPreferences: (prefs: {
    flight_meal_preference?: number;
    accommodation_meal_preference?: number;
  }) => void;
  selectedApproverId: number | null;
  onApproverSelected: (approver: EligibleApprover | null) => void;
  userGrade?: string | null;
}

export const TravelForSection: React.FC<TravelForSectionProps> = ({
  travelFor,
  setTravelFor,
  selectedGuests,
  setSelectedGuests,
  mealPreferences,
  selfPreferences,
  setSelfPreferences,
  selectedApproverId,
  onApproverSelected,
  userGrade = null,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GuestProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Approver state
  const [eligibleApprovers, setEligibleApprovers] = useState<EligibleApprover[]>([]);
  const [approverQuery, setApproverQuery] = useState("");
  const [isLoadingApprovers, setIsLoadingApprovers] = useState(false);
  const [approverError, setApproverError] = useState(false);
  const [selectedApproverObj, setSelectedApproverObj] = useState<EligibleApprover | null>(null);

  // Stats
  const guestCount = selectedGuests.length;
  const totalPerson = travelFor === "self_guest" ? guestCount + 1 : guestCount;

  // Fetch eligible approvers on mount
  useEffect(() => {
    const fetchApprovers = async () => {
      setIsLoadingApprovers(true);
      try {
        const list = await travelAPI.getEligibleApprovers();
        setEligibleApprovers(list);
      } catch {
        setApproverError(true);
      } finally {
        setIsLoadingApprovers(false);
      }
    };
    fetchApprovers();
  }, []);

  // Sync selectedApproverId with selectedApproverObj (for edit mode pre-fill)
  useEffect(() => {
    if (selectedApproverId && eligibleApprovers.length > 0) {
      const found = eligibleApprovers.find(a => a.id === selectedApproverId);
      if (found) setSelectedApproverObj(found);
    }
    if (!selectedApproverId) {
      setSelectedApproverObj(null);
    }
  }, [selectedApproverId, eligibleApprovers]);

  // Filtered approvers based on search query
  const filteredApprovers = approverQuery.trim() === ""
    ? eligibleApprovers
    : eligibleApprovers.filter(a =>
        a.name.toLowerCase().includes(approverQuery.toLowerCase()) ||
        (a.email && a.email.toLowerCase().includes(approverQuery.toLowerCase())) ||
        (a.grade && a.grade.toLowerCase().includes(approverQuery.toLowerCase())) ||
        (a.employee_id && a.employee_id.toLowerCase().includes(approverQuery.toLowerCase()))
      );

  // Search Guests
  useEffect(() => {
    const searchGuests = async () => {
      if (!searchQuery || searchQuery.length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const results = await guestProfileAPI.list(searchQuery);
        console.log(results);
        // Filter out already selected guests
        const filtered = results.filter(
          (g) => !selectedGuests.some((s) => s.id === g.id),
        );
        setSearchResults(filtered);
      } catch (error) {
        console.error("Failed to search guests", error);
      } finally {
        setIsSearching(false);
      }
    };

    // Debounce search
    const timer = setTimeout(searchGuests, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedGuests]);

  const handleAddGuest = (guest: GuestProfile) => {
    setSelectedGuests([...selectedGuests, guest]);
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleRemoveGuest = (guestId: number) => {
    setSelectedGuests(selectedGuests.filter((g) => g.id !== guestId));
  };

  // Feature flag to control visibility of Self Meal Preferences
  const SHOW_SELF_MEAL_PREF = false;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <Users className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            Traveller(s)
          </h2>
          <p className="text-sm text-muted-foreground">
            Tell us who this travel application is for.
          </p>
        </div>
      </div>

      {/* Radio Selection */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-4">
        <label className="text-sm font-medium">
          Travel application for? <span className="text-destructive">*</span>
        </label>
        <RadioGroup
          value={travelFor}
          onValueChange={(v: "self" | "guest" | "self_guest") =>
            setTravelFor(v)
          }
          className="flex flex-col space-y-2 sm:flex-row sm:space-x-8 sm:space-y-0"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="self" id="travel-self" />
            <Label htmlFor="travel-self" className="cursor-pointer font-medium">
              Self
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="guest" id="travel-guest" />
            <Label
              htmlFor="travel-guest"
              className="cursor-pointer font-medium"
            >
              Guest(s)
            </Label>
          </div>
          {/* <div className="flex items-center space-x-2">
            <RadioGroupItem value="self_guest" id="travel-self-guest" />
            <Label
              htmlFor="travel-self-guest"
              className="cursor-pointer font-medium"
            >
              Self with Guest(s)
            </Label>
          </div> */}
        </RadioGroup>

        {travelFor === "self" && (
          <p className="text-sm text-muted-foreground pt-2">
            This travel request is for you only.
          </p>
        )}
      </div>

      {/* Approver Selection */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <UserCheck className="w-4 h-4 text-primary" />
          </div>
          <div>
            <label className="text-sm font-medium">
              Select Approver <span className="text-destructive">*</span>
            </label>
            {userGrade && ['B-2A', 'B-2B'].includes(userGrade.toUpperCase()) ? (
              <p className="text-xs text-muted-foreground">
                Your request will be auto-approved. In special conditions, CEO/CHRO approval will be required.
              </p>
            ) : userGrade && userGrade.toUpperCase() === 'B-3' ? (
              <p className="text-xs text-muted-foreground">
                Your request may be auto-approved based on your booking type. If higher authority approval is required, the selected person will be your approver.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                This person will approve your travel request.
              </p>
            )}
          </div>
        </div>

        {approverError ? (
          <p className="text-sm text-destructive">
            Failed to load approvers. Please refresh the page.
          </p>
        ) : (
          <div className="space-y-3">
            <Combobox
              value={selectedApproverObj}
              onChange={(approver: EligibleApprover | null) => {
                setSelectedApproverObj(approver);
                setApproverQuery("");
                onApproverSelected(approver);
              }}
            >
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <ComboboxInput
                    className={cn(
                      "w-full pl-10 pr-3 py-2.5 rounded-lg border bg-card text-card-foreground transition-all duration-200",
                      "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary",
                      "placeholder:text-muted-foreground border-input hover:border-primary/50",
                      !selectedApproverId && "border-destructive/50",
                    )}
                    displayValue={(approver: EligibleApprover | null) =>
                      approver ? `${approver.name}${approver.grade ? ` (${approver.grade})` : ""}` : ""
                    }
                    onChange={(e) => setApproverQuery(e.target.value)}
                    placeholder={
                      isLoadingApprovers
                        ? "Loading approvers..."
                        : "Search by name, email or grade..."
                    }
                  />
                </div>

                <ComboboxOptions className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-popover border border-border shadow-lg">
                  {isLoadingApprovers ? (
                    <div className="px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                    </div>
                  ) : filteredApprovers.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-muted-foreground">
                      No approvers found.
                    </div>
                  ) : (
                    filteredApprovers.map((approver) => (
                      <ComboboxOption
                        key={approver.id}
                        value={approver}
                        className={({ active }) =>
                          cn(
                            "relative cursor-pointer select-none px-4 py-3 transition-colors",
                            active ? "bg-primary/10" : "text-foreground",
                          )
                        }
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-800">
                              {approver.name}
                            </span>
                            <span className="text-xs text-slate-500">
                              {approver.grade && <span className="mr-2">Grade: {approver.grade}</span>}
                              {approver.employee_id && <span>ID: {approver.employee_id}</span>}
                            </span>
                          </div>
                          {approver.is_temp_authorized && (
                            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                              This user is temporary approver.
                            </span>
                          )}
                        </div>
                      </ComboboxOption>
                    ))
                  )}
                </ComboboxOptions>
              </div>
            </Combobox>

            {/* Selected approver chip */}
            {selectedApproverObj && (
              <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
                <UserCheck className="w-4 h-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {selectedApproverObj.name}
                    {selectedApproverObj.grade && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({selectedApproverObj.grade})
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {selectedApproverObj.email}
                  </p>
                </div>
                {selectedApproverObj.is_temp_authorized && (
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium shrink-0">
                    This user is temporary approver.
                  </span>
                )}
                <button
                  onClick={() => {
                    setSelectedApproverObj(null);
                    setApproverQuery("");
                    onApproverSelected(null);
                  }}
                  className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {!selectedApproverId && (
              <p className="text-xs text-destructive">
                Please select an approver to proceed.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Self Meal Preferences */}
      {(travelFor === "self" || travelFor === "self_guest") &&
        SHOW_SELF_MEAL_PREF && (
          <div className="bg-card border border-border rounded-lg p-6 space-y-4">
            <Label className="text-base font-semibold flex items-center gap-2">
              <Utensils className="h-4 w-4" /> Your Meal Preferences
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Flight */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Plane className="h-4 w-4 text-sky-500" /> Flight Meal
                </Label>
                <Select
                  value={
                    selfPreferences?.flight_meal_preference?.toString() ||
                    "no_pref"
                  }
                  onValueChange={(v) =>
                    setSelfPreferences({
                      ...selfPreferences,
                      flight_meal_preference:
                        v === "no_pref" ? undefined : Number(v),
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Preference" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no_pref">No Preference</SelectItem>
                    {(mealPreferences || [])
                      .filter((p) => p.allowed_modes.includes(0)) // 0 = Flight (assumed, or use name)
                      .map((p) => (
                        <SelectItem key={p.id} value={p.id.toString()}>
                          {p.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Accommodation */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Building className="h-4 w-4 text-orange-500" /> Accommodation
                  Meal
                </Label>
                <Select
                  value={
                    selfPreferences.accommodation_meal_preference?.toString() ||
                    "no_pref"
                  }
                  onValueChange={(v) =>
                    setSelfPreferences({
                      ...selfPreferences,
                      accommodation_meal_preference:
                        v === "no_pref" ? undefined : Number(v),
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Preference" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no_pref">No Preference</SelectItem>
                    {(mealPreferences || [])
                      .filter((p) => p.allowed_modes.includes(1)) // 1 = Accommodation (assumed)
                      .map((p) => (
                        <SelectItem key={p.id} value={p.id.toString()}>
                          {p.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

      {/* Guest Selection UI */}
      {(travelFor === "guest" || travelFor === "self_guest") && (
        <div className="bg-card border border-border rounded-lg p-6 space-y-6">
          {/* Guest Search (Combobox) */}
          <div className="space-y-2 relative">
            <div className="flex items-center justify-between">
              <Label>Search and add guest(s)</Label>
              {/* Stats Bar */}
              <div className="flex items-center gap-5">
                <div className="text-sm font-medium">
                  Guest(s) count:{" "}
                  <span className="text-blue-700 font-bold">{guestCount}</span>
                </div>
                <div className="text-sm font-medium">
                  Total person:{" "}
                  <span className="text-blue-700 font-bold">{totalPerson}</span>
                </div>
              </div>
            </div>
            <Combobox
              onChange={(guest: GuestProfile) => {
                if (guest) handleAddGuest(guest);
              }}
            >
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <ComboboxInput
                    className={cn(
                      "w-full pl-10 pr-3 py-2.5 rounded-lg border bg-card text-card-foreground transition-all duration-200",
                      "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary",
                      "placeholder:text-muted-foreground",
                      "border-input hover:border-primary/50",
                    )}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    displayValue={() => ""}
                    placeholder="Search guest by name / email / contact..."
                  />
                </div>
                <ComboboxOptions className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-popover border border-border shadow-lg">
                  {searchResults.length === 0 &&
                  searchQuery.length > 1 &&
                  !isSearching ? (
                    <div className="px-4 py-3 text-sm text-muted-foreground">
                      No guests found.
                      <button
                        className="text-primary hover:underline ml-1 font-medium"
                        onClick={() => setShowCreateForm(true)}
                      >
                        Create new guest profile
                      </button>
                    </div>
                  ) : searchResults.length > 0 ? (
                    searchResults.map((guest) => (
                      <ComboboxOption
                        key={guest.id}
                        value={guest}
                        className={({ active }) =>
                          cn(
                            "relative cursor-pointer select-none px-4 py-3 transition-colors",
                            active ? "bg-primary/10" : "text-foreground",
                          )
                        }
                      >
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-800">
                            {guest.first_name} {guest.last_name}
                          </span>
                          <span className="text-xs text-slate-800">
                            Email:{" "}
                            <span className="font-medium">
                              {guest.email || "Not available"}
                            </span>
                            , Contact:{" "}
                            <span className="font-medium">
                              {guest.contact_number || "Not available"}
                            </span>
                          </span>
                        </div>
                      </ComboboxOption>
                    ))
                  ) : null}
                  {isSearching && (
                    <div className="px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Searching...
                    </div>
                  )}
                </ComboboxOptions>
              </div>
            </Combobox>
          </div>

          {/* Inline Create Form */}
          {showCreateForm && (
            <CreateGuestForm
              onCancel={() => setShowCreateForm(false)}
              onSuccess={(guest) => {
                handleAddGuest(guest);
                setShowCreateForm(false);
                toast.success("Guest profile created & added successfully.");
              }}
            />
          )}

          {/* Guest Table */}
          {selectedGuests.length > 0 && (
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40">
                <table className="w-full text-sm relative">
                  <thead className="bg-muted/50 border-b border-border sticky top-0 z-10">
                    <tr>
                      <th className="h-10 px-4 text-left font-medium text-slate-800 bg-muted/50">
                        Name as per aadhar card
                      </th>
                      <th className="h-10 px-4 text-left font-medium text-slate-800 bg-muted/50">
                        Gender
                      </th>
                      <th className="h-10 px-4 text-left font-medium text-slate-800 bg-muted/50">
                        Age
                      </th>
                      <th className="h-10 px-4 text-left font-medium text-slate-800 bg-muted/50">
                        Nationality
                      </th>
                      <th className="h-10 px-4 text-left font-medium text-slate-800 bg-muted/50">
                        Email
                      </th>
                      <th className="h-10 px-4 text-left font-medium text-slate-800 bg-muted/50">
                        Contact
                      </th>
                      <th className="h-10 px-4 text-center font-medium text-slate-800 bg-muted/50 w-[100px]">
                        Meal Preferences
                      </th>
                      <th className="h-10 px-4 text-left font-medium text-slate-800 w-[50px] bg-muted/50">
                        Remove
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedGuests.map((guest) => (
                      <tr
                        key={guest.id}
                        className="border-b border-border last:border-0 hover:bg-muted/20"
                      >
                        <td className="p-4">
                          {guest.first_name} {guest.last_name}
                        </td>
                        <td className="p-4">
                          {guest.gender === "M"
                            ? "Male"
                            : guest.gender === "F"
                              ? "Female"
                              : "Other"}
                        </td>
                        <td className="p-4">{guest.age}</td>
                        <td className="p-4">
                          {guest.nationality_type === "indian"
                            ? "Indian"
                            : "Foreign"}
                        </td>
                        <td className="p-4">{guest.email}</td>
                        <td className="p-4">{guest.contact_number}</td>
                        {/* Meal Prefs */}
                        <td className="p-4 text-center flex items-center gap-3">
                          <MealPrefPopover
                            type="ticketing"
                            currentValue={guest.flight_meal_preference}
                            options={mealPreferences}
                            onChange={(val) => {
                              const updated = selectedGuests.map((g) =>
                                g.id === guest.id
                                  ? { ...g, flight_meal_preference: val }
                                  : g,
                              );
                              setSelectedGuests(updated);
                            }}
                          />
                          <MealPrefPopover
                            type="accommodation"
                            currentValue={guest.accommodation_meal_preference}
                            options={mealPreferences}
                            onChange={(val) => {
                              const updated = selectedGuests.map((g) =>
                                g.id === guest.id
                                  ? { ...g, accommodation_meal_preference: val }
                                  : g,
                              );
                              setSelectedGuests(updated);
                            }}
                          />
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() =>
                              guest.id && handleRemoveGuest(guest.id)
                            }
                            className="text-destructive hover:bg-destructive/10 p-1.5 rounded-md transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Add One More Guest Link - only if table has items/not searching */}
          {!showCreateForm && (
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  // Focus on search input or just imply user should search
                  const input = document.querySelector(
                    'input[placeholder^="Search guest"]',
                  ) as HTMLInputElement;
                  if (input) input.focus();
                  setSearchQuery("");
                }}
                className="text-primary hover:underline text-sm font-medium inline-flex items-center"
              >
                <Plus className="h-3 w-3 mr-1" /> Add one more guest
              </button>

              <div className="h-4 w-px bg-border"></div>

            </div>
          )}
        </div>
      )}
    </div>
  );
};

const MealPrefPopover = ({
  type,
  currentValue,
  options,
  onChange,
}: {
  type: "ticketing" | "accommodation";
  currentValue?: number;
  options: MealPreference[];
  onChange: (val?: number) => void;
}) => {
  const [open, setOpen] = useState(false);
  const modeId = type === "ticketing" ? 0 : 1;
  const filteredOptions = options.filter((o) =>
    o.allowed_modes.includes(modeId),
  );

  const selectedOption = options.find((o) => o.id === currentValue);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 w-8 p-0 rounded-full",
            currentValue
              ? type === "ticketing"
                ? "bg-sky-100 text-sky-700 hover:bg-sky-200 hover:text-sky-700"
                : "bg-orange-100 text-orange-700 hover:bg-orange-200 hover:text-orange-700"
              : "text-muted-foreground hover:bg-muted hover:text-blue-500",
          )}
        >
          {type === "ticketing" ? (
            <Plane className="h-4 w-4" />
          ) : (
            <Building className="h-4 w-4" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2" align="center">
        <div className="space-y-1">
          <div className="font-medium text-xs px-2 py-1 mb-1 text-blue-500 border-b uppercase tracking-wider">
            {type === "ticketing"
              ? "Ticketing Meal Preference"
              : "Accommodation Meal Preference"}
          </div>
          <div
            className={cn(
              "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
              !currentValue && "bg-accent/50",
            )}
            onClick={() => {
              onChange(undefined);
              setOpen(false);
            }}
          >
            <span className="flex-1">No Preference</span>
            {!currentValue && <Check className="h-4 w-4 ml-2" />}
          </div>
          {filteredOptions.map((option) => (
            <div
              key={option.id}
              className={cn(
                "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                currentValue === option.id && "bg-accent/50",
              )}
              onClick={() => {
                onChange(option.id);
                setOpen(false);
              }}
            >
              <span className="flex-1">{option.name}</span>
              {currentValue === option.id && <Check className="h-4 w-4 ml-2" />}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

function CreateGuestForm({
  onCancel,
  onSuccess,
}: {
  onCancel: () => void;
  onSuccess: (guest: GuestProfile) => void;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<GuestProfile>>({
    first_name: "",
    last_name: "",
    gender: "M",
    nationality_type: "indian",
    email: "",
    contact_number: "",
    age: undefined,
  });

  const isFormValid = formData.first_name && formData.gender && formData.age;

  const handleSubmit = async () => {
    if (!isFormValid) return;
    setIsLoading(true);
    try {
      const newGuest = await guestProfileAPI.create(formData as GuestProfile);
      onSuccess(newGuest);
    } catch (error) {
      toast.error("Failed to create guest profile.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-muted/30 border border-border border-dashed rounded-lg p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
      <h3 className="font-semibold text-sm">Create New Guest</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label className="text-xs">
            First Name & Middle Name <span className="text-destructive">*</span>
          </Label>
          <Input
            value={formData.first_name}
            onChange={(e) =>
              setFormData({ ...formData, first_name: e.target.value })
            }
            className="h-9"
            placeholder="Name as per aadhar card"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Last Name</Label>
          <Input
            value={formData.last_name}
            onChange={(e) =>
              setFormData({ ...formData, last_name: e.target.value })
            }
            className="h-9"
            placeholder="Enter last name"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Email</Label>
          <Input
            type="email"
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
            className="h-9"
            placeholder="Enter email address"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Contact</Label>
          <Input
            type="tel"
            maxLength={10}
            value={formData.contact_number}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, ""); // Only allow digits
              setFormData({ ...formData, contact_number: value });
            }}
            className="h-9"
            placeholder="10-digit mobile number"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs">
            Gender <span className="text-destructive">*</span>
          </Label>
          <Select
            value={formData.gender}
            onValueChange={(v: any) => setFormData({ ...formData, gender: v })}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="M">Male</SelectItem>
              <SelectItem value="F">Female</SelectItem>
              <SelectItem value="O">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">
            Age <span className="text-destructive">*</span>
          </Label>
          <Input
            type="number"
            value={formData.age || ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                age: parseInt(e.target.value) || undefined,
              })
            }
            className="h-9"
            placeholder="Enter age"
          />
        </div>

        {/* Nationality Selection */}
        <div className="space-y-2">
          <Label className="text-xs">
            Nationality <span className="text-destructive">*</span>
          </Label>
          <RadioGroup
            value={formData.nationality_type}
            onValueChange={(v: "indian" | "foreign") =>
              setFormData({ ...formData, nationality_type: v })
            }
            className="flex items-center space-x-4 h-9"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="indian" id="nat-indian" />
              <Label
                htmlFor="nat-indian"
                className="text-xs font-normal cursor-pointer"
              >
                Indian
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="foreign" id="nat-foreign" />
              <Label
                htmlFor="nat-foreign"
                className="text-xs font-normal cursor-pointer"
              >
                Foreign
              </Label>
            </div>
          </RadioGroup>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!isFormValid || isLoading}
          >
            {isLoading && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
            Save & Add Guest
          </Button>
        </div>
      </div>
    </div>
  );
}
