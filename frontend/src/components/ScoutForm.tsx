"use client";

import { useState, useEffect, useRef, useTransition } from "react";
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
  ChevronDown,
  Plus,
  X,
} from "lucide-react";
import { searchFilms } from "@/lib/api";
import { FilmSearchResult, SelectedFilmChip } from "@/lib/types";

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
  {
    slug: "vampire-hunter-d-bloodlust",
    title: "Vampire Hunter D: Bloodlust",
    year: 2000,
    director: "Yoshiaki Kawajiri",
    film_url: "https://letterboxd.com/film/vampire-hunter-d-bloodlust/",
  },
  {
    slug: "alien",
    title: "Alien",
    year: 1979,
    director: "Ridley Scott",
    film_url: "https://letterboxd.com/film/alien/",
  },
  {
    slug: "interstellar",
    title: "Interstellar",
    year: 2014,
    director: "Christopher Nolan",
    film_url: "https://letterboxd.com/film/interstellar/",
  },
  {
    slug: "the-substance",
    title: "The Substance",
    year: 2024,
    director: "Coralie Fargeat",
    film_url: "https://letterboxd.com/film/the-substance/",
  },
  {
    slug: "fight-club",
    title: "Fight Club",
    year: 1999,
    director: "David Fincher",
    film_url: "https://letterboxd.com/film/fight-club/",
  },
  {
    slug: "dune-part-two",
    title: "Dune: Part Two",
    year: 2024,
    director: "Denis Villeneuve",
    film_url: "https://letterboxd.com/film/dune-part-two/",
  },
  {
    slug: "spirited-away",
    title: "Spirited Away",
    year: 2001,
    director: "Hayao Miyazaki",
    film_url: "https://letterboxd.com/film/spirited-away/",
  },
  {
    slug: "parasite-2019",
    title: "Parasite",
    year: 2019,
    director: "Bong Joon-ho",
    film_url: "https://letterboxd.com/film/parasite-2019/",
  },
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

  // Multi-films state
  const parseInitialFilms = (list: string[]): SelectedFilmChip[] => {
    if (!list || list.length === 0) {
      return [
        {
          slug: "vampire-hunter-d-bloodlust",
          title: "Vampire Hunter D: Bloodlust",
          year: 2000,
          poster_url: null,
        },
      ];
    }
    return list.map((slug) => ({
      slug,
      title: slug
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase()),
      year: null,
      poster_url: null,
    }));
  };

  const [selectedFilms, setSelectedFilms] = useState<SelectedFilmChip[]>(
    parseInitialFilms(initialFilms)
  );
  const [filmInput, setFilmInput] = useState("");

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
    const trimmed = filmInput.trim();
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
  }, [filmInput]);

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

  // Film Handlers
  const handleAddFilmItem = (item: FilmSearchResult) => {
    const exists = selectedFilms.some((f) => f.slug.toLowerCase() === item.slug.toLowerCase());
    if (!exists) {
      setSelectedFilms((prev) => [
        ...prev,
        {
          slug: item.slug,
          title: item.title,
          year: item.year || null,
          poster_url: null,
        },
      ]);
    }
    setFilmInput("");
    setIsDropdownOpen(false);
    setHighlightedIndex(-1);
  };

  const handleAddManualFilm = (raw: string) => {
    const clean = raw
      .toLowerCase()
      .replace(/https?:\/\/letterboxd\.com\/film\//, "")
      .replace(/\/$/, "")
      .trim();

    if (!clean) return;
    const exists = selectedFilms.some((f) => f.slug.toLowerCase() === clean.toLowerCase());
    if (!exists) {
      setSelectedFilms((prev) => [
        ...prev,
        {
          slug: clean,
          title: clean
            .replace(/-/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase()),
          year: null,
          poster_url: null,
        },
      ]);
    }
    setFilmInput("");
    setIsDropdownOpen(false);
    setHighlightedIndex(-1);
  };

  const handleRemoveFilm = (slug: string) => {
    setSelectedFilms((prev) => prev.filter((f) => f.slug !== slug));
  };

  const handleClearFilms = () => {
    setSelectedFilms([]);
  };

  const handleFilmKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const currentList = suggestions.length > 0 ? suggestions : POPULAR_SUGGESTIONS;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIsDropdownOpen(true);
      setHighlightedIndex((prev) => (prev < currentList.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIsDropdownOpen(true);
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : currentList.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (isDropdownOpen && highlightedIndex >= 0 && currentList[highlightedIndex]) {
        handleAddFilmItem(currentList[highlightedIndex]);
      } else if (filmInput.trim()) {
        handleAddManualFilm(filmInput);
      }
    } else if (e.key === "Escape") {
      setIsDropdownOpen(false);
    } else if (e.key === "Backspace" && !filmInput && selectedFilms.length > 0) {
      handleRemoveFilm(selectedFilms[selectedFilms.length - 1].slug);
    }
  };

  // Location chip handlers
  const handleAddLocation = (locName: string) => {
    const clean = locName.trim().replace(/^[,]+|[,]+$/g, "");
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

  const handleRemoveLocation = (locName: string) => {
    setLocations((prev) => {
      const updated = prev.filter((l) => l !== locName);
      return updated.length > 0 ? updated : ["Anywhere"];
    });
  };

  const handleTogglePresetLocation = (preset: string) => {
    if (preset.toLowerCase() === "anywhere") {
      setLocations(["Anywhere"]);
      return;
    }

    setLocations((prev) => {
      const filtered = prev.filter((l) => l.toLowerCase() !== "anywhere");
      const exists = filtered.some((l) => l.toLowerCase() === preset.toLowerCase());
      if (exists) {
        const next = filtered.filter((l) => l.toLowerCase() !== preset.toLowerCase());
        return next.length > 0 ? next : ["Anywhere"];
      } else {
        return [...filtered, preset];
      }
    });
  };

  const isPresetActive = (preset: string) => {
    return locations.some((l) => l.toLowerCase() === preset.toLowerCase());
  };

  const handleLocationInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      handleAddLocation(locationInput);
    } else if (e.key === "Backspace" && !locationInput && locations.length > 0) {
      handleRemoveLocation(locations[locations.length - 1]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let finalFilms = [...selectedFilms];
    if (filmInput.trim()) {
      const clean = filmInput
        .toLowerCase()
        .replace(/https?:\/\/letterboxd\.com\/film\//, "")
        .replace(/\/$/, "")
        .trim();
      if (!finalFilms.some((f) => f.slug.toLowerCase() === clean)) {
        finalFilms.push({
          slug: clean,
          title: clean.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          year: null,
          poster_url: null,
        });
      }
    }

    if (finalFilms.length === 0) {
      alert("Please add at least 1 film to scout.");
      return;
    }

    let finalLocations = [...locations];
    if (locationInput.trim()) {
      const clean = locationInput.trim();
      if (clean.toLowerCase() === "anywhere") {
        finalLocations = ["Anywhere"];
      } else {
        const filtered = finalLocations.filter((l) => l.toLowerCase() !== "anywhere");
        if (!filtered.some((l) => l.toLowerCase() === clean.toLowerCase())) {
          finalLocations = [...filtered, clean];
        }
      }
    }

    setIsDropdownOpen(false);

    startTransition(() => {
      const filmsParam = finalFilms.map((f) => f.slug).join(",");
      const locationParam = finalLocations.join(",");

      const params = new URLSearchParams();
      params.set("films", filmsParam);
      params.set("location", locationParam || "Anywhere");
      params.set("sentiment", sentiment);
      params.set("max_pages", String(maxPages));
      params.set("limit", String(limit));
      params.set("include_bio", String(includeBio));
      router.push(`/scout?${params.toString()}`);
    });
  };

  const displayedSuggestions =
    suggestions.length > 0 ? suggestions : POPULAR_SUGGESTIONS;

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="solid-card rounded-2xl p-6 sm:p-7 relative">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Multi-Film Selection with Dynamic Autocomplete */}
            <div className="relative" ref={dropdownRef}>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-gray-300">
                  Target Films ({selectedFilms.length})
                </label>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsDropdownOpen((prev) => !prev)}
                    className="text-[10px] text-brand-green hover:underline flex items-center space-x-1 cursor-pointer"
                  >
                    <Clapperboard className="w-3 h-3" />
                    <span>Popular films</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {selectedFilms.length > 1 && (
                    <button
                      type="button"
                      onClick={handleClearFilms}
                      className="text-[10px] text-brand-muted hover:text-red-400 cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Films Chips Box */}
              <div className="min-h-[42px] p-2 bg-brand-darker border border-brand-border rounded-xl flex flex-wrap items-center gap-1.5 focus-within:border-brand-green focus-within:ring-1 focus-within:ring-brand-green transition">
                {selectedFilms.map((film) => (
                  <span
                    key={film.slug}
                    className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-brand-card text-brand-green border border-brand-green/30 transition shadow-sm"
                  >
                    <Clapperboard className="w-3 h-3 text-brand-green shrink-0" />
                    <span className="truncate max-w-[150px]">{film.title}</span>
                    {film.year && (
                      <span className="text-[10px] font-mono text-brand-subtext">
                        ({film.year})
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveFilm(film.slug)}
                      className="text-brand-muted hover:text-red-400 ml-0.5 p-0.5 rounded transition cursor-pointer"
                      title={`Remove ${film.title}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}

                <input
                  type="text"
                  value={filmInput}
                  onChange={(e) => {
                    setFilmInput(e.target.value);
                    setIsDropdownOpen(true);
                    setHighlightedIndex(-1);
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                  onKeyDown={handleFilmKeyDown}
                  placeholder={
                    selectedFilms.length === 0
                      ? "Search film title or slug..."
                      : "+ Add another film..."
                  }
                  className="flex-grow min-w-[120px] bg-transparent text-xs text-white placeholder-brand-muted focus:outline-none py-1 px-1 font-medium"
                  autoComplete="off"
                />

                <div className="flex items-center pr-1 text-brand-green">
                  {isSearchingFilms ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : null}
                </div>
              </div>

              {/* Dynamic Dropdown Menu */}
              {isDropdownOpen && (
                <div className="absolute z-50 left-0 right-0 mt-1.5 bg-brand-card border border-brand-borderLight rounded-xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto animate-in fade-in-50 duration-100">
                  <div className="p-2 border-b border-brand-border bg-brand-darker/60 flex items-center justify-between text-[11px] text-brand-muted px-3">
                    <span className="font-semibold flex items-center gap-1.5 text-gray-300">
                      <Clapperboard className="w-3.5 h-3.5 text-brand-green" />
                      {suggestions.length > 0
                        ? `Matching Films (${suggestions.length})`
                        : "Popular & Suggested Films"}
                    </span>
                    <span className="text-[10px] font-mono">Use ↑↓ & Enter to add</span>
                  </div>

                  <ul className="py-1 divide-y divide-brand-border/40">
                    {displayedSuggestions.map((item, idx) => (
                      <li key={item.slug}>
                        <button
                          type="button"
                          onClick={() => handleAddFilmItem(item)}
                          onMouseEnter={() => setHighlightedIndex(idx)}
                          className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between transition cursor-pointer ${
                            highlightedIndex === idx
                              ? "bg-brand-darker text-white border-l-2 border-brand-green pl-3"
                              : "text-gray-300 hover:bg-brand-darker hover:text-white"
                          }`}
                        >
                          <div className="min-w-0 flex-1 pr-2 flex items-start space-x-2">
                            <Clapperboard className="w-4 h-4 text-brand-green/70 shrink-0 mt-0.5" />
                            <div className="min-w-0">
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
                          </div>
                          <span className="text-[10px] font-mono text-brand-green opacity-80 shrink-0">
                            + Add Film
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Target Location Field with Multiple Chips */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-gray-300">
                  Target Locations ({locations.length})
                </label>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setLocations(["Anywhere"])}
                    className="text-[10px] text-brand-green hover:underline cursor-pointer"
                  >
                    Set Anywhere
                  </button>
                  {locations.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setLocations(["Anywhere"])}
                      className="text-[10px] text-brand-muted hover:text-red-400 cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Chips Input Box */}
              <div className="min-h-[42px] p-2 bg-brand-darker border border-brand-border rounded-xl flex flex-wrap items-center gap-1.5 focus-within:border-brand-green focus-within:ring-1 focus-within:ring-brand-green transition">
                {locations.map((loc) => (
                  <span
                    key={loc}
                    className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                      loc.toLowerCase() === "anywhere"
                        ? "bg-brand-card text-brand-blue border-brand-blue/30"
                        : "bg-brand-card text-brand-green border-brand-green/30"
                    }`}
                  >
                    {loc.toLowerCase() === "anywhere" ? (
                      <Globe className="w-3 h-3 text-brand-blue shrink-0" />
                    ) : (
                      <MapPin className="w-3 h-3 text-brand-green shrink-0" />
                    )}
                    <span>{loc}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveLocation(loc)}
                      className="text-brand-muted hover:text-red-400 ml-0.5 p-0.5 rounded transition cursor-pointer"
                      title={`Remove ${loc}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}

                <input
                  type="text"
                  value={locationInput}
                  onChange={(e) => setLocationInput(e.target.value)}
                  onKeyDown={handleLocationInputKeyDown}
                  placeholder={
                    locations.length === 0
                      ? "Add location (e.g. Ankara, Berlin)..."
                      : "+ Add location..."
                  }
                  className="flex-grow min-w-[110px] bg-transparent text-xs text-white placeholder-brand-muted focus:outline-none py-1 px-1 font-medium"
                />

                {locationInput.trim() && (
                  <button
                    type="button"
                    onClick={() => handleAddLocation(locationInput)}
                    className="px-2 py-0.5 bg-brand-card hover:bg-brand-cardHover border border-brand-border rounded text-[10px] text-brand-green font-bold flex items-center space-x-0.5 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add</span>
                  </button>
                )}
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap gap-1 mt-2">
                {PRESET_LOCATIONS.map((loc) => {
                  const active = isPresetActive(loc);
                  return (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => handleTogglePresetLocation(loc)}
                      className={`px-2 py-0.5 rounded border text-[10px] transition cursor-pointer flex items-center space-x-1 ${
                        active
                          ? "bg-brand-green text-black font-bold border-brand-green"
                          : "bg-brand-darker text-brand-subtext border-brand-border hover:text-white"
                      }`}
                    >
                      <span>{loc}</span>
                      {active && <CheckCircle2 className="w-2.5 h-2.5 text-black" />}
                    </button>
                  );
                })}
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
                <option value={2}>2 Pages per film (~150 candidates)</option>
                <option value={3}>3 Pages per film (~225 candidates)</option>
                <option value={5}>5 Pages per film (~375 candidates)</option>
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
            disabled={isPending || selectedFilms.length === 0}
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
                <span>Start Scout ({selectedFilms.length} {selectedFilms.length === 1 ? "Film" : "Films"})</span>
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
                    &bull; {selectedFilms.map((f) => f.title).join(", ")} in {locations.join(", ")}
                  </span>
                </h4>
                <p className="text-[11px] text-brand-subtext">
                  Bypassing anti-bot verification & scanning member network across {selectedFilms.length} target films and {locations.length} locations
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
                <span className="text-[10px] text-brand-subtext block truncate">{selectedFilms.length} target films</span>
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
                <span className="text-[10px] text-brand-subtext block truncate">Parsing {maxPages} pages/film</span>
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
                <span className="text-[10px] text-brand-subtext block truncate">
                  Matching {locations.slice(0, 2).join(", ")}
                  {locations.length > 2 ? ` +${locations.length - 2}` : ""}
                </span>
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
                <span className="text-[10px] text-brand-subtext block truncate">Rendering matches</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
