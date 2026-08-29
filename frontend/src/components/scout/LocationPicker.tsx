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
    <div className="space-y-3 pt-4 border-t border-brand-border/80">
      <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 font-mono">
        <MapPin className="w-4 h-4 text-brand-blue" />
        <span>Target Locations & Cities</span>
      </label>

      <div className="min-h-[50px] p-2.5 rounded-2xl bg-brand-darker border border-brand-border flex flex-wrap items-center gap-2">
        {locations.map((loc) => (
          <span
            key={loc}
            className="inline-flex items-center space-x-1.5 bg-brand-card border border-brand-border px-3 py-1 rounded-xl text-xs font-semibold text-brand-green font-mono"
          >
            <MapPin className="w-3 h-3 text-brand-green" />
            <span>{loc}</span>
            {locations.length > 1 && (
              <button
                type="button"
                onClick={() => onRemoveLocation(loc)}
                className="text-brand-muted hover:text-red-400 ml-1 cursor-pointer"
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
          className="bg-transparent border-none text-xs sm:text-sm text-white placeholder:text-brand-muted focus:outline-none flex-1 min-w-[140px] px-2 py-1"
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
              className={`px-3 py-1 rounded-xl border text-xs font-mono transition cursor-pointer flex items-center space-x-1.5 ${
                active
                  ? "bg-brand-green text-black font-bold border-brand-green"
                  : "bg-brand-darker text-brand-subtext border-brand-border hover:text-white hover:border-brand-borderLight"
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
