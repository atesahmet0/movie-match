"use client";

import React, { useState, useEffect, useRef } from "react";
import { Film, Search, Loader2, X, Check, Clapperboard } from "lucide-react";
import { searchFilms } from "@/lib/api";
import { FilmSearchResult } from "@/lib/types";

interface FilmComboboxProps {
  value: string;
  onChange: (slug: string, filmMeta?: FilmSearchResult) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function FilmCombobox({
  value,
  onChange,
  placeholder = "Search Letterboxd movie (e.g. Interstellar or past URL)",
  disabled = false,
}: FilmComboboxProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<FilmSearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external value
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Debounced search
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    // If query looks like a full URL or exact slug without spaces, don't auto-fetch if already selected
    if (query === value && !isOpen) {
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const cleanSearch = query.replace(/^https?:\/\/letterboxd\.com\/film\//, "").replace(/\/$/, "");
        const resultsList = await searchFilms(cleanSearch, 8);
        if (resultsList && resultsList.length > 0) {
          setResults(resultsList);
          setIsOpen(true);
        } else {
          setResults([]);
        }
      } catch (err) {
        console.error("Film search failed:", err);
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (film: FilmSearchResult) => {
    setQuery(film.slug);
    onChange(film.slug, film);
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < results.length) {
        handleSelect(results[selectedIndex]);
      } else {
        // Use current text as slug
        const rawSlug = query.replace(/^https?:\/\/letterboxd\.com\/film\//, "").replace(/\/$/, "").trim();
        onChange(rawSlug);
        setIsOpen(false);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <div className="absolute left-3.5 text-[#667788] pointer-events-none">
          <Film className="w-5 h-5 text-[#00e054]" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value);
          }}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full bg-[#14181c] border border-[#2c3440] rounded-xl pl-11 pr-10 py-3 text-white placeholder-[#667788] text-sm md:text-base focus:outline-none focus:border-[#00e054] focus:ring-1 focus:ring-[#00e054] transition-all disabled:opacity-50"
        />

        <div className="absolute right-3 flex items-center gap-1.5">
          {isLoading && <Loader2 className="w-4 h-4 text-[#00e054] animate-spin" />}
          {query && !disabled && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                onChange("");
                setResults([]);
                setIsOpen(false);
                inputRef.current?.focus();
              }}
              className="text-[#667788] hover:text-white p-1 rounded-md transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Autocomplete Dropdown Menu */}
      {isOpen && results.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-2 bg-[#1b2228] border border-[#2c3440] rounded-xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto animate-in fade-in-0 zoom-in-95 backdrop-blur-xl">
          <div className="p-1.5 space-y-1">
            <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#667788]">
              Letterboxd Matches
            </div>
            {results.map((film, index) => {
              const isSelected = index === selectedIndex;
              const isCurrent = film.slug === value;
              return (
                <button
                  key={film.slug}
                  type="button"
                  onClick={() => handleSelect(film)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors ${
                    isSelected
                      ? "bg-[#2c3440] text-white"
                      : "text-[#e1e7ed] hover:bg-[#222b33]"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded bg-[#14181c] border border-[#2c3440] flex items-center justify-center shrink-0 text-[#00e054]">
                      <Clapperboard className="w-4 h-4" />
                    </div>
                    <div className="truncate">
                      <div className="font-semibold text-sm text-white truncate flex items-center gap-2">
                        <span>{film.title}</span>
                        {film.year && (
                          <span className="text-xs text-[#99aabb] font-normal">
                            ({film.year})
                          </span>
                        )}
                      </div>
                      {film.director && (
                        <div className="text-xs text-[#667788] truncate">
                          Dir. {film.director}
                        </div>
                      )}
                    </div>
                  </div>

                  {isCurrent && (
                    <Check className="w-4 h-4 text-[#00e054] shrink-0 ml-2" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
