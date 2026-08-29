/* Hallmark · component: FavoriteFilmsSection · genre: atmospheric · theme: Midnight Cinema
 * motion: stagger-grid · button-lift
 */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Star, Sparkles } from "lucide-react";
import { UserFilmItem } from "@/lib/types";
import { useTaste } from "@/lib/taste-context";
import FilmCard from "./FilmCard";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface FavoriteFilmsSectionProps {
  username?: string;
  favoriteFilms: UserFilmItem[];
  userLocation?: string;
}

export default function FavoriteFilmsSection({
  username,
  favoriteFilms,
  userLocation,
}: FavoriteFilmsSectionProps) {
  const router = useRouter();
  const { addFilm } = useTaste();

  if (!favoriteFilms || favoriteFilms.length === 0) return null;

  const handleMatchAllFavorites = () => {
    favoriteFilms.forEach((film) => {
      addFilm({
        slug: film.slug,
        title: film.title,
        year: film.year,
        poster_url: film.poster_url,
      });
    });

    const filmsParam = favoriteFilms.map((f) => f.slug).join(",");
    const userParam = username ? `&user=${encodeURIComponent(username)}` : "";
    const locParam = userLocation ? `&location=${encodeURIComponent(userLocation)}` : "";
    router.push(`/taste?films=${encodeURIComponent(filmsParam)}${userParam}${locParam}`);
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-brand-card/60 p-4 rounded-2xl border border-brand-border/80">
        <div>
          <div className="flex items-center space-x-2">
            <Star className="w-4 h-4 text-brand-green fill-brand-green" />
            <h2 className="text-base sm:text-lg font-extrabold text-white tracking-tight font-display">
              Pinned 4 Favorites
            </h2>
          </div>
          <p className="text-xs text-brand-subtext mt-0.5">
            Your top Letterboxd cornerstones. Instant 1-click match with locals sharing this exact matrix.
          </p>
        </div>

        <Button
          type="button"
          variant="cinema"
          size="default"
          onClick={handleMatchAllFavorites}
          leftIcon={<Sparkles className="w-4 h-4" />}
          className="self-start sm:self-auto shrink-0"
        >
          Find Soulmates (1-Click)
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {favoriteFilms.map((film, idx) => (
          <motion.div
            key={film.slug}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: idx * 0.05 }}
          >
            <FilmCard film={film} isFavorite={true} />
          </motion.div>
        ))}
      </div>
    </section>
  );
}
