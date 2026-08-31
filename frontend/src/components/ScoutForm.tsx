/* Hallmark · component: ScoutForm · genre: editorial utility · theme: Studio Projection
 * architecture: Compound Components & Custom Hooks
 */
"use client";

import React from "react";
import { Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useScoutForm, UseScoutFormProps } from "@/lib/hooks/use-scout-form";
import {
  FilmSelector,
  LocationPicker,
  StatusProgress,
} from "@/components/scout";

export interface ScoutFormProps extends UseScoutFormProps {
  className?: string;
}

export default function ScoutForm({
  initialFilms = ["parasite-2019"],
  initialLocation = "Anywhere",
  initialSentiment = "liked",
  initialPages = 6,
  initialLimit = 10,
  initialIncludeBio = false,
  className = "",
}: ScoutFormProps) {
  const form = useScoutForm({
    initialFilms,
    initialLocation,
    initialSentiment,
    initialPages,
    initialLimit,
    initialIncludeBio,
  });

  return (
    <div className={`w-full space-y-4 ${className}`}>
      <div className="workspace-panel p-5 sm:p-7">
        <form onSubmit={form.handleSubmit} className="space-y-7">
          {/* Compound 1: Film Selector */}
          <FilmSelector
            selectedFilms={form.selectedFilms}
            comboboxValue={form.comboboxValue}
            isAddingFilm={form.isAddingFilm}
            onAddFilm={form.addFilm}
            onRemoveFilm={form.removeFilm}
            onClearFilms={form.clearFilms}
          />

          {/* Compound 2: Location Picker */}
          <LocationPicker
            locations={form.locations}
            locationInput={form.locationInput}
            onLocationInputChange={form.setLocationInput}
            onAddLocation={form.addLocation}
            onRemoveLocation={form.removeLocation}
            onTogglePresetLocation={form.togglePresetLocation}
          />

          {/* Submit Action */}
          <Button
            type="submit"
            variant="cinema"
            size="lg"
            disabled={form.isPending || form.selectedFilms.length === 0}
            className="w-full text-sm sm:text-base"
            leftIcon={
              form.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Search className="w-5 h-5" />
              )
            }
          >
            {form.isPending ? (
                <span>Opening search…</span>
            ) : (
              <span>
                Scout {form.selectedFilms.length}{" "}
                {form.selectedFilms.length === 1 ? "Film" : "Films"}
              </span>
            )}
          </Button>
        </form>
      </div>

      {/* Compound 3: Dynamic Live Scouting Status Progression */}
      <StatusProgress
        isPending={form.isPending}
        selectedFilmsCount={form.selectedFilms.length}
        locations={form.locations}
        maxPages={form.maxPages}
      />
    </div>
  );
}

// Attach Compound Subcomponents
ScoutForm.FilmSelector = FilmSelector;
ScoutForm.LocationPicker = LocationPicker;
ScoutForm.StatusProgress = StatusProgress;
