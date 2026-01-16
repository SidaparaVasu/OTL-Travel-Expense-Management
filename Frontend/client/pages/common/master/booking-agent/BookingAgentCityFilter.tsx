import React, { useState, useMemo } from "react";
import {
  Combobox,
  ComboboxInput,
  ComboboxOptions,
  ComboboxOption,
} from "@headlessui/react";
import { cn } from "@/lib/utils";
import { MapPin, Check, ChevronDown, X } from "lucide-react";

interface City {
  id: number;
  city_name: string;
  city_code: string;
  state_name?: string;
  country_name?: string;
}

interface BookingAgentCityFilterProps {
  cities: City[];
  value: number | null;
  onChange: (id: number | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string; // Allow external styling
}

export const BookingAgentCityFilter: React.FC<BookingAgentCityFilterProps> = ({
  cities,
  value,
  onChange,
  placeholder = "Filter by City",
  disabled,
  className,
}) => {
  const [query, setQuery] = useState("");

  const normalize = (str: string) =>
    str
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

  const filteredCities = useMemo(() => {
    if (!query) return cities.slice(0, 30);

    const q = normalize(query);

    return cities
      .map((city) => {
        const name = normalize(city.city_name);
        const code = normalize(city.city_code);
        const state = normalize(city.state_name || "");

        let score = 0;
        if (code.startsWith(q)) score += 100;
        else if (name.startsWith(q)) score += 70;
        else if (code.includes(q)) score += 50;
        else if (name.includes(q)) score += 40;
        else if (state.includes(q)) score += 20;
        else score = 0;

        return { city, score };
      })
      .filter((obj) => obj.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map((obj) => obj.city);
  }, [cities, query]);

  const selectedCity = useMemo(() => {
    return cities.find((c) => c.id === value) || null;
  }, [cities, value]);

  return (
    <div className={cn("relative w-full", className)}>
      <Combobox
        value={selectedCity}
        onChange={(city) => {
          onChange(city ? city.id : null);
        }}
        disabled={disabled}
      >
        <div className="relative">
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <ComboboxInput
              className={cn(
                "w-full pl-10 pr-8 h-10 rounded-md border border-input bg-background py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                "border-slate-200", // Specific style match
                disabled && "opacity-50 cursor-not-allowed bg-slate-50",
              )}
              displayValue={(city: City | null) => city?.city_name || ""}
              onChange={(e) => {
                setQuery(e.target.value);
                if (!e.target.value) {
                  onChange(null);
                }
              }}
              placeholder={placeholder}
            />
            {/* Chevron or Clear button */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {selectedCity && !disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(null);
                    setQuery("");
                  }}
                  className="p-1 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="h-4 w-4 text-slate-400 hover:text-slate-600" />
                </button>
              )}
              <ChevronDown className="h-4 w-4 text-slate-400 opacity-50 pointer-events-none" />
            </div>
          </div>

          <ComboboxOptions className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-popover border border-slate-200 bg-white shadow-md py-1 text-base ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
            {filteredCities.length === 0 && query !== "" ? (
              <div className="px-4 py-3 text-sm text-slate-500">
                No cities found
              </div>
            ) : (
              filteredCities.map((city) => (
                <ComboboxOption
                  key={city.id}
                  value={city}
                  className={({ active, selected }) =>
                    cn(
                      "relative cursor-pointer select-none px-4 py-2 transition-colors",
                      active ? "bg-slate-100 text-slate-900" : "text-slate-700",
                      selected && "bg-blue-50 text-blue-700 font-medium",
                    )
                  }
                >
                  {({ selected }) => (
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          "block truncate",
                          selected && "font-medium",
                        )}
                      >
                        {city.city_name}
                      </span>
                      {selected && <Check className="h-4 w-4 text-blue-600" />}
                    </div>
                  )}
                </ComboboxOption>
              ))
            )}
          </ComboboxOptions>
        </div>
      </Combobox>
    </div>
  );
};
