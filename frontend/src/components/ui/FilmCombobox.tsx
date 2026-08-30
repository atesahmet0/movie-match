/* Hallmark · component: FilmCombobox · genre: editorial utility · theme: Studio Projection
 * architecture: TanStack Query Cached Autocomplete
 */
"use client";

import React, { useState, useEffect, useRef } from "react";
import { Film, Loader2, X, Clapperboard } from "lucide-react";
import { useFilmSearch } from "@/lib/hooks/use-film-queries";
import { FilmSearchResult } from "@/lib/types";

interface FilmComboboxProps {
  value?: string;
  onChange: (slug: string, filmMeta?: FilmSearchResult) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function FilmCombobox({
  value = "",
  onChange,
  placeholder = "Search Letterboxd movie (e.g. Parasite or past URL)",
  disabled = false,
}: FilmComboboxProps) {
  const [query, setQuery] = useState(value);
  const [debouncedQuery, setDebouncedQuery] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync with value prop from parent (e.g. when cleared)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery(value);
    setDebouncedQuery(value);
  }, [value]);

  // Debounce input for Letterboxd search queries
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const cleanSearch = debouncedQuery
    .replace(/^https?:\/\/letterboxd\.com\/film\//, "")
    .replace(/\/$/, "")
    .trim();

  // TanStack Query handles caching, deduplication & loading states
  const { data: results = [], isLoading } = useFilmSearch(
    cleanSearch,
    8
  );

  // Open dropdown when search results arrive for active typing
  useEffect(() => {
    if (results.length > 0 && query.trim().length >= 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsOpen(true);
    }
  }, [results, query]);

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
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (film: FilmSearchResult) => {
    onChange(film.slug, film);
    setQuery("");
    setDebouncedQuery("");
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && isOpen && results.length > 0) {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp" && isOpen && results.length > 0) {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (isOpen && selectedIndex >= 0 && selectedIndex < results.length) {
        handleSelect(results[selectedIndex]);
      } else {
        const rawSlug = query
          .replace(/^https?:\/\/letterboxd\.com\/film\//, "")
          .replace(/\/$/, "")
          .trim();
        if (rawSlug) {
          onChange(rawSlug);
          setQuery("");
          setDebouncedQuery("");
          setIsOpen(false);
          setSelectedIndex(-1);
        }
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setSelectedIndex(-1);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <div className="absolute left-3.5 text-brand-muted pointer-events-none">
          <Film className="w-4 h-4 text-brand-green" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIndex(-1);
          }}
          onFocus={() => {
            if (results.length > 0 && query.trim().length >= 2) {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          role="combobox"
          aria-label="Search for a film"
          aria-expanded={isOpen}
          aria-controls="film-search-results"
          aria-autocomplete="list"
          className="h-11 w-full rounded-lg border border-brand-border bg-brand-card py-2 pl-10 pr-11 text-sm font-medium text-white placeholder:text-brand-muted transition-colors hover:bg-brand-darker focus:outline-2 focus:outline-brand-green disabled:cursor-not-allowed disabled:opacity-50"
        />

        <div className="absolute right-3 flex items-center gap-1.5">
          {isLoading && (
            <Loader2 className="w-3.5 h-3.5 text-brand-green animate-spin" />
          )}
          {query && !disabled && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setDebouncedQuery("");
                setIsOpen(false);
                setSelectedIndex(-1);
                inputRef.current?.focus();
              }}
              className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-brand-muted transition-colors hover:bg-brand-darker hover:text-white"
              aria-label="Clear film search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Autocomplete Dropdown Menu */}
        {isOpen && results.length > 0 && (
          <div
            id="film-search-results"
            role="listbox"
            className="absolute left-0 right-0 z-50 mt-2 max-h-72 overflow-y-auto rounded-lg border border-brand-border bg-brand-card shadow-lg"
          >
            <div className="p-1.5 space-y-1">
              <div className="px-3 py-2 text-sm font-semibold text-brand-subtext">
                Film suggestions
              </div>
              {results.map((film, index) => {
                const isSelected = index === selectedIndex;
                return (
                  <button
                    key={film.slug}
                    type="button"
                    onClick={() => handleSelect(film)}
                    role="option"
                    aria-selected={isSelected}
                    className={`flex min-h-14 w-full cursor-pointer items-center justify-between rounded-md px-3 py-2 text-left transition-colors ${
                      isSelected
                        ? "bg-brand-green/20 text-white"
                        : "text-brand-text hover:bg-brand-cardHover"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-10 rounded bg-brand-darker border border-brand-border flex items-center justify-center shrink-0 text-brand-green overflow-hidden">
                        <Clapperboard className="w-4 h-4" />
                      </div>
                      <div className="truncate">
                        <div className="flex items-center gap-1.5 truncate text-sm font-semibold text-white">
                          <span>{film.title}</span>
                          {film.year && (
                            <span className="font-mono text-xs font-normal text-brand-subtext">
                              ({film.year})
                            </span>
                          )}
                        </div>
                        {film.director && (
                          <div className="truncate text-xs text-brand-muted">
                            Dir. {film.director}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
    </div>
  );
}
