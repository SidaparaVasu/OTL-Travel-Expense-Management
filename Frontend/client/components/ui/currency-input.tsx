import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface CurrencyInputProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "type" | "onChange"
  > {
  onValueChange?: (value: number | null) => void;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  maxLength?: number;
}

/**
 * CurrencyInput Component
 *
 * A specialized input component for currency/amount fields that:
 * - Prevents alphabets (e, E, +, -, etc.)
 * - Prevents negative numbers
 * - Allows only positive numbers with up to 2 decimal places
 * - Works consistently across all browsers
 *
 * @example
 * <CurrencyInput
 *   value={amount}
 *   onValueChange={(value) => setAmount(value)}
 *   placeholder="Enter amount"
 * />
 */
export const CurrencyInput = React.forwardRef<
  HTMLInputElement,
  CurrencyInputProps
>(({ className, onValueChange, onChange, ...props }, ref) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Prevent: e, E (scientific notation), +, - (signs)
    if (["e", "E", "+", "-"].includes(e.key)) {
      e.preventDefault();
    }
  };

  const handleInput = (e: React.FormEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;
    let value = target.value;

    // Remove any non-numeric characters except decimal point
    value = value.replace(/[^0-9.]/g, "");

    // Ensure only one decimal point
    const parts = value.split(".");
    if (parts.length > 2) {
      value = parts[0] + "." + parts.slice(1).join("");
    }

    // Limit to 2 decimal places
    if (parts[1] && parts[1].length > 2) {
      value = parts[0] + "." + parts[1].substring(0, 2);
    }

    // Handle maxLength if provided
    if (props.maxLength && value.length > props.maxLength) {
      value = value.slice(0, props.maxLength);
    }

    target.value = value;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    // Parse the numeric value
    const numValue = value === "" ? null : parseFloat(value);

    // Prevent negative numbers
    if (numValue !== null && (numValue < 0 || isNaN(numValue))) {
      e.target.value = "";
      onValueChange?.(null);
      return;
    }

    // Call the onValueChange callback with parsed number
    onValueChange?.(numValue);

    // Call the original onChange if provided
    onChange?.(e);
  };

  return (
    <Input
      {...props}
      ref={ref}
      type="number"
      min="0"
      step="1"
      max={props.max}
      className={cn(className)}
      onKeyDown={handleKeyDown}
      onInput={handleInput}
      onChange={handleChange}
    />
  );
});

CurrencyInput.displayName = "CurrencyInput";
