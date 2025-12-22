import React from "react";
import { cn } from "@/lib/utils";
import { AlertCircle } from "lucide-react";

interface NotRequiredToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  section: "ticketing" | "accommodation" | "conveyance";
}

const sectionMessages = {
  ticketing: "I hereby declare that I do not need any ticketing (Flight/Train) for this travel.",
  accommodation: "I hereby declare that I do not need any accommodation for this travel.",
  conveyance: "I hereby declare that I do not need any local conveyance for this travel.",
};

export const NotRequiredToggle: React.FC<NotRequiredToggleProps> = ({
  checked,
  onChange,
  section,
}) => {
  return (
    <div
      className={cn(
        "p-4 rounded-lg border-2 transition-all duration-200",
        checked
          ? "bg-primary/5 border-primary"
          : "bg-muted/30 border-muted hover:border-primary/30"
      )}
    >
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-input text-primary focus:ring-primary/50"
        />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <AlertCircle className={cn(
              "h-4 w-4",
              checked ? "text-primary" : "text-muted-foreground"
            )} />
            <span className={cn(
              "text-sm font-medium",
              checked ? "text-primary" : "text-foreground"
            )}>
              Not Required
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {sectionMessages[section]}
          </p>
        </div>
      </label>
    </div>
  );
};