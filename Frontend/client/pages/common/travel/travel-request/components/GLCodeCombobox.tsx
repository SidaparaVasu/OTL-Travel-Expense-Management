import React, { useState, useMemo } from "react";
import { Combobox, ComboboxInput, ComboboxOptions, ComboboxOption } from "@headlessui/react";
import { cn } from "@/lib/utils";
import { Hash, Check } from "lucide-react";

interface GLCode {
  id: number;
  gl_code: string;
  vertical_name: string;
  short_description?: string;
}

interface GLCodeComboboxProps {
  label: string;
  required?: boolean;
  glCodes: GLCode[];
  value: number | null;
  displayValue: string;
  onChange: (id: number | null, label: string) => void;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
}

export const GLCodeCombobox: React.FC<GLCodeComboboxProps> = ({
  label,
  required,
  glCodes,
  value,
  displayValue,
  onChange,
  error,
  placeholder = "Search GL Code or Vertical...",
  disabled,
}) => {
  const [query, setQuery] = useState("");

  const normalize = (str: string) =>
    str.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  const filteredGLCodes = useMemo(() => {
    if (!query) return glCodes.slice(0, 20);

    const q = normalize(query);

    return glCodes
      .map((glCode) => {
        const code = normalize(glCode.gl_code);
        const vertical = normalize(glCode.vertical_name);
        const description = normalize(glCode.short_description || "");

        // Priority scoring
        let score = 0;

        if (code.startsWith(q)) score += 100;           // Highest: code prefix
        else if (vertical.startsWith(q)) score += 80;   // High: vertical name prefix
        else if (code.includes(q)) score += 60;         // Medium: code contains
        else if (vertical.includes(q)) score += 50;     // Medium: vertical contains
        else if (description.includes(q)) score += 30;  // Lower: description contains
        else score = 0;

        return { glCode, score };
      })
      .filter((obj) => obj.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map((obj) => obj.glCode);
  }, [glCodes, query]);

  const selectedGLCode = useMemo(() => {
    return glCodes.find((gl) => gl.id === value) || null;
  }, [glCodes, value]);

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      <Combobox
        value={selectedGLCode}
        onChange={(glCode) => {
          if (glCode) {
            const label = glCode.short_description
              ? `${glCode.gl_code} - ${glCode.vertical_name} (${glCode.short_description})`
              : `${glCode.gl_code} - ${glCode.vertical_name}`;
            onChange(glCode.id, label);
          } else {
            onChange(null, "");
          }
        }}
        disabled={disabled}
      >
        <div className="relative">
          <div className="relative">
            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <ComboboxInput
              className={cn(
                "w-full pl-10 pr-3 py-2.5 rounded-lg border bg-card text-card-foreground transition-all duration-200",
                "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary",
                "placeholder:text-muted-foreground",
                error
                  ? "border-destructive focus:ring-destructive/50 focus:border-destructive"
                  : "border-input hover:border-primary/50",
                disabled && "opacity-50 cursor-not-allowed bg-muted"
              )}
              displayValue={(glCode: GLCode | null) => {
                if (!glCode) return displayValue;
                return glCode.short_description
                  ? `${glCode.gl_code} - ${glCode.vertical_name} (${glCode.short_description})`
                  : `${glCode.gl_code} - ${glCode.vertical_name}`;
              }}
              onChange={(e) => {
                setQuery(e.target.value);
                if (!e.target.value) {
                  onChange(null, "");
                }
              }}
              placeholder={placeholder}
            />
          </div>

          <ComboboxOptions className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-popover border border-border shadow-lg">
            {filteredGLCodes.length === 0 && query !== "" ? (
              <div className="px-4 py-3 text-sm text-muted-foreground">No GL Codes found</div>
            ) : (
              filteredGLCodes.map((glCode) => (
                <ComboboxOption
                  key={glCode.id}
                  value={glCode}
                  className={({ active, selected }) =>
                    cn(
                      "relative cursor-pointer select-none px-4 py-2.5 transition-colors",
                      active && "bg-primary/10",
                      selected && "bg-primary/5"
                    )
                  }
                >
                  {({ selected }) => (
                    <div className="flex items-center justify-between">
                      <div>
                        <span className={cn("block font-medium flex items-center justify-left", selected && "text-primary")}>
                          {glCode.gl_code} - {glCode.vertical_name}
                        </span>
                        {glCode.short_description && (
                          <span className="block text-xs text-muted-foreground">
                            {glCode.short_description}
                          </span>
                        )}
                      </div>
                      {selected && <Check className="h-4 w-4 text-primary" />}
                    </div>
                  )}
                </ComboboxOption>
              ))
            )}
          </ComboboxOptions>
        </div>
      </Combobox>
      {error && (
        <p className="text-sm text-destructive font-medium animate-fade-in">{error}</p>
      )}
    </div>
  );
};
