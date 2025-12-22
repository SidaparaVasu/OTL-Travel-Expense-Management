import React from "react";
import { cn } from "@/lib/utils";

interface FormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  maxLength?: number;
}

export const FormTextarea = React.forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  ({ label, required, error, hint, maxLength = 200, className, ...props }, ref) => {
    const currentLength = (props.value as string)?.length || 0;
    
    return (
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-foreground">
          {label} {required && <span className="text-destructive">*</span>}
        </label>
        <textarea
          ref={ref}
          {...props}
          maxLength={maxLength}
          className={cn(
            "w-full px-3 py-2.5 rounded-lg border bg-card text-card-foreground transition-all duration-200 resize-none",
            "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary",
            "placeholder:text-muted-foreground",
            error
              ? "border-destructive focus:ring-destructive/50 focus:border-destructive"
              : "border-input hover:border-primary/50",
            props.disabled && "opacity-50 cursor-not-allowed bg-muted",
            className
          )}
          rows={props.rows || 3}
        />
        <div className="flex justify-between">
          {error ? (
            <p className="text-sm text-destructive font-medium animate-fade-in">{error}</p>
          ) : hint ? (
            <p className="text-sm text-muted-foreground">{hint}</p>
          ) : (
            <span />
          )}
          <span className={cn(
            "text-xs",
            currentLength >= maxLength ? "text-destructive" : "text-muted-foreground"
          )}>
            {currentLength}/{maxLength}
          </span>
        </div>
      </div>
    );
  }
);

FormTextarea.displayName = "FormTextarea";