"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Loader2 } from "lucide-react";
import { UserFilmItem } from "@/lib/types";
import FilmCard from "./FilmCard";

interface ProfileFilmsSectionProps {
  username: string;
  initialCategory: string;
  initialFilms: UserFilmItem[];
}

const CATEGORIES = [
  { id: "films", label: "Recently Watched" },
  { id: "top_rated", label: "Top Rated (4-5 Stars)" },
  { id: "likes", label: "Liked Films" },
  { id: "watchlist", label: "Watchlist" },
];

export default function ProfileFilmsSection({
  username,
  initialCategory,
  initialFilms,
}: ProfileFilmsSectionProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filterQuery, setFilterQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const activeCategory = searchParams.get("category") || initialCategory || "films";

  const handleCategoryChange = (catId: string) => {
    if (catId === activeCategory) return;
    setLoading(true);
    const params = new URLSearchParams(searchParams.toString());
    params.set("user", username);
    params.set("category", catId);
    router.push(`/?${params.toString()}`);
  };

  const filteredFilms = initialFilms.filter((film) => {
    if (!filterQuery.trim()) return true;
    const q = filterQuery.toLowerCase().trim();
    return (
      (film.title || "").toLowerCase().includes(q) ||
      (film.slug || "").toLowerCase().includes(q)
    );
  });

  return (
    <section className="solid-card rounded-2xl p-5 sm:p-6 space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-brand-border pb-4">
        {/* Category Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 bg-brand-darker p-1 rounded-xl border border-brand-border">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleCategoryChange(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                activeCategory === cat.id
                  ? "bg-brand-green text-black font-bold"
                  : "text-brand-subtext hover:text-white font-medium"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Library Search Input */}
        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-brand-muted absolute left-3 top-3" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filter films in this list..."
            className="w-full text-xs bg-brand-darker border border-brand-border rounded-xl pl-8 pr-3 py-2 text-white placeholder-brand-muted focus:outline-none glow-focus"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="w-7 h-7 text-brand-green animate-spin mx-auto mb-2" />
          <p className="text-xs text-brand-subtext font-mono">Fetching films from Letterboxd...</p>
        </div>
      ) : (
        <>
          {filteredFilms.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
              {filteredFilms.map((film) => (
                <FilmCard key={film.slug} film={film} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-brand-muted text-xs">
              {filterQuery.trim()
                ? "No films match your search filter."
                : "No films found in this category."}
            </div>
          )}
        </>
      )}
    </section>
  );
}
