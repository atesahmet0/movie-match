"use client";

import React from "react";
import { Film, Clapperboard, Trash2, X, Plus } from "lucide-react";
import { FilmCombobox } from "@/components/ui/FilmCombobox";
import { FilmSearchResult, SelectedFilmChip } from "@/lib/types";
import { motion, AnimatePresence } from "framer-motion";

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
        <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 font-mono">
          <Film className="w-4 h-4 text-brand-green" />
          <span>Target Films ({selectedFilms.length} Selected)</span>
        </label>
        {selectedFilms.length > 0 && (
          <button
            type="button"
            onClick={onClearFilms}
            className="text-xs text-brand-muted hover:text-red-400 transition flex items-center space-x-1 font-mono cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear All</span>
          </button>
        )}
      </div>

      {/* Selected Chips */}
      <div className="min-h-[56px] p-3 rounded-2xl bg-brand-darker border border-brand-border flex flex-wrap items-center gap-2">
        <AnimatePresence mode="popLayout">
          {selectedFilms.map((film) => (
            <motion.div
              key={film.slug}
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="inline-flex items-center space-x-2 bg-brand-card border border-brand-border hover:border-brand-borderLight pl-3 pr-2 py-1.5 rounded-xl text-xs font-semibold text-white shadow-sm font-display"
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
                className="text-brand-muted hover:text-red-400 p-0.5 rounded-md hover:bg-brand-cardHover transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>

        {selectedFilms.length === 0 && (
          <span className="text-xs text-brand-muted px-2 italic select-none">
            Search a movie below or pick from quick suggestions to add to your scouting matrix.
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
        <span className="text-[11px] font-semibold text-brand-muted uppercase tracking-wider block font-mono">
          Popular Quick Targets:
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
                className={`px-3 py-1 rounded-xl text-xs transition flex items-center space-x-1.5 font-mono ${
                  alreadyAdded
                    ? "bg-brand-darker text-brand-muted border border-brand-border opacity-45 cursor-not-allowed"
                    : "bg-brand-card text-brand-text border border-brand-border hover:border-brand-green hover:text-brand-green cursor-pointer"
                }`}
              >
                <Plus className="w-3 h-3" />
                <span>{film.title}</span>
                {film.year && <span className="text-[10px] text-brand-muted">({film.year})</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
