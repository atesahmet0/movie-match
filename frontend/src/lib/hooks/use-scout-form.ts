"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fetchFilmInfo } from "@/lib/api";
import { FilmSearchResult, SelectedFilmChip } from "@/lib/types";

export interface UseScoutFormProps {
  initialFilms?: string[];
  initialLocation?: string;
  initialSentiment?: string;
  initialPages?: number;
  initialLimit?: number;
  initialIncludeBio?: boolean;
}

export function useScoutForm({
  initialFilms = ["parasite-2019"],
  initialLocation = "Anywhere",
  initialSentiment = "liked",
  initialPages = 2,
  initialLimit = 10,
  initialIncludeBio = false,
}: UseScoutFormProps = {}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [selectedFilms, setSelectedFilms] = useState<SelectedFilmChip[]>([]);
  const [comboboxValue, setComboboxValue] = useState("");
  const [isAddingFilm, setIsAddingFilm] = useState(false);

  const parseInitialLocations = (raw: string): string[] => {
    const split = (raw || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return split.length > 0 ? split : ["Anywhere"];
  };

  const [locations, setLocations] = useState<string[]>(parseInitialLocations(initialLocation));
  const [locationInput, setLocationInput] = useState("");

  const [sentiment, setSentiment] = useState(initialSentiment || "liked");
  const [maxPages, setMaxPages] = useState(initialPages || 2);
  const [limit, setLimit] = useState(initialLimit || 10);
  const [includeBio, setIncludeBio] = useState(initialIncludeBio === true);

  // Initial film hydration
  useEffect(() => {
    if (initialFilms && initialFilms.length > 0 && selectedFilms.length === 0) {
      const uniqueInitial = Array.from(
        new Set(
          initialFilms
            .map((s) => s.trim().toLowerCase().replace(/\/+$/, "").split("/").pop())
            .filter(Boolean) as string[]
        )
      );

      uniqueInitial.forEach((slug) => {
        if (slug) {
          fetchFilmInfo(slug).then((meta) => {
            if (meta && meta.slug) {
              const cleanSlug = meta.slug.trim().toLowerCase();
              setSelectedFilms((prev) => {
                if (prev.some((f) => f.slug.toLowerCase() === cleanSlug)) return prev;
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
              setSelectedFilms((prev) => {
                if (prev.some((f) => f.slug.toLowerCase() === slug.toLowerCase())) return prev;
                return [
                  ...prev,
                  { slug, title: slug.replace("-", " ").replace(/\b\w/g, (c) => c.toUpperCase()) },
                ];
              });
            }
          }).catch(() => {
            setSelectedFilms((prev) => prev.some((f) => f.slug.toLowerCase() === slug.toLowerCase())
              ? prev
              : [...prev, { slug, title: slug.replace("-", " ").replace(/\b\w/g, (c) => c.toUpperCase()) }]);
          });
        }
      });
    }
  // Hydrate URL-provided films once for this form instance.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFilms]);

  const addFilm = async (slug: string, filmMeta?: FilmSearchResult) => {
    if (!slug) return;
    const cleanSlug = slug.trim().toLowerCase().replace(/\/+$/, "").split("/").pop() || slug.trim().toLowerCase();
    if (!cleanSlug) return;

    // Check duplicate immediately
    if (selectedFilms.some((f) => f.slug.toLowerCase() === cleanSlug)) {
      setComboboxValue("");
      return;
    }

    setIsAddingFilm(true);

    if (filmMeta) {
      const metaSlug = (filmMeta.slug || cleanSlug).trim().toLowerCase();
      setSelectedFilms((prev) => {
        if (prev.some((f) => f.slug.toLowerCase() === metaSlug)) return prev;
        return [...prev, { slug: metaSlug, title: filmMeta.title, year: filmMeta.year }];
      });
      setComboboxValue("");
      setIsAddingFilm(false);
      return;
    }

    try {
      const meta = await fetchFilmInfo(cleanSlug);
      if (meta && meta.slug) {
        const resolvedSlug = meta.slug.trim().toLowerCase();
        setSelectedFilms((prev) => {
          if (prev.some((f) => f.slug.toLowerCase() === resolvedSlug)) return prev;
          return [
            ...prev,
            {
              slug: resolvedSlug,
              title: meta.title || resolvedSlug,
              year: meta.year,
              poster_url: meta.poster_url,
            },
          ];
        });
      } else {
        setSelectedFilms((prev) => {
          if (prev.some((f) => f.slug.toLowerCase() === cleanSlug)) return prev;
          return [...prev, { slug: cleanSlug, title: cleanSlug.replace("-", " ").replace(/\b\w/g, (c) => c.toUpperCase()) }];
        });
      }
    } catch {
      setSelectedFilms((prev) => {
        if (prev.some((f) => f.slug.toLowerCase() === cleanSlug)) return prev;
        return [...prev, { slug: cleanSlug, title: cleanSlug }];
      });
    } finally {
      setComboboxValue("");
      setIsAddingFilm(false);
    }
  };

  const removeFilm = (slugToRemove: string) => {
    setSelectedFilms((prev) => prev.filter((f) => f.slug !== slugToRemove));
  };

  const clearFilms = () => {
    setSelectedFilms([]);
  };

  const addLocation = (loc: string) => {
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

  const removeLocation = (locToRemove: string) => {
    setLocations((prev) => {
      const filtered = prev.filter((l) => l !== locToRemove);
      return filtered.length > 0 ? filtered : ["Anywhere"];
    });
  };

  const togglePresetLocation = (loc: string) => {
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

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (selectedFilms.length === 0) return;

    const uniqueSlugs = Array.from(new Set(selectedFilms.map((f) => f.slug.trim()).filter(Boolean)));
    const params = new URLSearchParams({
      films: uniqueSlugs.join(","),
      location: locations.join(","),
      sentiment,
      max_pages: String(maxPages),
      limit: String(limit),
      include_bio: String(includeBio),
      run: String(Date.now()),
    });

    startTransition(() => {
      router.push(`/scout?${params.toString()}`, { scroll: false });
    });
  };

  return {
    // Film State & Actions
    selectedFilms,
    comboboxValue,
    setComboboxValue,
    isAddingFilm,
    addFilm,
    removeFilm,
    clearFilms,

    // Location State & Actions
    locations,
    locationInput,
    setLocationInput,
    addLocation,
    removeLocation,
    togglePresetLocation,

    // Filter Controls
    sentiment,
    setSentiment,
    maxPages,
    setMaxPages,
    limit,
    setLimit,
    includeBio,
    setIncludeBio,

    // Async State & Submission
    isPending,
    handleSubmit,
  };
}

export type UseScoutFormReturn = ReturnType<typeof useScoutForm>;
