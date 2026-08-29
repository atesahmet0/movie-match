/* Hallmark · component: ProfileFilmsSection · genre: atmospheric · theme: Midnight Cinema
 * motion: layout-pill · grid-stagger
 */
"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Loader2, Film } from "lucide-react";
import { UserFilmItem } from "@/lib/types";
import FilmCard from "./FilmCard";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";

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
    <section className="glass-card rounded-3xl p-5 sm:p-7 space-y-6 border border-brand-border/90">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-brand-border/70 pb-5">
        {/* Category Tabs with Framer Motion Layout Animation */}
        <div className="flex flex-wrap items-center gap-1 bg-brand-darker/90 p-1 rounded-2xl border border-brand-border text-xs">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleCategoryChange(cat.id)}
                className={`relative px-3.5 py-2 rounded-xl text-xs transition-colors z-10 cursor-pointer select-none font-semibold ${
                  isActive
                    ? "text-black font-bold"
                    : "text-brand-subtext hover:text-white"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="active-category-pill"
                    className="absolute inset-0 bg-brand-green rounded-xl -z-10 shadow-md shadow-brand-green/20"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Library Search Input */}
        <div className="w-full md:w-64">
          <Input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filter loaded films..."
            leftElement={<Search className="w-3.5 h-3.5" />}
            className="h-9.5 text-xs rounded-xl"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16">
          <Loader2 className="w-8 h-8 text-brand-green animate-spin mx-auto mb-2" />
          <p className="text-xs text-brand-subtext font-mono">Fetching films from Letterboxd...</p>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {filteredFilms.length > 0 ? (
            <motion.div
              key={activeCategory}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4"
            >
              {filteredFilms.map((film) => (
                <FilmCard key={film.slug} film={film} />
              ))}
            </motion.div>
          ) : (
            <div className="text-center py-16 text-brand-muted space-y-2">
              <Film className="w-8 h-8 mx-auto text-brand-muted opacity-40 mb-1" />
              <p className="font-semibold text-white text-sm">
                {filterQuery.trim()
                  ? "No films match your search filter."
                  : "No films found in this category."}
              </p>
              <p className="text-xs text-brand-subtext">
                Try switching categories or clear your filter query.
              </p>
            </div>
          )}
        </AnimatePresence>
      )}
    </section>
  );
}
