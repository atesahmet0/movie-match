"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Loader2,
  Film,
  Sparkles,
  MapPin,
  CheckCircle2,
  Globe,
  Users,
  Layers,
  ChevronDown,
} from "lucide-react";
import { searchFilms } from "@/lib/api";
import { FilmSearchResult } from "@/lib/types";

interface ScoutFormProps {
  initialFilm: string;
  initialLocation: string;
  initialSentiment: string;
  initialPages: number;
  initialLimit: number;
  initialIncludeBio: boolean;
}

const PRESET_LOCATIONS = ["Anywhere", "Turkey", "USA", "UK", "Germany"];

const POPULAR_SUGGESTIONS: FilmSearchResult[] = [
  { slug: "vampire-hunter-d-bloodlust", title: "Vampire Hunter D: Bloodlust", year: 2000, director: "Yoshiaki Kawajiri", film_url: "https://letterboxd.com/film/vampire-hunter-d-bloodlust/" },
  { slug: "alien", title: "Alien", year: 1979, director: "Ridley Scott", film_url: "https://letterboxd.com/film/alien/" },
  { slug: "interstellar", title: "Interstellar", year: 2014, director: "Christopher Nolan", film_url: "https://letterboxd.com/film/interstellar/" },
  { slug: "the-substance", title: "The Substance", year: 2024, director: "Coralie Fargeat", film_url: "https://letterboxd.com/film/the-substance/" },
  { slug: "fight-club", title: "Fight Club", year: 1999, director: "David Fincher", film_url: "https://letterboxd.com/film/fight-club/" },
  { slug: "dune-part-two", title: "Dune: Part Two", year: 2024, director: "Denis Villeneuve", film_url: "https://letterboxd.com/film/dune-part-two/" },
  { slug: "spirited-away", title: "Spirited Away", year: 2001, director: "Hayao Miyazaki", film_url: "https://letterboxd.com/film/spirited-away/" },
  { slug: "parasite-2019", title: "Parasite", year: 2019, director: "Bong Joon-ho", film_url: "https://letterboxd.com/film/parasite-2019/" },
];

