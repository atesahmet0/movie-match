"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Loader2,
  Clapperboard,
  Film,
  Sparkles,
  MapPin,
  CheckCircle2,
  Globe,
  Users,
  Layers,
  Plus,
  X,
  Trash2,
} from "lucide-react";
import { fetchFilmInfo } from "@/lib/api";
import { FilmSearchResult, SelectedFilmChip } from "@/lib/types";
import { FilmCombobox } from "@/components/ui/FilmCombobox";
import { motion, AnimatePresence } from "framer-motion";

interface ScoutFormProps {
  initialFilms: string[];
  initialLocation: string;
  initialSentiment: string;
  initialPages: number;
  initialLimit: number;
  initialIncludeBio: boolean;
}

const PRESET_LOCATIONS = [
  "Anywhere",
  "Turkey",
  "Ankara",
  "Istanbul",
  "USA",
  "UK",
  "Germany",
  "Berlin",
  "London",
];

const POPULAR_SUGGESTIONS: FilmSearchResult[] = [
  { slug: "alien", title: "Alien", year: 1979, director: "Ridley Scott", film_url: "https://letterboxd.com/film/alien/" },
  { slug: "interstellar", title: "Interstellar", year: 2014, director: "Christopher Nolan", film_url: "https://letterboxd.com/film/interstellar/" },
  { slug: "the-substance", title: "The Substance", year: 2024, director: "Coralie Fargeat", film_url: "https://letterboxd.com/film/the-substance/" },
  { slug: "fight-club", title: "Fight Club", year: 1999, director: "David Fincher", film_url: "https://letterboxd.com/film/fight-club/" },
  { slug: "dune-part-two", title: "Dune: Part Two", year: 2024, director: "Denis Villeneuve", film_url: "https://letterboxd.com/film/dune-part-two/" },
  { slug: "spirited-away", title: "Spirited Away", year: 2001, director: "Hayao Miyazaki", film_url: "https://letterboxd.com/film/spirited-away/" },
];

