import * as React from "react";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs, { Dayjs } from "dayjs";
import { cn } from "@/lib/utils";

interface DatePickerFieldProps {
  label?: string;
  value?: string; // Expects YYYY-MM-DD
  onChange: (value: string) => void; // Returns YYYY-MM-DD
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  min?: string; // Expects YYYY-MM-DD
  max?: string; // Expects YYYY-MM-DD
  error?: string;
  className?: string;
}

/**
 * DatePickerField Component
 *
 * A consistent date picker using Material UI (MUI) for a premium look and feel.
 * Ensures dd/MM/yyyy format and works across all browsers.
 */
export const DatePickerField: React.FC<DatePickerFieldProps> = ({
  label,
  value,
  onChange,
  required = false,
  disabled = false,
  min,
  max,
  error,
  className,
}) => {
  // Convert string value (YYYY-MM-DD) to dayjs object
  const dateValue = value ? dayjs(value) : null;

  // Convert min/max strings to dayjs objects
  const minDate = min ? dayjs(min) : undefined;
  const maxDate = max ? dayjs(max) : undefined;

  // Handle date selection
  const handleDateChange = (date: Dayjs | null) => {
    if (date && date.isValid()) {
      // Format to YYYY-MM-DD for backend consistency
      onChange(date.format("YYYY-MM-DD"));
    } else {
      onChange("");
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <label className="text-sm font-medium">
          {label} {required && <span className="text-destructive">*</span>}
        </label>
      )}
      <DatePicker
        value={dateValue}
        onChange={handleDateChange}
        disabled={disabled}
        minDate={minDate}
        maxDate={maxDate}
        format="DD/MM/YYYY"
        slotProps={{
          textField: {
            fullWidth: true,
            error: !!error,
            size: "small", // Using small for better alignment in grid layouts
            sx: {
              "& .MuiOutlinedInput-root": {
                height: "40px",
                borderRadius: "calc(var(--radius) - 2px)", // Matching shadcn radius
                fontSize: "14px",
                "& fieldset": {
                  borderColor: error
                    ? "rgb(239, 68, 68)"
                    : "rgb(226, 232, 240)",
                },
                "&:hover fieldset": {
                  borderColor: error
                    ? "rgb(220, 38, 38)"
                    : "rgb(203, 213, 225)",
                },
                "&.Mui-focused fieldset": {
                  borderColor: "var(--primary)",
                  borderWidth: "1px",
                },
              },
              "& .MuiInputBase-input": {
                padding: "8px 12px",
              },
            },
          },
          popper: {
            sx: {
              "& .MuiPaper-root": {
                borderRadius: "8px",
                boxShadow:
                  "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
                border: "1px solid rgb(226, 232, 240)",
                marginTop: "4px",
              },
            },
          },
        }}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
};
