import React from 'react';
import { cn } from '@/lib/utils';

interface StatusFilterProps {
  value: string;
  onChange: (value: string) => void;
}

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'requested', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'confirmed', label: 'Confirmed / Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const StatusFilter: React.FC<StatusFilterProps> = ({ value, onChange }) => {
  return (
    <div className="flex flex-wrap gap-2">
      {STATUS_OPTIONS.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "px-4 py-2 rounded-full text-sm font-medium transition-all",
            value === option.value
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted hover:bg-muted/80 text-muted-foreground"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};
