/* Hallmark · component: FilmCombobox · genre: atmospheric · theme: Midnight Cinema
 */
"use client";

import React, { useState, useEffect, useRef } from "react";
import { Film, Loader2, X, Check, Clapperboard } from "lucide-react";
import { searchFilms } from "@/lib/api";
import { FilmSearchResult } from "@/lib/types";
import { motion, AnimatePresence } from "framer-motion";

interface FilmComboboxProps {
  value: string;
  onChange: (slug: string, filmMeta?: FilmSearchResult) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function FilmCombobox({
  value,
  onChange,
  placeholder = "Search Letterboxd movie (e.g. Parasite or past URL)",
  disabled = false,
}: FilmComboboxProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<FilmSearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    if (query === value && !isOpen) {
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const cleanSearch = query
          .replace(/^https?:\/\/letterboxd\.com\/film\//, "")
          .replace(/\/$/, "");
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
    }, 220);

    return () => clearTimeout(timer);
  }, [query]);

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
        const rawSlug = query
          .replace(/^https?:\/\/letterboxd\.com\/film\//, "")
          .replace(/\/$/, "")
          .trim();
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
            onChange(e.target.value);
          }}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full bg-brand-darker border border-brand-border rounded-xl pl-10 pr-10 py-2.5 text-white placeholder:text-brand-muted text-xs sm:text-sm font-medium focus:outline-none focus:border-brand-green/80 focus:ring-2 focus:ring-brand-green/30 transition-all disabled:opacity-50"
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
                onChange("");
                setResults([]);
                setIsOpen(false);
                inputRef.current?.focus();
              }}
              className="text-brand-muted hover:text-white p-1 rounded-md transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Autocomplete Dropdown Menu */}
      <AnimatePresence>
        {isOpen && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 left-0 right-0 mt-2 bg-brand-card/95 border border-brand-border rounded-xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto backdrop-blur-xl"
          >
            <div className="p-1.5 space-y-1">
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-muted font-mono">
                Letterboxd Suggestions
              </div>
              {results.map((film, index) => {
                const isSelected = index === selectedIndex;
                const isCurrent = film.slug === value;
                return (
                  <button
                    key={film.slug}
                    type="button"
                    onClick={() => handleSelect(film)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-brand-border text-white"
                        : "text-brand-text hover:bg-brand-cardHover"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-10 rounded bg-brand-darker border border-brand-border flex items-center justify-center shrink-0 text-brand-green overflow-hidden">
                        <Clapperboard className="w-4 h-4" />
                      </div>
                      <div className="truncate">
                        <div className="font-semibold text-xs sm:text-sm text-white truncate flex items-center gap-1.5">
                          <span>{film.title}</span>
                          {film.year && (
                            <span className="text-[11px] text-brand-subtext font-mono font-normal">
                              ({film.year})
                            </span>
                          )}
                        </div>
                        {film.director && (
                          <div className="text-[11px] text-brand-muted truncate">
                            Dir. {film.director}
                          </div>
                        )}
                      </div>
                    </div>

                    {isCurrent && (
                      <Check className="w-4 h-4 text-brand-green shrink-0 ml-2" />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
