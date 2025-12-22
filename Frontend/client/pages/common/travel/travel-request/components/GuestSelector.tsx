import React, { useState, useRef, useEffect } from "react";
import { User, X, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface Guest {
  id?: number;
  employee_id?: string;
  full_name: string;
  department?: string;
  is_colleague: boolean;
}

// Mock colleagues data
const MOCK_COLLEAGUES: Guest[] = [
  { id: 101, employee_id: "EMP001", full_name: "Rahul Sharma", department: "Engineering", is_colleague: true },
  { id: 102, employee_id: "EMP002", full_name: "Priya Patel", department: "Finance", is_colleague: true },
  { id: 103, employee_id: "EMP003", full_name: "Amit Kumar", department: "HR", is_colleague: true },
  { id: 104, employee_id: "EMP004", full_name: "Sneha Gupta", department: "Marketing", is_colleague: true },
  { id: 105, employee_id: "EMP005", full_name: "Vijay Singh", department: "Operations", is_colleague: true },
];

interface GuestSelectorProps {
  selectedGuests: Guest[];
  setSelectedGuests: (guests: Guest[]) => void;
}

export const GuestSelector: React.FC<GuestSelectorProps> = ({
  selectedGuests,
  setSelectedGuests,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [suggestions, setSuggestions] = useState<Guest[]>([]);
  const [highlightIndex, setHighlightIndex] = useState(-1);

  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchInput.length >= 3) {
      const filtered = MOCK_COLLEAGUES.filter(
        (c) =>
          c.full_name.toLowerCase().includes(searchInput.toLowerCase()) &&
          !selectedGuests.some((g) => g.id === c.id)
      );
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  }, [searchInput, selectedGuests]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      inputRef.current?.focus();
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const addColleague = (colleague: Guest) => {
    setSelectedGuests([...selectedGuests, colleague]);
    setSearchInput("");
    setSuggestions([]);
    setHighlightIndex(-1);
  };

  const addCustomGuest = () => {
    const trimmedName = searchInput.trim();
    if (!trimmedName || selectedGuests.some((g) => g.full_name.toLowerCase() === trimmedName.toLowerCase())) {
      return;
    }
    setSelectedGuests([
      ...selectedGuests,
      { full_name: trimmedName, is_colleague: false },
    ]);
    setSearchInput("");
    setSuggestions([]);
    setHighlightIndex(-1);
  };

  const removeGuest = (index: number) => {
    setSelectedGuests(selectedGuests.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const totalOptions = suggestions.length + (searchInput.length >= 3 ? 1 : 0);

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightIndex((prev) => (prev + 1) % totalOptions);
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIndex((prev) => (prev <= 0 ? totalOptions - 1 : prev - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightIndex === -1) return;
        if (highlightIndex < suggestions.length) {
          addColleague(suggestions[highlightIndex]);
        } else {
          addCustomGuest();
        }
        break;
      case "Escape":
        setIsOpen(false);
        setHighlightIndex(-1);
        break;
    }
  };

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground">
        Guests (Optional)
      </label>
      <div className="relative" ref={popoverRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-4 py-2.5 w-full border border-input rounded-lg bg-card hover:border-primary/50 transition-all text-sm font-medium text-foreground"
        >
          <Users size={18} className="text-primary" />
          <span>Select Guests</span>
          {selectedGuests.length > 0 && (
            <span className="ml-1 px-2 py-0.5 bg-primary/10 text-primary text-xs font-semibold rounded-full">
              {selectedGuests.length}
            </span>
          )}
        </button>

        {isOpen && (
          <div className="absolute top-full right-0 mt-2 w-96 bg-popover border border-border rounded-lg shadow-xl z-50 animate-slide-up">
            <div className="p-4">
              <div className="relative mb-3">
                <input
                  ref={inputRef}
                  type="text"
                  value={searchInput}
                  onChange={(e) => {
                    setSearchInput(e.target.value);
                    setHighlightIndex(-1);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Search colleague or type guest name..."
                  className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                />
              </div>

              {(searchInput.length >= 3 || suggestions.length > 0) && (
                <div className="max-h-64 overflow-y-auto border border-border rounded-lg mb-3">
                  {suggestions.length > 0 && (
                    <div>
                      <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground bg-muted border-b border-border">
                        Colleagues
                      </div>
                      {suggestions.map((colleague, index) => (
                        <button
                          key={colleague.id}
                          type="button"
                          onClick={() => addColleague(colleague)}
                          className={cn(
                            "w-full px-3 py-2 text-left text-sm hover:bg-primary/10 transition-colors border-b border-border last:border-b-0",
                            highlightIndex === index && "bg-primary/10"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-foreground truncate">
                                {colleague.full_name}
                              </div>
                              <div className="text-xs text-muted-foreground flex items-center gap-2">
                                <span className="font-mono bg-muted px-1.5 py-0.5 rounded">
                                  {colleague.employee_id}
                                </span>
                                {colleague.department && (
                                  <span className="truncate">• {colleague.department}</span>
                                )}
                              </div>
                            </div>
                            <div className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full font-medium ml-2">
                              Colleague
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {searchInput.length >= 3 && (
                    <button
                      type="button"
                      onClick={addCustomGuest}
                      className={cn(
                        "w-full px-3 py-2 text-left text-sm hover:bg-green-600/10 transition-colors",
                        highlightIndex === suggestions.length && "bg-green-600/10"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-foreground">
                            Add "{searchInput}" as guest
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Family, friend, or other person
                          </div>
                        </div>
                        <div className="text-xs px-2 py-0.5 bg-green-600/10 text-green-400 rounded-full font-medium">
                          Other
                        </div>
                      </div>
                    </button>
                  )}
                </div>
              )}

              {searchInput.length > 0 && searchInput.length < 3 && (
                <div className="px-3 py-4 text-center text-xs text-muted-foreground bg-muted rounded-lg mb-3">
                  Type at least 3 characters to search
                </div>
              )}

              {selectedGuests.length > 0 && (
                <div className="border-t border-border pt-3">
                  <div className="text-xs font-semibold text-muted-foreground mb-2">
                    Selected Guests ({selectedGuests.length})
                  </div>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                    {selectedGuests.map((guest, index) => (
                      <div
                        key={index}
                        className={cn(
                          "flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-medium",
                          guest.is_colleague
                            ? "bg-primary/10 text-primary border border-primary/20"
                            : "bg-green-600/10 text-green-400 border border-green-400/20"
                        )}
                      >
                        <User size={12} />
                        <span className="max-w-[150px] truncate">
                          {guest.full_name}
                          {guest.employee_id && (
                            <span className="ml-1 opacity-70">({guest.employee_id})</span>
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeGuest(index)}
                          className="hover:opacity-70 transition-opacity"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
                <span className="font-medium text-primary">Blue</span> = Colleagues •
                <span className="font-medium text-green-400 ml-1">Green</span> = Others
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};