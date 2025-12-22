import React, { useState, useRef, useEffect } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface TimePickerFieldProps {
  label?: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
}

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
const MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

export const TimePickerField: React.FC<TimePickerFieldProps> = ({
  label,
  required,
  value,
  onChange,
  error,
  disabled,
  placeholder = "Select time",
}) => {
  const [open, setOpen] = useState(false);
  const [selectedHour, setSelectedHour] = useState("12");
  const [selectedMinute, setSelectedMinute] = useState("00");
  const [selectedPeriod, setSelectedPeriod] = useState<"AM" | "PM">("AM");

  const hourRef = useRef<HTMLDivElement>(null);
  const minuteRef = useRef<HTMLDivElement>(null);

  // Parse initial value
  useEffect(() => {
    if (value) {
      const [hours, minutes] = value.split(":");
      const hour24 = parseInt(hours, 10);
      const period = hour24 >= 12 ? "PM" : "AM";
      const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
      setSelectedHour(String(hour12).padStart(2, "0"));
      setSelectedMinute(minutes);
      setSelectedPeriod(period);
    }
  }, [value]);

  // Scroll to selected values when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        const hourBtn = hourRef.current?.querySelector(`[data-hour="${selectedHour}"]`);
        const minuteBtn = minuteRef.current?.querySelector(`[data-minute="${selectedMinute}"]`);
        hourBtn?.scrollIntoView({ block: "center", behavior: "instant" });
        minuteBtn?.scrollIntoView({ block: "center", behavior: "instant" });
      }, 50);
    }
  }, [open, selectedHour, selectedMinute]);

  const formatDisplay = () => {
    if (!value) return "";
    return `${selectedHour}:${selectedMinute} ${selectedPeriod}`;
  };

  const handleConfirm = () => {
    let hour24 = parseInt(selectedHour, 10);
    if (selectedPeriod === "PM" && hour24 !== 12) {
      hour24 += 12;
    } else if (selectedPeriod === "AM" && hour24 === 12) {
      hour24 = 0;
    }
    const timeValue = `${String(hour24).padStart(2, "0")}:${selectedMinute}`;
    onChange(timeValue);
    setOpen(false);
  };

  const handleCancel = () => {
    // Reset to original value
    if (value) {
      const [hours, minutes] = value.split(":");
      const hour24 = parseInt(hours, 10);
      const period = hour24 >= 12 ? "PM" : "AM";
      const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
      setSelectedHour(String(hour12).padStart(2, "0"));
      setSelectedMinute(minutes);
      setSelectedPeriod(period);
    }
    setOpen(false);
  };

  return (
    <div className="space-y-1.5">
      {label && (
        <label className="text-sm font-medium text-foreground">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </label>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm text-left transition-all",
              "bg-background hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary",
              error
                ? "border-destructive focus:ring-destructive/20 focus:border-destructive"
                : "border-input",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            <span className={cn(!value && "text-muted-foreground")}>
              {value ? formatDisplay() : placeholder}
            </span>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-auto p-0 pointer-events-auto" 
          align="start"
          sideOffset={4}
        >
          <div className="p-4 min-w-[180px]">
            {/* Display */}
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
              <span className="text-2xl font-semibold text-foreground">
                {selectedHour}:{selectedMinute} {selectedPeriod}
              </span>
              <Clock className="h-5 w-5 text-muted-foreground" />
            </div>

            {/* Pickers */}
            <div className="flex gap-2">
              {/* Hours */}
              <div 
                ref={hourRef}
                className="flex-1 w-[80px] h-48 overflow-y-auto scrollbar-hide border border-border rounded-lg"
              >
                {HOURS.map((hour) => (
                  <button
                    key={hour}
                    type="button"
                    data-hour={hour}
                    onClick={() => setSelectedHour(hour)}
                    className={cn(
                      "w-full py-2 text-sm text-center transition-colors",
                      selectedHour === hour
                        ? "bg-primary text-primary-foreground font-medium"
                        : "text-foreground hover:bg-muted"
                    )}
                  >
                    {hour}
                  </button>
                ))}
              </div>

              {/* Minutes */}
              <div 
                ref={minuteRef}
                className="flex-1 w-[80px] h-48 overflow-y-auto scrollbar-hide border border-border rounded-lg"
              >
                {MINUTES.map((minute) => (
                  <button
                    key={minute}
                    type="button"
                    data-minute={minute}
                    onClick={() => setSelectedMinute(minute)}
                    className={cn(
                      "w-full py-2 text-sm text-center transition-colors",
                      selectedMinute === minute
                        ? "bg-primary text-primary-foreground font-medium"
                        : "text-foreground hover:bg-muted"
                    )}
                  >
                    {minute}
                  </button>
                ))}
              </div>

              {/* AM/PM */}
              <div className="flex  w-[80px] flex-col gap-1 border border-border rounded-lg p-1">
                <button
                  type="button"
                  onClick={() => setSelectedPeriod("AM")}
                  className={cn(
                    "px-3 py-2 text-sm rounded-md transition-colors",
                    selectedPeriod === "AM"
                      ? "bg-primary text-primary-foreground font-medium"
                      : "text-foreground hover:bg-muted"
                  )}
                >
                  AM
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPeriod("PM")}
                  className={cn(
                    "px-3 py-2 text-sm rounded-md transition-colors",
                    selectedPeriod === "PM"
                      ? "bg-primary text-primary-foreground font-medium"
                      : "text-foreground hover:bg-muted"
                  )}
                >
                  PM
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-border">
              <Button 
                type="button" 
                variant="ghost" 
                size="sm" 
                onClick={handleCancel}
              >
                CANCEL
              </Button>
              <Button 
                type="button" 
                variant="ghost" 
                size="sm" 
                onClick={handleConfirm}
                className="text-primary hover:text-white"
              >
                OK
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
};