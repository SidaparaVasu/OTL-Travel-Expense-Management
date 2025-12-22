import React, { useState } from "react";
import { Home, X, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ARCHotelSelectorProps {
  selectedPreferences: number[];
  setSelectedPreferences: (preferences: number[]) => void;
  arcHotels: any[];
  error?: string;
}

export const ARCHotelSelector: React.FC<ARCHotelSelectorProps> = ({
  selectedPreferences,
  setSelectedPreferences,
  arcHotels,
  error,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tempPreferences, setTempPreferences] = useState<number[]>([...selectedPreferences]);

  const handleOpen = () => {
    setTempPreferences([...selectedPreferences]);
    setIsOpen(true);
  };

  const handleSelectPreference = (priority: number, arcHotelId: number | null) => {
    const newPrefs = [...tempPreferences];
    if (arcHotelId === null) {
      newPrefs.splice(priority - 1);
    } else {
      newPrefs[priority - 1] = arcHotelId;
    }
    setTempPreferences(newPrefs.filter(Boolean));
  };

  const handleSave = () => {
    if (tempPreferences.length === 0) {
      return;
    }
    setSelectedPreferences(tempPreferences);
    setIsOpen(false);
  };

  const handleCancel = () => {
    setTempPreferences([...selectedPreferences]);
    setIsOpen(false);
  };

  const getARCHotelName = (id: number) => {
    return arcHotels.find((g) => g.id === id)?.name || "Unknown";
  };

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground">
        ARC Hotel Preferences <span className="text-destructive">*</span>
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={handleOpen}
          className={cn(
            "flex items-center justify-between w-full px-3 py-2.5 border rounded-lg bg-card transition-all text-sm",
            "hover:border-primary/50",
            error
              ? "border-destructive"
              : selectedPreferences.length > 0
              ? "border-primary text-foreground"
              : "border-input text-muted-foreground"
          )}
        >
          <div className="flex items-center gap-2">
            <Home size={16} className="text-primary" />
            <span>
              {selectedPreferences.length > 0
                ? `${selectedPreferences.length} preference${selectedPreferences.length > 1 ? "s" : ""} selected`
                : "Select ARC hotel preferences"}
            </span>
          </div>
          {selectedPreferences.length > 0 && (
            <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-semibold rounded-full">
              {selectedPreferences.length}
            </span>
          )}
        </button>

        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={handleCancel}
            />
            <div className="absolute top-full right-0 mt-2 w-96 bg-popover border border-border rounded-lg shadow-xl z-50 animate-slide-up">
              <div className="p-4">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-foreground">ARC Hotel Preferences</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Select up to 3 preferences in order. First preference is mandatory.
                  </p>
                </div>

                <div className="space-y-3 mb-4">
                  {[1, 2, 3].map((priority) => {
                    const currentSelection = tempPreferences[priority - 1];
                    const isPreviousSelected = priority === 1 || tempPreferences[priority - 2] !== undefined;

                    return (
                      <div key={priority} className="space-y-2">
                        <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                          <span
                            className={cn(
                              "flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold",
                              currentSelection
                                ? "bg-primary text-primary-foreground"
                                : priority === 1
                                ? "bg-destructive/10 text-destructive border-2 border-destructive/30"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            {priority}
                          </span>
                          Preference {priority}
                          {priority === 1 && <span className="text-destructive">*</span>}
                        </label>

                        <select
                          value={currentSelection || ""}
                          onChange={(e) =>
                            handleSelectPreference(
                              priority,
                              e.target.value ? parseInt(e.target.value) : null
                            )
                          }
                          disabled={!isPreviousSelected}
                          className={cn(
                            "w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-all",
                            !isPreviousSelected
                              ? "bg-muted cursor-not-allowed border-border text-muted-foreground"
                              : currentSelection
                              ? "border-primary focus:ring-primary/50"
                              : priority === 1
                              ? "border-destructive/50 focus:ring-destructive/50"
                              : "border-input focus:ring-primary/50"
                          )}
                        >
                          <option value="">
                            {!isPreviousSelected
                              ? "Select previous preference first"
                              : priority === 1
                              ? "Select first preference (required)"
                              : "Select or skip"}
                          </option>
                          {arcHotels.filter(
                            (g) => !tempPreferences.includes(g.id) || currentSelection === g.id
                          ).map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>

                {tempPreferences.length > 0 && (
                  <div className="border-t border-border pt-3 mb-4">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Your Selections:</p>
                    <div className="space-y-1">
                      {tempPreferences.map((ghId, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 text-xs text-foreground bg-primary/5 px-2 py-1.5 rounded"
                        >
                          <CheckCircle2 size={14} className="text-primary" />
                          <span className="font-medium">{index + 1}.</span>
                          <span className="flex-1">{getARCHotelName(ghId)}</span>
                          <button
                            type="button"
                            onClick={() => handleSelectPreference(index + 1, null)}
                            className="text-destructive hover:text-destructive/80"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="flex-1 px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={tempPreferences.length === 0}
                    className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Save Preferences
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
      {error && <p className="text-sm text-destructive font-medium animate-fade-in">{error}</p>}
    </div>
  );
};