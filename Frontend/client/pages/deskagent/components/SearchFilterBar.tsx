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
  isReadonlyGlobal,
  onReadonlyGlobalChange,
  sortBy,
  onSortChange,
  statusFilter,
  onStatusFilterChange,
  bookingActionStatus,
  onBookingActionStatusChange,
  readStatus,
  onReadStatusChange,
  ioNumber,
  onIoNumberChange,
  glCode,
  onGlCodeChange,
  sanctionNumber,
  onSanctionNumberChange,
  locationFilter,
  onLocationFilterChange,
  locations,
}: any) => {
  const [isFiltersVisible, setIsFiltersVisible] = useState(true);

  const activeFilterCount = [
    locationFilter && locationFilter !== "all" ? 1 : 0,
    readStatus && readStatus !== "all" ? 1 : 0,
    ioNumber && ioNumber.trim() ? 1 : 0,
    glCode && glCode.trim() ? 1 : 0,
    sanctionNumber && sanctionNumber.trim() ? 1 : 0,
    sortBy !== "urgency" ? 1 : 0,
    isGlobalSearch ? 1 : 0,
    bookingActionStatus && bookingActionStatus !== "all" ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const handleClearFilters = useCallback(() => {
    onSearchChange("");
    onSortChange("urgency");
    if (onGlobalSearchChange) onGlobalSearchChange(false);
    if (onReadonlyGlobalChange) onReadonlyGlobalChange(false);
    if (onBookingActionStatusChange) onBookingActionStatusChange("pending");
    if (onLocationFilterChange) onLocationFilterChange("all");
    if (onReadStatusChange) onReadStatusChange("all");
    if (onIoNumberChange) onIoNumberChange("");
    if (onGlCodeChange) onGlCodeChange("");
    if (onSanctionNumberChange) onSanctionNumberChange("");
  }, [
    onSearchChange,
    onSortChange,
    onGlobalSearchChange,
    onReadonlyGlobalChange,
    onBookingActionStatusChange,
    onLocationFilterChange,
    onReadStatusChange,
    onIoNumberChange,
    onGlCodeChange,
    onSanctionNumberChange,
  ]);

  return (
    <div className="bg-card rounded-b-lg border overflow-hidden mb-6">
      {/* Search row */}
      <div className="p-4 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by ID, employee name, IO number, GL code..."
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

        {/* Readonly Global Search Toggle */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border rounded-md h-10 border-amber-200">
          <input
            type="checkbox"
            id="readonly-global-toggle"
            checked={!!isReadonlyGlobal}
            onChange={(e) => onReadonlyGlobalChange(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
          />
          <label
            htmlFor="readonly-global-toggle"
            className="text-sm font-medium text-amber-800 cursor-pointer select-none whitespace-nowrap"
          >
            Search any TR (read-only)
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
        <div className="border-t px-4 py-3 bg-white flex flex-col gap-3">
          {/* Main Select Filters */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider shrink-0">
              FILTER BY:
            </span>

            <div className="flex flex-wrap items-center gap-2.5 flex-1 w-full sm:w-auto">
              {/* Sort By */}
              <Select value={sortBy} onValueChange={onSortChange}>
                <SelectTrigger className="w-full sm:w-[155px] h-9 text-xs bg-background">
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

              {/* Booking Action Status */}
              {onBookingActionStatusChange && (
                <Select
                  value={bookingActionStatus || "all"}
                  onValueChange={onBookingActionStatusChange}
                >
                  <SelectTrigger className="w-full sm:w-[145px] h-9 text-xs bg-background">
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

              {/* Read / Unread Status Filter (Requirement 2) */}
              {onReadStatusChange && (
                <Select
                  value={readStatus || "all"}
                  onValueChange={onReadStatusChange}
                >
                  <SelectTrigger className="w-full sm:w-[140px] h-9 text-xs bg-background">
                    <SelectValue placeholder="Read / Unread" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All (Read/Unread)</SelectItem>
                    <SelectItem value="unread">Unread Only</SelectItem>
                    <SelectItem value="read">Read Only</SelectItem>
                  </SelectContent>
                </Select>
              )}

              {/* Assigned Unit Location Filter (Requirement 1) */}
              {onLocationFilterChange && locations && (
                <Select
                  value={locationFilter || "all"}
                  onValueChange={onLocationFilterChange}
                >
                  <SelectTrigger className="w-full sm:w-[170px] h-9 text-xs bg-background">
                    <SelectValue placeholder="Unit Location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Unit Locations</SelectItem>
                    {locations.map((loc: any) => {
                      const val = typeof loc === "string" ? loc : loc.name;
                      const key = typeof loc === "string" ? loc : (loc.id || loc.name);
                      return (
                        <SelectItem key={key} value={val}>
                          {val}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="h-9 text-xs bg-white text-slate-700 border border-slate-200 rounded-md hover:bg-slate-50 hover:text-black gap-1 shrink-0 ml-auto"
            >
              <X className="h-3 w-3" />
              Clear all
            </Button>
          </div>

          {/* Secondary Specific Filters: IO Number, GL Code, Sanction Number (Requirement 1) */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider shrink-0 sm:min-w-[70px]">
              SPECIFIC:
            </span>

            {/* IO Number Filter */}
            <div className="relative flex-1 min-w-[140px] max-w-[200px]">
              <Input
                placeholder="Filter IO Number..."
                value={ioNumber || ""}
                onChange={(e) => onIoNumberChange?.(e.target.value)}
                className="h-8 text-xs pr-6 bg-slate-50 border-slate-200 focus:bg-white"
              />
              {ioNumber && (
                <button
                  onClick={() => onIoNumberChange?.("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* GL Code Filter */}
            <div className="relative flex-1 min-w-[140px] max-w-[200px]">
              <Input
                placeholder="Filter GL Code..."
                value={glCode || ""}
                onChange={(e) => onGlCodeChange?.(e.target.value)}
                className="h-8 text-xs pr-6 bg-slate-50 border-slate-200 focus:bg-white"
              />
              {glCode && (
                <button
                  onClick={() => onGlCodeChange?.("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Sanction Number Filter */}
            <div className="relative flex-1 min-w-[150px] max-w-[220px]">
              <Input
                placeholder="Filter Sanction No..."
                value={sanctionNumber || ""}
                onChange={(e) => onSanctionNumberChange?.(e.target.value)}
                className="h-8 text-xs pr-6 bg-slate-50 border-slate-200 focus:bg-white"
              />
              {sanctionNumber && (
                <button
                  onClick={() => onSanctionNumberChange?.("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
