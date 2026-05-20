import React, { useState, useCallback } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const SearchFilterBar = ({
  searchQuery,
  onSearchChange,
  isGlobalSearch,
  onGlobalSearchChange,
  sortBy,
  onSortChange,
  statusFilter,
  onStatusFilterChange,
  bookingActionStatus,
  onBookingActionStatusChange,
  locationFilter,
  onLocationFilterChange,
  locations,
}: any) => {
  const [isFiltersVisible, setIsFiltersVisible] = useState(true);

  const activeFilterCount = [
    // statusFilter && statusFilter !== "all" ? 1 : 0,
    locationFilter && locationFilter !== "all" ? 1 : 0,
    sortBy !== "urgency" ? 1 : 0,
    isGlobalSearch ? 1 : 0,
    bookingActionStatus && bookingActionStatus !== "all" ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const handleClearFilters = useCallback(() => {
    onSearchChange("");
    onSortChange("urgency");
    if (onGlobalSearchChange) onGlobalSearchChange(false);
    // if (onStatusFilterChange) onStatusFilterChange("pending_travel_desk");
    if (onBookingActionStatusChange) onBookingActionStatusChange("pending");
    if (onLocationFilterChange) onLocationFilterChange("all");
  }, [
    onSearchChange,
    onSortChange,
    onGlobalSearchChange,
    onStatusFilterChange,
    onBookingActionStatusChange,
    onLocationFilterChange,
  ]);

  return (
    <div className="bg-card rounded-b-lg border overflow-hidden mb-6">
      {/* Search row */}
      <div className="p-4 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by ID or employee name..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 h-10 bg-white border border-gray-300 focus-visible:border-input focus-visible:bg-card"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Global Search Toggle */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border rounded-md h-10 border-slate-200">
          <input
            type="checkbox"
            id="global-search-toggle"
            checked={isGlobalSearch}
            onChange={(e) => onGlobalSearchChange(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
          />
          <label
            htmlFor="global-search-toggle"
            className="text-sm font-medium text-slate-700 cursor-pointer select-none whitespace-nowrap"
          >
            Search All Statuses
          </label>
        </div>

        <Button
          variant={isFiltersVisible ? "default" : "outline"}
          size="sm"
          onClick={() => setIsFiltersVisible(!isFiltersVisible)}
          className="h-10 gap-2 px-4 shrink-0"
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span className="hidden sm:inline">Filters</span>
          {activeFilterCount > 0 && (
            <Badge
              variant="secondary"
              className={cn(
                "h-5 min-w-5 px-1.5 text-xs font-semibold rounded-full",
                isFiltersVisible
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-primary/10 text-primary",
              )}
            >
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </div>

      {/* Filter row */}
      {isFiltersVisible && (
        <div className="border-t px-4 py-3 bg-white flex flex-col sm:flex-row items-center gap-4">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider shrink-0">
            FILTER BY:
          </span>

          <div className="flex flex-wrap items-center gap-3 flex-1">
            <Select value={sortBy} onValueChange={onSortChange}>
              <SelectTrigger className="w-full sm:w-[160px] h-9 text-sm bg-background">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="urgency">Urgency First</SelectItem>
                <SelectItem value="date_asc">Departure: Earliest</SelectItem>
                <SelectItem value="date_desc">Departure: Latest</SelectItem>
                <SelectItem value="submitted_asc">Submitted: Oldest</SelectItem>
                <SelectItem value="submitted_desc">
                  Submitted: Newest
                </SelectItem>
              </SelectContent>
            </Select>

            {/* {onStatusFilterChange && (
              <Select
                value={statusFilter || "pending_travel_desk"}
                onValueChange={onStatusFilterChange}
              >
                <SelectTrigger className="w-full sm:w-[180px] h-9 text-sm bg-background">
                  <SelectValue placeholder="TR Lifecycle Stage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any Lifecycle Stage</SelectItem>
                  <SelectItem value="pending_travel_desk">Pending</SelectItem>
                  <SelectItem value="booking_in_progress">
                    In Progress
                  </SelectItem>
                  <SelectItem value="booked">Booked</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            )} */}

            {onBookingActionStatusChange && (
              <Select
                value={bookingActionStatus || "all"}
                onValueChange={onBookingActionStatusChange}
              >
                <SelectTrigger className="w-full sm:w-[150px] h-9 text-sm bg-background">
                  <SelectValue placeholder="Booking Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="requested">Requested</SelectItem>
                  <SelectItem value="in_progress">In-Progress</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            )}

            {onLocationFilterChange && locations && (
              <Select
                value={locationFilter || "all"}
                onValueChange={onLocationFilterChange}
              >
                <SelectTrigger className="w-full sm:w-[160px] h-9 text-sm bg-background">
                  <SelectValue placeholder="Location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {locations.map((loc: string) => (
                    <SelectItem key={loc} value={loc}>
                      {loc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="h-9 text-xs bg-white text-black border border-slate-200 rounded-md hover:bg-slate-50 hover:text-black gap-1 shrink-0 ml-auto"
          >
            <X className="h-3 w-3" />
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
};
