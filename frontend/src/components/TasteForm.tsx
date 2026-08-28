"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Film,
  Plus,
  X,
  Sparkles,
  Loader2,
  Globe,
  Layers,
  Users,
  CheckCircle2,
} from "lucide-react";
import { useTaste } from "@/lib/taste-context";
import { fetchFilmInfo, searchFilms } from "@/lib/api";
import { FilmSearchResult, SelectedFilmChip } from "@/lib/types";

interface TasteFormProps {
  initialFilms: string[];
  initialLocation: string;
  initialMinShared: number;
  initialPages: number;
}

const PRESET_LOCATIONS = ["Anywhere", "Turkey", "USA", "UK", "Germany"];

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
}: TasteFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { selectedFilms, addFilm, removeFilm, clearFilms } = useTaste();

  const [manualInput, setManualInput] = useState("");
  const [isAddingFilm, setIsAddingFilm] = useState(false);
  const [location, setLocation] = useState(initialLocation || "Anywhere");
  const [minShared, setMinShared] = useState(initialMinShared || 1);
  const [maxPages, setMaxPages] = useState(initialPages || 2);

  // Suggestions dropdown
  const [suggestions, setSuggestions] = useState<FilmSearchResult[]>([]);
  const [isSearchingFilms, setIsSearchingFilms] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Live status progress
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [statusStep, setStatusStep] = useState(0);

  // Debounced search for manual film input
  useEffect(() => {
    const trimmed = manualInput.trim();
    if (!trimmed || trimmed.startsWith("http")) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingFilms(true);
      const results = await searchFilms(trimmed, 6);
      setSuggestions(results);
      setIsSearchingFilms(false);
    }, 250);

    return () => clearTimeout(timer);
  }, [manualInput]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Timer & stage progression while taste match is pending
  useEffect(() => {
    if (!isPending) {
      setElapsedSeconds(0);
      setStatusStep(0);
      return;
    }

    const startTime = Date.now();
    const interval = setInterval(() => {
      const sec = (Date.now() - startTime) / 1000;
      setElapsedSeconds(sec);

      if (sec < 3.0) {
        setStatusStep(1);
      } else if (sec < 8.0) {
        setStatusStep(2);
      } else if (sec < 15.0) {
        setStatusStep(3);
      } else {
        setStatusStep(4);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isPending]);

  const handleAddFilmFromSuggestion = async (filmItem: FilmSearchResult) => {
    const filmObj: SelectedFilmChip = {
      slug: filmItem.slug,
      title: filmItem.title,
      year: filmItem.year || null,
      poster_url: null,
    };

    setIsAddingFilm(true);
    try {
      const meta = await fetchFilmInfo(filmItem.slug);
      if (meta?.poster_url) {
        filmObj.poster_url = meta.poster_url;
      }
    } catch (e) {
      console.warn("Could not fetch film info:", e);
    }

    addFilm(filmObj);
    setManualInput("");
    setIsDropdownOpen(false);
    setIsAddingFilm(false);
  };

  const handleAddManualFilm = async () => {
    const val = manualInput.trim();
    if (!val) return;
    setIsAddingFilm(true);

    const clean = val
      .toLowerCase()
      .replace(/https?:\/\/letterboxd\.com\/film\//, "")
      .replace(/\/$/, "")
      .trim();

    const title = clean
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

    const filmObj: SelectedFilmChip = {
      slug: clean,
      title: title,
      year: null,
      poster_url: null,
    };

    try {
      const meta = await fetchFilmInfo(clean);
      if (meta) {
        if (meta.title) filmObj.title = meta.title;
        if (meta.year !== undefined) filmObj.year = meta.year;
        if (meta.poster_url !== undefined) filmObj.poster_url = meta.poster_url;
      }
    } catch (err) {
      console.warn("Could not fetch film info:", err);
    }

    addFilm(filmObj);
    setManualInput("");
    setIsDropdownOpen(false);
    setIsAddingFilm(false);
  };

  const handleRunMatch = () => {
    if (selectedFilms.length === 0) {
      alert("Please select at least 1 film.");
      return;
    }

    startTransition(() => {
      const filmsParam = selectedFilms.map((f) => f.slug).join(",");
      const params = new URLSearchParams();
      params.set("films", filmsParam);
      params.set("location", location.trim() || "Anywhere");
      params.set("minShared", String(minShared));
      params.set("maxPages", String(maxPages));
      router.push(`/taste?${params.toString()}`);
    });
  };

  const displayedSuggestions =
    suggestions.length > 0 ? suggestions : POPULAR_SUGGESTIONS;

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="solid-card rounded-2xl p-6 sm:p-7 space-y-5">
        {/* Selected Films Queue */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-semibold text-gray-300">
              Selected Target Films ({selectedFilms.length})
            </label>
            {selectedFilms.length > 0 && (
              <button
                type="button"
                onClick={clearFilms}
                className="text-xs text-brand-muted hover:text-red-400 transition cursor-pointer"
              >
                Clear All
              </button>
            )}
          </div>

          <div className="min-h-[52px] p-2.5 bg-brand-darker border border-brand-border rounded-xl flex flex-wrap items-center gap-2">
            {selectedFilms.map((film) => (
              <span
                key={film.slug}
                className="inline-flex items-center space-x-1.5 px-3 py-1 bg-brand-card rounded-lg border border-brand-border text-xs text-white"
              >
                <Film className="w-3 h-3 text-brand-green" />
                <span className="font-semibold">{film.title}</span>
                <button
                  type="button"
                  onClick={() => removeFilm(film.slug)}
                  className="text-brand-muted hover:text-red-400 font-bold ml-1 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {selectedFilms.length === 0 && (
              <span className="text-xs text-brand-muted italic pl-1">
                No films selected yet. Search and pick movies below.
              </span>
            )}
          </div>

          {/* Add Film Slug/URL Input with Dropdown */}
          <div className="mt-2.5 relative" ref={dropdownRef}>
            <div className="flex gap-2">
              <div className="relative flex-grow">
                <input
                  type="text"
                  value={manualInput}
                  onChange={(e) => {
                    setManualInput(e.target.value);
                    setIsDropdownOpen(true);
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddManualFilm();
                    }
                  }}
                  placeholder="Search film title or slug (e.g. alien, sunshine-2007)..."
                  className="w-full text-xs bg-brand-darker border border-brand-border rounded-xl px-3 py-2 text-white placeholder-brand-muted focus:outline-none glow-focus pr-8"
                />
                <div className="absolute right-2.5 top-2.5 text-brand-muted pointer-events-none">
                  {isSearchingFilms ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-green" />
                  ) : null}
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddManualFilm}
                disabled={isAddingFilm || !manualInput.trim()}
                className="px-4 py-2 bg-brand-card hover:bg-brand-cardHover disabled:opacity-50 border border-brand-border rounded-xl text-xs font-semibold text-white transition flex items-center space-x-1 cursor-pointer"
              >
                {isAddingFilm ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                <span>Add</span>
              </button>
            </div>

            {/* Dropdown Suggestions */}
            {isDropdownOpen && (
              <div className="absolute z-50 left-0 right-16 mt-1 bg-brand-card border border-brand-borderLight rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto">
                <div className="p-2 border-b border-brand-border bg-brand-darker/60 flex items-center justify-between text-[11px] text-brand-muted px-3">
                  <span className="font-semibold">
                    {suggestions.length > 0
                      ? `Matching Films (${suggestions.length})`
                      : "Suggested Films"}
                  </span>
                </div>
                <ul className="py-1 divide-y divide-brand-border/40">
                  {displayedSuggestions.map((item) => (
                    <li key={item.slug}>
                      <button
                        type="button"
                        onClick={() => handleAddFilmFromSuggestion(item)}
                        className="w-full text-left px-3.5 py-2 flex items-center justify-between hover:bg-brand-darker text-gray-300 hover:text-white transition cursor-pointer text-xs"
                      >
                        <div className="truncate pr-2">
                          <span className="font-bold text-white mr-1.5">{item.title}</span>
                          {item.year && (
                            <span className="text-[10px] text-brand-subtext font-mono">
                              ({item.year})
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-brand-green">
                          + Add
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Query Parameters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-brand-border">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-gray-300">Target Location</label>
              <button
                type="button"
                onClick={() => setLocation("Anywhere")}
                className="text-[10px] text-brand-green hover:underline cursor-pointer"
              >
                Set Anywhere
              </button>
            </div>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Anywhere, Turkey, Berlin..."
              className="w-full text-xs bg-brand-darker border border-brand-border rounded-xl px-3 py-2.5 text-white placeholder-brand-muted focus:outline-none glow-focus"
            />
            <div className="flex flex-wrap gap-1 mt-1.5">
              {PRESET_LOCATIONS.map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => setLocation(loc)}
                  className={`px-2 py-0.5 rounded border text-[10px] transition cursor-pointer ${
                    location.toLowerCase() === loc.toLowerCase()
                      ? "bg-brand-green text-black font-bold border-brand-green"
                      : "bg-brand-darker text-brand-subtext border-brand-border hover:text-white"
                  }`}
                >
                  {loc}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">Min Shared Films</label>
            <select
              value={minShared}
              onChange={(e) => setMinShared(parseInt(e.target.value) || 1)}
              className="w-full text-xs bg-brand-darker border border-brand-border rounded-xl px-3 py-2.5 text-white focus:outline-none glow-focus"
            >
              <option value={1}>Match at least 1 film</option>
              <option value={2}>Match at least 2 films (Overlap)</option>
              <option value={3}>Match at least 3 films</option>
              <option value={4}>Match all 4 films</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">Scan Depth</label>
            <select
              value={maxPages}
              onChange={(e) => setMaxPages(parseInt(e.target.value) || 2)}
              className="w-full text-xs bg-brand-darker border border-brand-border rounded-xl px-3 py-2.5 text-white focus:outline-none glow-focus"
            >
              <option value={1}>Quick (1 Page per film)</option>
              <option value={2}>Balanced (2 Pages per film)</option>
              <option value={3}>Deep (3 Pages per film)</option>
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={handleRunMatch}
          disabled={isPending || selectedFilms.length === 0}
          className="w-full bg-brand-green hover:bg-brand-greenHover disabled:opacity-50 text-black font-bold py-3 px-6 rounded-xl transition duration-150 flex items-center justify-center space-x-2 text-sm cursor-pointer shadow-lg shadow-brand-green/10"
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Scouting Taste Soulmates... ({elapsedSeconds.toFixed(1)}s)</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Discover Taste Soulmates</span>
            </>
          )}
        </button>
      </div>

      {/* Dynamic Status Progress for Taste Soulmates */}
      {isPending && (
        <div className="solid-card rounded-2xl p-5 sm:p-6 border-brand-green/40 bg-brand-darker/90 backdrop-blur space-y-4 animate-in fade-in slide-in-from-top-3 duration-200">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-border pb-3">
            <div className="flex items-center space-x-2.5">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-green opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-brand-green"></span>
              </span>
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <span>Calculating Multi-Film Taste Overlap</span>
                  <span className="text-xs font-mono text-brand-green">
                    &bull; {selectedFilms.length} films in &quot;{location}&quot;
                  </span>
                </h4>
                <p className="text-[11px] text-brand-subtext">
                  Cross-referencing members across multiple film fanbases
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 bg-brand-card px-3 py-1.5 rounded-xl border border-brand-border text-xs font-mono">
              <span className="text-brand-muted">Elapsed:</span>
              <span className="font-bold text-brand-green">{elapsedSeconds.toFixed(1)}s</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-1 text-xs">
            <div
              className={`p-2.5 rounded-xl border flex items-center space-x-2 transition ${
                statusStep >= 1
                  ? "bg-brand-card border-brand-green/60 text-white"
                  : "bg-brand-darker border-brand-border text-brand-muted"
              }`}
            >
              {statusStep > 1 ? (
                <CheckCircle2 className="w-4 h-4 text-brand-green shrink-0" />
              ) : (
                <Globe className="w-4 h-4 text-brand-green animate-pulse shrink-0" />
              )}
              <div className="min-w-0">
                <span className="block font-semibold truncate text-[11px]">1. Film Targets</span>
                <span className="text-[10px] text-brand-subtext block truncate">{selectedFilms.length} films queued</span>
              </div>
            </div>

            <div
              className={`p-2.5 rounded-xl border flex items-center space-x-2 transition ${
                statusStep >= 2
                  ? "bg-brand-card border-brand-green/60 text-white"
                  : "bg-brand-darker border-brand-border text-brand-muted"
              }`}
            >
              {statusStep > 2 ? (
                <CheckCircle2 className="w-4 h-4 text-brand-green shrink-0" />
              ) : statusStep === 2 ? (
                <Loader2 className="w-4 h-4 text-brand-orange animate-spin shrink-0" />
              ) : (
                <Layers className="w-4 h-4 shrink-0" />
              )}
              <div className="min-w-0">
                <span className="block font-semibold truncate text-[11px]">2. Cross-Scraping</span>
                <span className="text-[10px] text-brand-subtext block truncate">Scanning ratings</span>
              </div>
            </div>

            <div
              className={`p-2.5 rounded-xl border flex items-center space-x-2 transition ${
                statusStep >= 3
                  ? "bg-brand-card border-brand-green/60 text-white"
                  : "bg-brand-darker border-brand-border text-brand-muted"
              }`}
            >
              {statusStep > 3 ? (
                <CheckCircle2 className="w-4 h-4 text-brand-green shrink-0" />
              ) : statusStep === 3 ? (
                <Loader2 className="w-4 h-4 text-brand-blue animate-spin shrink-0" />
              ) : (
                <Users className="w-4 h-4 shrink-0" />
              )}
              <div className="min-w-0">
                <span className="block font-semibold truncate text-[11px]">3. Geo Matching</span>
                <span className="text-[10px] text-brand-subtext block truncate">Filtering {location}</span>
              </div>
            </div>

            <div
              className={`p-2.5 rounded-xl border flex items-center space-x-2 transition ${
                statusStep >= 4
                  ? "bg-brand-card border-brand-green/60 text-white"
                  : "bg-brand-darker border-brand-border text-brand-muted"
              }`}
            >
              {statusStep >= 4 ? (
                <Loader2 className="w-4 h-4 text-brand-green animate-spin shrink-0" />
              ) : (
                <Sparkles className="w-4 h-4 shrink-0" />
              )}
              <div className="min-w-0">
                <span className="block font-semibold truncate text-[11px]">4. Compatibility</span>
                <span className="text-[10px] text-brand-subtext block truncate">Ranking soulmates</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
