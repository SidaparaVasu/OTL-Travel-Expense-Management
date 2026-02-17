import React, { useState, useEffect, useRef } from "react";
import { ChevronDown, X } from "lucide-react";

interface Option {
  id: string | number;
  name: string;
  [key: string]: any;
}

interface MultiSelectDropdownProps {
  label?: string;
  options: Option[];
  selected: (string | number)[];
  onChange: (selected: (string | number)[]) => void;
  valueKey?: string;
  labelKey?: string;
  placeholder?: string;
  error?: string;
  required?: boolean;
  className?: string;
}

export function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
  valueKey = "id",
  labelKey = "name",
  placeholder = "Select...",
  error,
  required = false,
  className = "",
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const toggleOption = (optionValue: string | number) => {
    if (selected.includes(optionValue)) {
      onChange(selected.filter((v) => v !== optionValue));
    } else {
      onChange([...selected, optionValue]);
    }
  };

  const getDisplayText = () => {
    if (selected.length === 0) return placeholder;
    if (selected.length === 1) {
      const item = options.find((o) => o[valueKey] == selected[0]);
      return item ? item[labelKey] : placeholder;
    }
    return `${selected.length} selected`;
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3 py-2.5 text-left bg-white border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 flex items-center justify-between ${
          error ? "border-red-500" : "border-slate-300"
        }`}
      >
        <span
          className={`text-sm ${selected.length === 0 ? "text-slate-500" : "text-slate-700"}`}
        >
          {getDisplayText()}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-auto">
          {options.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-500">
              No options available
            </div>
          ) : (
            options.map((option) => (
              <label
                key={option[valueKey]}
                className="flex items-center px-3 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0"
              >
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    checked={selected.includes(option[valueKey])}
                    onChange={() => toggleOption(option[valueKey])}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                </div>
                <span className="ml-3 text-sm text-slate-700 truncate">
                  {option[labelKey]}
                </span>
              </label>
            ))
          )}
        </div>
      )}
      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
    </div>
  );
}