export default function ScoutForm({
  initialFilm,
  initialLocation,
  initialSentiment,
  initialPages,
  initialLimit,
  initialIncludeBio,
}: ScoutFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [film, setFilm] = useState(initialFilm || "vampire-hunter-d-bloodlust");
  const [location, setLocation] = useState(initialLocation || "Anywhere");
  const [sentiment, setSentiment] = useState(initialSentiment || "liked");
  const [maxPages, setMaxPages] = useState(initialPages || 3);
  const [limit, setLimit] = useState(initialLimit || 50);
  const [includeBio, setIncludeBio] = useState(initialIncludeBio ?? true);

  // Dropdown Autocomplete state
  const [suggestions, setSuggestions] = useState<FilmSearchResult[]>([]);
  const [isSearchingFilms, setIsSearchingFilms] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Scouting status state
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [statusStep, setStatusStep] = useState(0);

  // Debounced search on film input
  useEffect(() => {
    const trimmed = film.trim();
    if (!trimmed || trimmed.startsWith("http")) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingFilms(true);
      const results = await searchFilms(trimmed, 8);
      setSuggestions(results);
      setIsSearchingFilms(false);
    }, 250);

    return () => clearTimeout(timer);
  }, [film]);

  // Click outside listener for dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Timer & stage progression while scouting is pending
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

      if (sec < 2.5) {
        setStatusStep(1); // Connecting & resolving
      } else if (sec < 6.0) {
        setStatusStep(2); // Extracting interactions & ratings
      } else if (sec < 11.0) {
        setStatusStep(3); // Scanning candidate member profiles & locations
      } else {
        setStatusStep(4); // Aggregating & ranking
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isPending]);

  const handleSelectSuggestion = (selected: FilmSearchResult) => {
    setFilm(selected.slug);
    setIsDropdownOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const currentList = suggestions.length > 0 ? suggestions : POPULAR_SUGGESTIONS;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIsDropdownOpen(true);
      setHighlightedIndex((prev) => (prev < currentList.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIsDropdownOpen(true);
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : currentList.length - 1));
    } else if (e.key === "Enter" && isDropdownOpen && highlightedIndex >= 0) {
      e.preventDefault();
      if (currentList[highlightedIndex]) {
        handleSelectSuggestion(currentList[highlightedIndex]);
      }
    } else if (e.key === "Escape") {
      setIsDropdownOpen(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!film.trim()) return;
    setIsDropdownOpen(false);

    startTransition(() => {
      const cleanSlug = film
        .toLowerCase()
        .replace(/https?:\/\/letterboxd\.com\/film\//, "")
        .replace(/\/$/, "")
        .trim();

      const params = new URLSearchParams();
      params.set("film", cleanSlug);
      params.set("location", location.trim() || "Anywhere");
      params.set("sentiment", sentiment);
      params.set("max_pages", String(maxPages));
      params.set("limit", String(limit));
      params.set("include_bio", String(includeBio));
      router.push(`/scout?${params.toString()}`);
    });
  };

  const displayedSuggestions =
    suggestions.length > 0
      ? suggestions
      : !film.trim() || film === "vampire-hunter-d-bloodlust"
      ? POPULAR_SUGGESTIONS
      : [];

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="solid-card rounded-2xl p-6 sm:p-7 relative">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Film Input with Dynamic Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-gray-300">
                  Film URL, Slug, or Title
                </label>
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen((prev) => !prev)}
                  className="text-[10px] text-brand-green hover:underline flex items-center space-x-0.5 cursor-pointer"
                >
                  <span>Popular films</span>
                  <ChevronDown className="w-3 h-3" />
                </button>
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={film}
                  onChange={(e) => {
                    setFilm(e.target.value);
                    setIsDropdownOpen(true);
                    setHighlightedIndex(-1);
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                  onKeyDown={handleKeyDown}
                  required
                  placeholder="e.g. alien, interstellar, vampire-hunter-d..."
                  className="w-full bg-brand-darker border border-brand-border rounded-xl px-4 py-2.5 text-white placeholder-brand-muted focus:outline-none glow-focus text-sm font-medium pr-9"
                  autoComplete="off"
                />
                <div className="absolute right-3 top-3 text-brand-muted pointer-events-none">
                  {isSearchingFilms ? (
                    <Loader2 className="w-4 h-4 animate-spin text-brand-green" />
                  ) : (
                    <Film className="w-4 h-4" />
                  )}
                </div>
              </div>

              {/* Dynamic Dropdown Menu */}
              {isDropdownOpen && (
                <div className="absolute z-50 left-0 right-0 mt-1.5 bg-brand-card border border-brand-borderLight rounded-xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto animate-in fade-in-50 duration-100">
                  <div className="p-2 border-b border-brand-border bg-brand-darker/60 flex items-center justify-between text-[11px] text-brand-muted px-3">
                    <span className="font-semibold">
                      {suggestions.length > 0
                        ? `Matching Letterboxd Films (${suggestions.length})`
                        : "Popular & Suggested Films"}
                    </span>
                    <span className="text-[10px] font-mono">Use ↑↓ & Enter</span>
                  </div>

                  <ul className="py-1 divide-y divide-brand-border/40">
                    {displayedSuggestions.map((item, idx) => (
                      <li key={item.slug}>
                        <button
                          type="button"
                          onClick={() => handleSelectSuggestion(item)}
                          onMouseEnter={() => setHighlightedIndex(idx)}
                          className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between transition cursor-pointer ${
                            highlightedIndex === idx
                              ? "bg-brand-darker text-white border-l-2 border-brand-green pl-3"
                              : "text-gray-300 hover:bg-brand-darker hover:text-white"
                          }`}
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-xs text-white truncate">
                                {item.title}
                              </span>
                              {item.year && (
                                <span className="text-[10px] font-mono px-1.5 py-0.2 bg-brand-darker text-brand-subtext rounded border border-brand-border">
                                  {item.year}
                                </span>
                              )}
                            </div>
                            {item.director && (
                              <p className="text-[11px] text-brand-subtext truncate mt-0.5">
                                dir. {item.director}
                              </p>
                            )}
                          </div>
                          <span className="text-[10px] font-mono text-brand-green opacity-80 shrink-0">
                            /{item.slug}
                          </span>
                        </button>
                      </li>
                    ))}

                    {displayedSuggestions.length === 0 && !isSearchingFilms && (
                      <li className="px-4 py-4 text-center text-xs text-brand-subtext">
                        No films found matching &quot;{film}&quot;. You can still scout with this slug directly.
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>

            {/* Target Location Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-gray-300">
                  Location Query
                </label>
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
                placeholder="e.g. Anywhere, Turkey, Ankara, Berlin..."
                className="w-full bg-brand-darker border border-brand-border rounded-xl px-4 py-2.5 text-white placeholder-brand-muted focus:outline-none glow-focus text-sm"
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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-brand-border">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Sentiment Filter
              </label>
              <select
                value={sentiment}
                onChange={(e) => setSentiment(e.target.value)}
                className="w-full text-xs bg-brand-darker border border-brand-border rounded-xl px-3 py-2.5 text-white focus:outline-none glow-focus"
              >
                <option value="liked">Liked / High Rating (4-5 Stars)</option>
                <option value="disliked">Disliked / Low Rating (0.5-2 Stars)</option>
                <option value="all">All Members (Watched / Rated)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Scan Depth
              </label>
              <select
                value={maxPages}
                onChange={(e) => setMaxPages(parseInt(e.target.value) || 3)}
                className="w-full text-xs bg-brand-darker border border-brand-border rounded-xl px-3 py-2.5 text-white focus:outline-none glow-focus"
              >
                <option value={2}>2 Pages (~150 candidates)</option>
                <option value={3}>3 Pages (~225 candidates)</option>
                <option value={5}>5 Pages (~375 candidates)</option>
                <option value={10}>10 Pages (~750 candidates)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Matches Limit
              </label>
              <select
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value) || 50)}
                className="w-full text-xs bg-brand-darker border border-brand-border rounded-xl px-3 py-2.5 text-white focus:outline-none glow-focus"
              >
                <option value={25}>Stop at 25 Matches</option>
                <option value={50}>Stop at 50 Matches</option>
                <option value={100}>Stop at 100 Matches</option>
              </select>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="scout-bio-checkbox"
              checked={includeBio}
              onChange={(e) => setIncludeBio(e.target.checked)}
              className="rounded bg-brand-darker border-brand-border text-brand-green focus:ring-0 w-4 h-4 cursor-pointer"
            />
            <label htmlFor="scout-bio-checkbox" className="text-xs text-gray-300 cursor-pointer">
              Search member profile bio in addition to location field
            </label>
          </div>

          <button
            type="submit"
            disabled={isPending || !film.trim()}
            className="w-full bg-brand-green hover:bg-brand-greenHover disabled:opacity-50 text-black font-bold py-3 px-6 rounded-xl transition duration-150 flex items-center justify-center space-x-2 text-sm cursor-pointer shadow-lg shadow-brand-green/10"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Scouting Letterboxd... ({elapsedSeconds.toFixed(1)}s)</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Start Scout</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Dynamic Scouting Status Panel (Displayed during active search) */}
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
                  <span>Scouting Letterboxd</span>
                  <span className="text-xs font-mono text-brand-green">
                    &bull; {film} in &quot;{location}&quot;
                  </span>
                </h4>
                <p className="text-[11px] text-brand-subtext">
                  Bypassing anti-bot verification & scanning member network
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 bg-brand-card px-3 py-1.5 rounded-xl border border-brand-border text-xs font-mono">
              <span className="text-brand-muted">Elapsed:</span>
              <span className="font-bold text-brand-green">{elapsedSeconds.toFixed(1)}s</span>
            </div>
          </div>

          {/* Stepper Status Progression */}
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
                <span className="block font-semibold truncate text-[11px]">1. Connection</span>
                <span className="text-[10px] text-brand-subtext block truncate">Letterboxd target</span>
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
                <span className="block font-semibold truncate text-[11px]">2. Reviews & Likes</span>
                <span className="text-[10px] text-brand-subtext block truncate">Parsing {maxPages} pages</span>
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
                <span className="block font-semibold truncate text-[11px]">3. Member Profiles</span>
                <span className="text-[10px] text-brand-subtext block truncate">Matching {location}</span>
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
                <span className="block font-semibold truncate text-[11px]">4. Filtering</span>
                <span className="text-[10px] text-brand-subtext block truncate">Rendering results</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
