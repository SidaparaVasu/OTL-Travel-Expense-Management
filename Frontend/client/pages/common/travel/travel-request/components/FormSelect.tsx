import React from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

interface Option {
  value: string;
  label: string;
}

interface FormSelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange"> {
  label: string;
  required?: boolean;
  options: Option[];
  error?: string;
  hint?: string;
  onChange?: (value: string) => void;
}

export const FormSelect = React.forwardRef<HTMLSelectElement, FormSelectProps>(
  ({ label, required, options, error, hint, className, onChange, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-foreground">
          {label} {required && <span className="text-destructive">*</span>}
        </label>
        <div className="relative">
          <select
            ref={ref}
            {...props}
            onChange={(e) => onChange?.(e.target.value)}
            className={cn(
              "w-full px-3 py-2.5 rounded-lg border bg-card text-card-foreground transition-all duration-200 appearance-none cursor-pointer",
              "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary",
              error
                ? "border-destructive focus:ring-destructive/50 focus:border-destructive"
                : "border-input hover:border-primary/50",
              props.disabled && "opacity-50 cursor-not-allowed bg-muted",
              className
            )}
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        </div>
        {error && (
          <p className="text-sm text-destructive font-medium animate-fade-in">{error}</p>
        )}
        {hint && !error && (
          <p className="text-sm text-muted-foreground">{hint}</p>
        )}
      </div>
    );
  }
);

FormSelect.displayName = "FormSelect";