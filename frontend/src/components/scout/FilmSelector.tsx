"use client";

import React from "react";
import { Film, Clapperboard, Trash2, X, Plus } from "lucide-react";
import { FilmCombobox } from "@/components/ui/FilmCombobox";
import { FilmSearchResult, SelectedFilmChip } from "@/lib/types";

export const POPULAR_SUGGESTIONS: FilmSearchResult[] = [
  { slug: "parasite-2019", title: "Parasite", year: 2019, director: "Bong Joon-ho", film_url: "https://letterboxd.com/film/parasite-2019/" },
  { slug: "interstellar", title: "Interstellar", year: 2014, director: "Christopher Nolan", film_url: "https://letterboxd.com/film/interstellar/" },
  { slug: "the-substance", title: "The Substance", year: 2024, director: "Coralie Fargeat", film_url: "https://letterboxd.com/film/the-substance/" },
  { slug: "fight-club", title: "Fight Club", year: 1999, director: "David Fincher", film_url: "https://letterboxd.com/film/fight-club/" },
  { slug: "dune-part-two", title: "Dune: Part Two", year: 2024, director: "Denis Villeneuve", film_url: "https://letterboxd.com/film/dune-part-two/" },
  { slug: "spirited-away", title: "Spirited Away", year: 2001, director: "Hayao Miyazaki", film_url: "https://letterboxd.com/film/spirited-away/" },
];

export interface FilmSelectorProps {
  selectedFilms: SelectedFilmChip[];
  comboboxValue: string;
  isAddingFilm: boolean;
  onAddFilm: (slug: string, meta?: FilmSearchResult) => void;
  onRemoveFilm: (slug: string) => void;
  onClearFilms: () => void;
}

export function FilmSelector({
  selectedFilms,
  comboboxValue,
  isAddingFilm,
  onAddFilm,
  onRemoveFilm,
  onClearFilms,
}: FilmSelectorProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm font-bold text-white">
          <Film className="w-4 h-4 text-brand-green" />
          <span>Target Films ({selectedFilms.length} Selected)</span>
        </label>
        {selectedFilms.length > 0 && (
          <button
            type="button"
            onClick={onClearFilms}
            className="inline-flex min-h-10 items-center gap-1 whitespace-nowrap rounded-lg px-2 text-sm text-brand-muted transition-colors hover:bg-brand-darker hover:text-[color:var(--color-error)]"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear All</span>
          </button>
        )}
      </div>

      {/* Selected Chips */}
      <div className="flex min-h-14 flex-wrap items-center gap-2 rounded-lg border border-brand-border bg-brand-darker p-3">
          {selectedFilms.map((film) => (
            <div
              key={film.slug}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-brand-border bg-brand-card py-1.5 pl-3 pr-1.5 text-sm font-semibold text-white"
            >
              <Clapperboard className="w-3.5 h-3.5 text-brand-green shrink-0" />
              <span className="truncate max-w-[200px]">
                {film.title || film.slug}
                {film.year && (
                  <span className="text-brand-muted font-mono font-normal ml-1">
                    ({film.year})
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => onRemoveFilm(film.slug)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-brand-muted transition-colors hover:bg-brand-cardHover hover:text-[color:var(--color-error)]"
                aria-label={`Remove ${film.title || film.slug}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

        {selectedFilms.length === 0 && (
          <span className="px-2 text-sm text-brand-muted select-none">
            Search below or choose a suggestion.
          </span>
        )}
      </div>

      {/* Instant Film Combobox */}
      <FilmCombobox
        value={comboboxValue}
        onChange={onAddFilm}
        placeholder="Search Letterboxd film title (e.g. Parasite, Alien, Dune)..."
        disabled={isAddingFilm}
      />

      {/* Quick Suggestions */}
      <div className="space-y-1.5 pt-1">
        <span className="block text-sm font-semibold text-brand-subtext">
          Popular films
        </span>
        <div className="flex flex-wrap gap-1.5">
          {POPULAR_SUGGESTIONS.map((film) => {
            const alreadyAdded = selectedFilms.some((f) => f.slug === film.slug);
            return (
              <button
                key={film.slug}
                type="button"
                disabled={alreadyAdded}
                onClick={() => onAddFilm(film.slug, film)}
                className={`inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1 text-sm transition-colors ${
                  alreadyAdded
                    ? "cursor-not-allowed border-brand-border bg-brand-darker text-brand-muted opacity-50"
                    : "cursor-pointer border-brand-border bg-brand-card text-brand-text hover:bg-brand-darker hover:border-brand-borderLight"
                }`}
              >
                <Plus className="w-3 h-3" />
                <span>{film.title}</span>
                {film.year && <span className="text-xs text-brand-muted">({film.year})</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
