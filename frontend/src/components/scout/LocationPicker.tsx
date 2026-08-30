"use client";

import React from "react";
import { MapPin, X, CheckCircle2 } from "lucide-react";

export const PRESET_LOCATIONS = [
  "Anywhere",
  "Turkey",
  "Ankara",
  "Istanbul",
  "London",
  "Berlin",
  "New York",
  "Tokyo",
  "Paris",
];

export interface LocationPickerProps {
  locations: string[];
  locationInput: string;
  onLocationInputChange: (val: string) => void;
  onAddLocation: (loc: string) => void;
  onRemoveLocation: (loc: string) => void;
  onTogglePresetLocation: (loc: string) => void;
}

export function LocationPicker({
  locations,
  locationInput,
  onLocationInputChange,
  onAddLocation,
  onRemoveLocation,
  onTogglePresetLocation,
}: LocationPickerProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      onAddLocation(locationInput);
    }
  };

  return (
    <div className="space-y-3 border-t border-brand-border pt-6">
      <label className="flex items-center gap-2 text-sm font-bold text-white">
        <MapPin className="w-4 h-4 text-brand-blue" />
        <span>Target Locations & Cities</span>
      </label>

      <div className="flex min-h-14 flex-wrap items-center gap-2 rounded-lg border border-brand-border bg-brand-darker p-2.5">
        {locations.map((loc) => (
          <span
            key={loc}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-brand-border bg-brand-card px-3 py-1 text-sm font-semibold text-white"
          >
            <MapPin className="w-3 h-3 text-brand-green" />
            <span>{loc}</span>
            {locations.length > 1 && (
              <button
                type="button"
                onClick={() => onRemoveLocation(loc)}
                className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-md text-brand-muted hover:bg-brand-darker hover:text-[color:var(--color-error)]"
                aria-label={`Remove ${loc}`}
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </span>
        ))}

        <input
          type="text"
          value={locationInput}
          onChange={(e) => onLocationInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (locationInput.trim()) onAddLocation(locationInput);
          }}
          placeholder={
            locations.length === 0
              ? "Type city (e.g. Ankara) and press Enter"
              : "Add another location..."
          }
          className="min-h-11 min-w-[140px] flex-1 border-none bg-transparent px-2 py-1 text-sm text-white placeholder:text-brand-muted focus:outline-none"
        />
      </div>

      {/* Preset Buttons */}
      <div className="flex flex-wrap gap-1.5">
        {PRESET_LOCATIONS.map((loc) => {
          const active = locations.some((l) => l.toLowerCase() === loc.toLowerCase());
          return (
            <button
              key={loc}
              type="button"
              onClick={() => onTogglePresetLocation(loc)}
              className={`inline-flex min-h-10 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1 text-sm transition-colors ${
                active
                  ? "bg-brand-green text-black font-bold border-brand-green"
                  : "bg-brand-card text-brand-subtext border-brand-border hover:bg-brand-darker hover:text-white"
              }`}
            >
              <span>{loc}</span>
              {active && <CheckCircle2 className="w-3 h-3 text-black" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
