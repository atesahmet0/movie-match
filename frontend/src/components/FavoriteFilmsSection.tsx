"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Star, Sparkles } from "lucide-react";
import { UserFilmItem } from "@/lib/types";
import { useTaste } from "@/lib/taste-context";
import FilmCard from "./FilmCard";
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <Star className="w-4 h-4 text-[#00e054] fill-[#00e054]" />
            <h2 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
              Pinned Favorites
            </h2>
          </div>
          <p className="text-xs text-[#99aabb]">
            Your top 4 Letterboxd favorites. Find local members who share your exact taste.
          </p>
        </div>

        <button
          type="button"
          onClick={handleMatchAllFavorites}
          className="self-start sm:self-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#00e054] to-[#00b844] hover:from-[#00b844] hover:to-[#009e3a] text-[#0d1114] font-extrabold text-xs transition flex items-center space-x-2 cursor-pointer shadow-lg shadow-[#00e054]/15"
        >
          <Sparkles className="w-4 h-4" />
          <span>Find My Taste Soulmates (1-Click)</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