export default function ScoutForm({
  initialFilms,
  initialLocation,
  initialSentiment,
  initialPages,
  initialLimit,
  initialIncludeBio,
}: ScoutFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [selectedFilms, setSelectedFilms] = useState<SelectedFilmChip[]>([]);
  const [comboboxValue, setComboboxValue] = useState("");
  const [isAddingFilm, setIsAddingFilm] = useState(false);

  // Multi-location chips
  const parseInitialLocations = (raw: string): string[] => {
    const split = (raw || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return split.length > 0 ? split : ["Anywhere"];
  };

  const [locations, setLocations] = useState<string[]>(
    parseInitialLocations(initialLocation)
  );
  const [locationInput, setLocationInput] = useState("");

  const [sentiment, setSentiment] = useState(initialSentiment || "liked");
  const [maxPages, setMaxPages] = useState(initialPages || 3);
  const [limit, setLimit] = useState(initialLimit || 50);
  const [includeBio, setIncludeBio] = useState(initialIncludeBio !== false);

  // Live status progress
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [statusStep, setStatusStep] = useState(0);

  // Initialize films on load
  useEffect(() => {
    if (initialFilms && initialFilms.length > 0 && selectedFilms.length === 0) {
      initialFilms.forEach((slug) => {
        if (slug) {
          fetchFilmInfo(slug).then((meta) => {
            if (meta && meta.slug) {
              setSelectedFilms((prev) => {
                if (prev.some((f) => f.slug === meta.slug)) return prev;
                return [
                  ...prev,
                  {
                    slug: meta.slug,
                    title: meta.title || meta.slug,
                    year: meta.year,
                    poster_url: meta.poster_url,
                  },
                ];
              });
            } else {
              setSelectedFilms((prev) => [
                ...prev,
                { slug, title: slug },
              ]);
            }
          });
        }
      });
    }
  }, [initialFilms]);

  // Handle timer during scan
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isPending) {
      setElapsedSeconds(0);
      setStatusStep(1);
      const startTime = Date.now();
      interval = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        setElapsedSeconds(elapsed);
        if (elapsed > 1.2 && elapsed <= 3.5) setStatusStep(2);
        else if (elapsed > 3.5 && elapsed <= 7.0) setStatusStep(3);
        else if (elapsed > 7.0) setStatusStep(4);
      }, 100);
    } else {
      setStatusStep(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPending]);

  const handleAddFilmFromCombobox = async (slug: string, filmMeta?: FilmSearchResult) => {
    if (!slug) return;
    setIsAddingFilm(true);

    if (filmMeta) {
      setSelectedFilms((prev) => {
        if (prev.some((f) => f.slug === filmMeta.slug)) return prev;
        return [...prev, { slug: filmMeta.slug, title: filmMeta.title, year: filmMeta.year }];
      });
      setComboboxValue("");
      setIsAddingFilm(false);
      return;
    }

    try {
      const meta = await fetchFilmInfo(slug);
      if (meta && meta.slug) {
        setSelectedFilms((prev) => {
          if (prev.some((f) => f.slug === meta.slug)) return prev;
          return [
            ...prev,
            {
              slug: meta.slug,
              title: meta.title || meta.slug,
              year: meta.year,
              poster_url: meta.poster_url,
            },
          ];
        });
      } else {
        setSelectedFilms((prev) => [...prev, { slug, title: slug }]);
      }
    } catch {
      setSelectedFilms((prev) => [...prev, { slug, title: slug }]);
    } finally {
      setComboboxValue("");
      setIsAddingFilm(false);
    }
  };

  const handleRemoveFilm = (slugToRemove: string) => {
    setSelectedFilms((prev) => prev.filter((f) => f.slug !== slugToRemove));
  };

  const handleAddLocation = (loc: string) => {
    const clean = loc.trim();
    if (!clean) return;

    if (clean.toLowerCase() === "anywhere") {
      setLocations(["Anywhere"]);
      setLocationInput("");
      return;
    }

    setLocations((prev) => {
      const filtered = prev.filter((l) => l.toLowerCase() !== "anywhere");
      if (filtered.some((l) => l.toLowerCase() === clean.toLowerCase())) {
        return filtered;
      }
      return [...filtered, clean];
    });
    setLocationInput("");
  };

  const handleRemoveLocation = (locToRemove: string) => {
    setLocations((prev) => {
      const filtered = prev.filter((l) => l !== locToRemove);
      return filtered.length > 0 ? filtered : ["Anywhere"];
    });
  };

  const handleTogglePresetLocation = (loc: string) => {
    if (loc === "Anywhere") {
      setLocations(["Anywhere"]);
      return;
    }

    setLocations((prev) => {
      const withoutAnywhere = prev.filter((l) => l !== "Anywhere");
      if (withoutAnywhere.includes(loc)) {
        const next = withoutAnywhere.filter((l) => l !== loc);
        return next.length > 0 ? next : ["Anywhere"];
      } else {
        return [...withoutAnywhere, loc];
      }
    });
  };

  const handleLocationKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      handleAddLocation(locationInput);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFilms.length === 0) return;

    const filmsParam = selectedFilms.map((f) => f.slug).join(",");
    const locParam = locations.join(",");

    startTransition(() => {
      router.push(
        `/scout?films=${encodeURIComponent(filmsParam)}&location=${encodeURIComponent(
          locParam
        )}&sentiment=${sentiment}&max_pages=${maxPages}&limit=${limit}&include_bio=${includeBio}`
      );
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="glass-card p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Film Selector */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Film className="w-4 h-4 text-[#00e054]" />
                Target Films ({selectedFilms.length} Selected)
              </label>
              {selectedFilms.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedFilms([])}
                  className="text-xs text-[#667788] hover:text-red-400 transition flex items-center space-x-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              )}
            </div>

            {/* Selected Chips */}
            <div className="min-h-[56px] p-3 rounded-2xl bg-[#14181c] border border-[#2c3440] flex flex-wrap items-center gap-2">
              <AnimatePresence mode="popLayout">
                {selectedFilms.map((film) => (
                  <motion.div
                    key={film.slug}
                    layout
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    className="inline-flex items-center space-x-2 bg-[#1b2228] border border-[#2c3440] hover:border-[#3d4957] pl-3 pr-2 py-1.5 rounded-xl text-xs font-semibold text-white shadow-sm"
                  >
                    <Clapperboard className="w-3.5 h-3.5 text-[#00e054] shrink-0" />
                    <span className="truncate max-w-[200px]">
                      {film.title || film.slug}
                      {film.year && (
                        <span className="text-[#99aabb] font-normal ml-1">
                          ({film.year})
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveFilm(film.slug)}
                      className="text-[#667788] hover:text-red-400 p-0.5 rounded-md hover:bg-[#222b33] transition"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>

              {selectedFilms.length === 0 && (
                <span className="text-xs text-[#667788] px-2 italic select-none">
                  Search a movie below or choose from popular suggestions.
                </span>
              )}
            </div>

            {/* Instant Film Combobox */}
            <FilmCombobox
              value={comboboxValue}
              onChange={handleAddFilmFromCombobox}
              placeholder="Search Letterboxd film title (e.g. Interstellar, Alien, Dune)..."
              disabled={isAddingFilm}
            />

            {/* Quick Suggestions */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-semibold text-[#667788] uppercase tracking-wider block">
                Popular Quick Picks:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {POPULAR_SUGGESTIONS.map((film) => {
                  const alreadyAdded = selectedFilms.some((f) => f.slug === film.slug);
                  return (
                    <button
                      key={film.slug}
                      type="button"
                      disabled={alreadyAdded}
                      onClick={() =>
                        setSelectedFilms((prev) => {
                          if (prev.some((f) => f.slug === film.slug)) return prev;
                          return [...prev, { slug: film.slug, title: film.title, year: film.year }];
                        })
                      }
                      className={`px-3 py-1 rounded-xl text-xs transition flex items-center space-x-1.5 ${
                        alreadyAdded
                          ? "bg-[#14181c] text-[#667788] border border-[#2c3440] opacity-50 cursor-not-allowed"
                          : "bg-[#1b2228] text-[#e1e7ed] border border-[#2c3440] hover:border-[#00e054] hover:text-[#00e054] cursor-pointer"
                      }`}
                    >
                      <Plus className="w-3 h-3" />
                      <span>{film.title}</span>
                      {film.year && <span className="text-[10px] text-[#667788]">({film.year})</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Section 2: Location Filter */}
          <div className="space-y-3 pt-4 border-t border-[#2c3440]">
            <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-[#40bcf4]" />
              Target Locations
            </label>

            <div className="min-h-[50px] p-2.5 rounded-2xl bg-[#14181c] border border-[#2c3440] flex flex-wrap items-center gap-2">
              {locations.map((loc) => (
                <span
                  key={loc}
                  className="inline-flex items-center space-x-1.5 bg-[#1b2228] border border-[#2c3440] px-3 py-1 rounded-xl text-xs font-semibold text-[#00e054]"
                >
                  <MapPin className="w-3 h-3" />
                  <span>{loc}</span>
                  {locations.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveLocation(loc)}
                      className="text-[#667788] hover:text-red-400 ml-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </span>
              ))}

              <input
                type="text"
                value={locationInput}
                onChange={(e) => setLocationInput(e.target.value)}
                onKeyDown={handleLocationKeyDown}
                onBlur={() => {
                  if (locationInput.trim()) handleAddLocation(locationInput);
                }}
                placeholder={locations.length === 0 ? "Type city (e.g. Ankara) and press Enter" : "Add another location..."}
                className="bg-transparent border-none text-xs sm:text-sm text-white placeholder-[#667788] focus:outline-none flex-1 min-w-[140px] px-2 py-1"
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
                    onClick={() => handleTogglePresetLocation(loc)}
                    className={`px-3 py-1 rounded-xl border text-xs transition cursor-pointer flex items-center space-x-1.5 ${
                      active
                        ? "bg-[#00e054] text-[#0d1114] font-bold border-[#00e054]"
                        : "bg-[#14181c] text-[#99aabb] border-[#2c3440] hover:text-white hover:border-[#3d4957]"
                    }`}
                  >
                    <span>{loc}</span>
                    {active && <CheckCircle2 className="w-3 h-3 text-[#0d1114]" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Fine Tuning */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-[#2c3440]">
            <div>
              <label className="block text-xs font-semibold text-white mb-1.5">
                Sentiment Filter
              </label>
              <select
                value={sentiment}
                onChange={(e) => setSentiment(e.target.value)}
                className="w-full text-xs bg-[#14181c] border border-[#2c3440] rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-[#00e054]"
              >
                <option value="liked">Liked / High Rating (4-5 Stars)</option>
                <option value="disliked">Disliked / Low Rating (0.5-2 Stars)</option>
                <option value="all">All Members (Watched / Rated)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-white mb-1.5">
                Scan Depth
              </label>
              <select
                value={maxPages}
                onChange={(e) => setMaxPages(parseInt(e.target.value) || 3)}
                className="w-full text-xs bg-[#14181c] border border-[#2c3440] rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-[#00e054]"
              >
                <option value={2}>2 Pages per film (~150 candidates)</option>
                <option value={3}>3 Pages per film (~225 candidates)</option>
                <option value={5}>5 Pages per film (~375 candidates)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-white mb-1.5">
                Matches Limit
              </label>
              <select
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value) || 50)}
                className="w-full text-xs bg-[#14181c] border border-[#2c3440] rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-[#00e054]"
              >
                <option value={25}>Stop at 25 Matches</option>
                <option value={50}>Stop at 50 Matches</option>
                <option value={100}>Stop at 100 Matches</option>
              </select>
            </div>
          </div>

          <div className="flex items-center space-x-2 pt-1">
            <input
              type="checkbox"
              id="scout-bio-checkbox"
              checked={includeBio}
              onChange={(e) => setIncludeBio(e.target.checked)}
              className="rounded bg-[#14181c] border-[#2c3440] text-[#00e054] focus:ring-0 w-4 h-4 cursor-pointer"
            />
            <label htmlFor="scout-bio-checkbox" className="text-xs text-[#99aabb] cursor-pointer">
              Search member profile bio in addition to location field
            </label>
          </div>

          <button
            type="submit"
            disabled={isPending || selectedFilms.length === 0}
            className="w-full bg-gradient-to-r from-[#00e054] to-[#00b844] hover:from-[#00b844] hover:to-[#009e3a] disabled:opacity-50 text-[#0d1114] font-extrabold py-3.5 px-6 rounded-2xl transition duration-150 flex items-center justify-center space-x-2 text-sm sm:text-base cursor-pointer shadow-xl shadow-[#00e054]/15"
          >
            {isPending ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Scouting Letterboxd... ({elapsedSeconds.toFixed(1)}s)</span>
              </>
            ) : (
              <>
                <Search className="w-5 h-5" />
                <span>Start Scout ({selectedFilms.length} {selectedFilms.length === 1 ? "Film" : "Films"})</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Dynamic Scouting Status Panel with Animated Radar */}
      {isPending && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6 border-[#00e054]/40 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2c3440] pb-3">
            <div className="flex items-center space-x-3">
              <span className="relative flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00e054] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#00e054]"></span>
              </span>
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Scouting Letterboxd</span>
                  <span className="text-xs font-mono text-[#00e054]">
                    &bull; {selectedFilms.length} Films in {locations.join(", ")}
                  </span>
                </h4>
                <p className="text-[11px] text-[#99aabb]">
                  Bypassing rate limits & scanning member network across target films and locations
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 bg-[#14181c] px-3 py-1.5 rounded-xl border border-[#2c3440] text-xs font-mono">
              <span className="text-[#667788]">Elapsed:</span>
              <span className="font-bold text-[#00e054]">{elapsedSeconds.toFixed(1)}s</span>
            </div>
          </div>

          {/* Stepper Status Progression */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-1 text-xs">
            <div
              className={`p-3 rounded-xl border flex items-center space-x-2.5 transition ${
                statusStep >= 1
                  ? "bg-[#1b2228] border-[#00e054]/60 text-white"
                  : "bg-[#14181c] border-[#2c3440] text-[#667788]"
              }`}
            >
              {statusStep > 1 ? (
                <CheckCircle2 className="w-4 h-4 text-[#00e054] shrink-0" />
              ) : (
                <Globe className="w-4 h-4 text-[#00e054] animate-pulse shrink-0" />
              )}
              <div className="min-w-0">
                <span className="block font-semibold truncate text-xs">1. Connection</span>
                <span className="text-[10px] text-[#99aabb] block truncate">{selectedFilms.length} target films</span>
              </div>
            </div>

            <div
              className={`p-3 rounded-xl border flex items-center space-x-2.5 transition ${
                statusStep >= 2
                  ? "bg-[#1b2228] border-[#00e054]/60 text-white"
                  : "bg-[#14181c] border-[#2c3440] text-[#667788]"
              }`}
            >
              {statusStep > 2 ? (
                <CheckCircle2 className="w-4 h-4 text-[#00e054] shrink-0" />
              ) : statusStep === 2 ? (
                <Loader2 className="w-4 h-4 text-[#ff8000] animate-spin shrink-0" />
              ) : (
                <Layers className="w-4 h-4 shrink-0" />
              )}
              <div className="min-w-0">
                <span className="block font-semibold truncate text-xs">2. Reviews & Likes</span>
                <span className="text-[10px] text-[#99aabb] block truncate">Parsing {maxPages} pages/film</span>
              </div>
            </div>

            <div
              className={`p-3 rounded-xl border flex items-center space-x-2.5 transition ${
                statusStep >= 3
                  ? "bg-[#1b2228] border-[#00e054]/60 text-white"
                  : "bg-[#14181c] border-[#2c3440] text-[#667788]"
              }`}
            >
              {statusStep > 3 ? (
                <CheckCircle2 className="w-4 h-4 text-[#00e054] shrink-0" />
              ) : statusStep === 3 ? (
                <Loader2 className="w-4 h-4 text-[#40bcf4] animate-spin shrink-0" />
              ) : (
                <Users className="w-4 h-4 shrink-0" />
              )}
              <div className="min-w-0">
                <span className="block font-semibold truncate text-xs">3. Member Profiles</span>
                <span className="text-[10px] text-[#99aabb] block truncate">{locations.join(", ")}</span>
              </div>
            </div>

            <div
              className={`p-3 rounded-xl border flex items-center space-x-2.5 transition ${
                statusStep >= 4
                  ? "bg-[#1b2228] border-[#00e054]/60 text-white"
                  : "bg-[#14181c] border-[#2c3440] text-[#667788]"
              }`}
            >
              {statusStep >= 4 ? (
                <Loader2 className="w-4 h-4 text-[#00e054] animate-spin shrink-0" />
              ) : (
                <Sparkles className="w-4 h-4 shrink-0" />
              )}
              <div className="min-w-0">
                <span className="block font-semibold truncate text-xs">4. Filtering</span>
                <span className="text-[10px] text-[#99aabb] block truncate">Rendering matches</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
