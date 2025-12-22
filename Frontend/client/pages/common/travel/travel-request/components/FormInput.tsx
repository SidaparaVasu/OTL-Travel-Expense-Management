import React from "react";
import { cn } from "@/lib/utils";

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
}

export const FormInput = React.forwardRef<HTMLInputElement, FormInputProps>(
  ({ label, required, error, hint, className, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-foreground">
          {label} {required && <span className="text-destructive">*</span>}
        </label>
        <input
          ref={ref}
          {...props}
          className={cn(
            "w-full px-3 py-2.5 rounded-lg border bg-card text-card-foreground transition-all duration-200",
            "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary",
            "placeholder:text-muted-foreground",
            error
              ? "border-destructive focus:ring-destructive/50 focus:border-destructive animate-shake"
              : "border-input hover:border-primary/50",
            props.disabled && "opacity-50 cursor-not-allowed bg-muted",
            className
          )}
        />
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

FormInput.displayName = "FormInput";