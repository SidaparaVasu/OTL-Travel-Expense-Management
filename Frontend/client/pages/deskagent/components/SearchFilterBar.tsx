import React from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export const SearchFilterBar = ({
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  statusFilter,
  onStatusFilterChange,
}) => {
  return (
    <div className="bg-white rounded-md border shadow-[0_2px_2px_0_rgba(59,130,247,0.30)] p-6">
      <div className="flex flex-col lg:flex-row gap-4">

        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by ID or employee name..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <Select value={sortBy} onValueChange={onSortChange}>
            <SelectTrigger className="w-full sm:w-[170px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="urgency">Urgency First</SelectItem>
              <SelectItem value="date_asc">Departure: Earliest</SelectItem>
              <SelectItem value="date_desc">Departure: Latest</SelectItem>
              <SelectItem value="submitted_asc">Submitted: Oldest</SelectItem>
              <SelectItem value="submitted_desc">Submitted: Newest</SelectItem>
            </SelectContent>
          </Select>

          {onStatusFilterChange && (
            <Select
              value={statusFilter || 'pending_travel_desk'}
              onValueChange={onStatusFilterChange}
            >
              <SelectTrigger className="w-full sm:w-[170px]">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                {/* <SelectItem value="all">All Status</SelectItem> */}
                <SelectItem value="pending_travel_desk">Pending</SelectItem>
                <SelectItem value="booking_in_progress">In Progress</SelectItem>
                <SelectItem value="booked">Booked</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

      </div>
    </div>
  );
};
