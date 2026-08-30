"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Clapperboard,
  Plus,
  X,
  Sparkles,
  Loader2,
  Globe,
  Layers,
  Users,
  CheckCircle2,
  MapPin,
  Trash2,
} from "lucide-react";
import { useTaste } from "@/lib/taste-context";
import { fetchFilmInfo } from "@/lib/api";
import { FilmSearchResult } from "@/lib/types";
import { FilmCombobox } from "@/components/ui/FilmCombobox";
import UpcomingFeatureModal from "@/components/UpcomingFeatureModal";
import { motion, AnimatePresence } from "framer-motion";

interface TasteFormProps {
  initialFilms: string[];
  initialLocation: string;
  initialMinShared: number;
  initialPages: number;
  initialLimit?: number;
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

export default function TasteForm({
  initialFilms,
  initialLocation,
  initialMinShared,
  initialPages,
  initialLimit = 10,
}: TasteFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { selectedFilms, addFilm, removeFilm, clearFilms } = useTaste();

  const [comboboxValue, setComboboxValue] = useState("");
  const [isAddingFilm, setIsAddingFilm] = useState(false);

  // Multi-location chips state
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

  const [minShared, setMinShared] = useState(initialMinShared || 1);
  const [maxPages, setMaxPages] = useState(initialPages || 2);
  const [limit, setLimit] = useState(initialLimit || 10);

  // Upcoming feature modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalDesc, setModalDesc] = useState("");
  const [modalKey, setModalKey] = useState("");

  const handleDepthChange = (val: string) => {
    if (val === "extended") {
      setModalTitle("Extended Scan Depth");
      setModalDesc(
        "Extended scan depth parses up to 5+ pages of user ratings per film (~400 candidates/film) to discover deeply hidden taste twins. Enter your email to be notified when Extended Tier goes live!"
      );
      setModalKey("extended_scan_depth");
      setModalOpen(true);
      return;
    }
    setMaxPages(2);
  };

  const handleLimitChange = (val: number) => {
    if (val !== 10) {
      setModalTitle(`${val} Matches Limit`);
      setModalDesc(
        `High-volume match scouting (${val} matches) requires dedicated scraper clusters and is currently in early access. Enter your email to join the waitlist!`
      );
      setModalKey(`matches_limit_${val}`);
      setModalOpen(true);
      return;
    }
    setLimit(10);
  };

  // Live status progress
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [statusStep, setStatusStep] = useState(0);

  // Seed initial films on first mount
  useEffect(() => {
    if (initialFilms && initialFilms.length > 0 && selectedFilms.length === 0) {
      initialFilms.forEach((slug) => {
        if (slug) {
        fetchFilmInfo(slug).then((meta) => {
            if (meta && meta.slug) {
              addFilm({
                slug: meta.slug,
                title: meta.title || meta.slug,
                year: meta.year,
                poster_url: meta.poster_url,
              });
            } else {
              addFilm({ slug, title: slug });
          }
        }).catch(() => addFilm({ slug, title: slug }));
        }
      });
    }
  // The initial URL is intentionally hydrated once; addFilm is stable for this mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFilms]);

  // Handle timer during scan
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isPending) {
      // Reset the progress clock when a new transition starts.
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

    const cleanSlug = slug.trim().toLowerCase().replace(/\/+$/, "").split("/").pop() || slug.trim().toLowerCase();
    if (!cleanSlug) return;

    if (selectedFilms.some((f) => f.slug.toLowerCase() === cleanSlug)) {
      setComboboxValue("");
      return;
    }

    setIsAddingFilm(true);

    if (filmMeta) {
      const metaSlug = (filmMeta.slug || cleanSlug).trim().toLowerCase();
      if (!selectedFilms.some((f) => f.slug.toLowerCase() === metaSlug)) {
        addFilm({
          slug: metaSlug,
          title: filmMeta.title || metaSlug,
          year: filmMeta.year,
        });
      }
      setComboboxValue("");
      setIsAddingFilm(false);
      return;
    }

    try {
      const meta = await fetchFilmInfo(cleanSlug);
      if (meta && meta.slug) {
        const resolvedSlug = meta.slug.trim().toLowerCase();
        if (!selectedFilms.some((f) => f.slug.toLowerCase() === resolvedSlug)) {
          addFilm({
            slug: resolvedSlug,
            title: meta.title || resolvedSlug,
            year: meta.year,
            poster_url: meta.poster_url,
          });
        }
      } else {
        addFilm({ slug: cleanSlug, title: cleanSlug.replace("-", " ").replace(/\b\w/g, (c) => c.toUpperCase()) });
      }
    } catch {
      addFilm({ slug: cleanSlug, title: cleanSlug });
    } finally {
      setComboboxValue("");
      setIsAddingFilm(false);
    }
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

    const uniqueSlugs = Array.from(new Set(selectedFilms.map((f) => f.slug.trim()).filter(Boolean)));
    const filmsParam = uniqueSlugs.join(",");
    const locParam = locations.join(",");

    startTransition(() => {
      router.push(
        `/?films=${encodeURIComponent(filmsParam)}&location=${encodeURIComponent(
          locParam
        )}&min_shared=${minShared}&max_pages=${maxPages}&limit=${limit}`
      );
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="glass-card p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Film Matrix Basket */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#00e054]" />
                Taste Matrix Basket ({selectedFilms.length} Selected)
              </label>
              {selectedFilms.length > 0 && (
                <button
                  type="button"
                  onClick={clearFilms}
                  className="text-xs text-[#667788] hover:text-red-400 transition flex items-center space-x-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear all</span>
                </button>
              )}
            </div>

            {/* Selected Chips with Framer Motion Springs */}
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
                    className="inline-flex items-center space-x-2 bg-[#1b2228] border border-[#2c3440] hover:border-[#3d4957] pl-3 pr-2 py-1.5 rounded-xl text-xs font-semibold text-white shadow-sm group"
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
                      onClick={() => removeFilm(film.slug)}
                      className="text-[#667788] hover:text-red-400 p-0.5 rounded-md hover:bg-[#222b33] transition"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>

              {selectedFilms.length === 0 && (
                <span className="text-xs text-[#667788] px-2 italic select-none">
                  No films added yet. Search below or click popular suggestions.
                </span>
              )}
            </div>

            {/* Instant Film Search Combobox */}
            <div className="relative">
              <FilmCombobox
                value={comboboxValue}
                onChange={handleAddFilmFromCombobox}
                placeholder="Search movie title to add to your taste basket..."
                disabled={isAddingFilm}
              />
            </div>

            {/* Quick Popular Suggestions */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-semibold text-[#667788] uppercase tracking-wider block">
                Quick Add Suggestions:
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
                        addFilm({
                          slug: film.slug,
                          title: film.title,
                          year: film.year,
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

            {/* Location Presets */}
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

          {/* Section 3: Fine Tuning Parameters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-[#2c3440]">
            <div>
              <label className="block text-xs font-semibold text-white mb-1.5 flex items-center justify-between">
                <span>Min Shared Films</span>
                <span className="text-[#00e054] font-mono font-bold">{minShared} / {selectedFilms.length || 1}</span>
              </label>
              <select
                value={minShared}
                onChange={(e) => setMinShared(parseInt(e.target.value) || 1)}
                className="w-full text-xs bg-[#14181c] border border-[#2c3440] rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-[#00e054] cursor-pointer"
              >
                {Array.from({ length: Math.max(selectedFilms.length, 1) }, (_, i) => i + 1).map((num) => (
                  <option key={num} value={num}>
                    At least {num} {num === 1 ? "film" : "films"}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-white mb-1.5 flex items-center justify-between">
                <span>Scan Depth</span>
                <span className="text-[#40bcf4] font-mono font-bold">Basic (2 pgs)</span>
              </label>
              <select
                value={maxPages >= 4 ? "extended" : "basic"}
                onChange={(e) => handleDepthChange(e.target.value)}
                className="w-full text-xs bg-[#14181c] border border-[#2c3440] rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-[#00e054] cursor-pointer"
              >
                <option value="basic">Basic (150 candidates/film) — Default</option>
                <option value="extended">Extended (400+ candidates/film) 🔒</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-white mb-1.5 flex items-center justify-between">
                <span>Matches Limit</span>
                <span className="text-[#ff8000] font-mono font-bold">{limit} Matches</span>
              </label>
              <select
                value={limit}
                onChange={(e) => handleLimitChange(parseInt(e.target.value) || 10)}
                className="w-full text-xs bg-[#14181c] border border-[#2c3440] rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-[#00e054] cursor-pointer"
              >
                <option value={10}>10 Matches (Default)</option>
                <option value={25}>25 Matches 🔒</option>
                <option value={50}>50 Matches 🔒</option>
                <option value={100}>100 Matches 🔒</option>
              </select>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isPending || selectedFilms.length === 0}
            className="w-full bg-gradient-to-r from-[#00e054] to-[#00b844] hover:from-[#00b844] hover:to-[#009e3a] disabled:opacity-50 text-[#0d1114] font-extrabold py-3.5 px-6 rounded-2xl transition duration-150 flex items-center justify-center space-x-2 text-sm sm:text-base cursor-pointer shadow-xl shadow-[#00e054]/15"
          >
            {isPending ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Finding Movie Matches... ({elapsedSeconds.toFixed(1)}s)</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                <span>Find Movie Matches ({selectedFilms.length} Films)</span>
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
                  <span>Scanning Taste Graph</span>
                  <span className="text-xs font-mono text-[#00e054]">
                    &bull; {selectedFilms.length} Films across {locations.join(", ")}
                  </span>
                </h4>
                <p className="text-[11px] text-[#99aabb]">
                  Correlating user ratings and favorites via rotating proxy pipeline
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
                <span className="block font-semibold truncate text-xs">1. Matrix Load</span>
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
                <span className="block font-semibold truncate text-xs">2. Film Overlap</span>
                <span className="text-[10px] text-[#99aabb] block truncate">{maxPages} pages / film</span>
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
                <span className="block font-semibold truncate text-xs">3. Profile Match</span>
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
                <span className="block font-semibold truncate text-xs">4. Scoring</span>
                <span className="text-[10px] text-[#99aabb] block truncate">Calculating overlap</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Upcoming Feature Early Access Modal */}
      <UpcomingFeatureModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        featureTitle={modalTitle}
        featureDescription={modalDesc}
        featureKey={modalKey}
      />
    </div>
  );
}
