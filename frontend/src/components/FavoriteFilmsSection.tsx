"use client";

import { useRouter } from "next/navigation";
import { Star, Sparkles } from "lucide-react";
import { UserFilmItem } from "@/lib/types";
import { useTaste } from "@/lib/taste-context";
import FilmCard from "./FilmCard";

interface FavoriteFilmsSectionProps {
  favoriteFilms: UserFilmItem[];
  userLocation?: string;
}

export default function FavoriteFilmsSection({
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
    const locParam = userLocation ? `&location=${encodeURIComponent(userLocation)}` : "";
    router.push(`/taste?films=${encodeURIComponent(filmsParam)}${locParam}`);
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center space-x-2">
            <Star className="w-4 h-4 text-brand-green fill-current" />
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Pinned Favorites
            </h2>
          </div>
          <p className="text-xs text-brand-subtext">
            Click Scout to find local members who also love that specific film.
          </p>
        </div>

        <button
          onClick={handleMatchAllFavorites}
          className="self-start sm:self-auto px-3.5 py-2 rounded-xl bg-brand-blue hover:bg-opacity-90 text-black font-bold text-xs transition flex items-center space-x-1.5 cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Match All 4 Favorites Combined</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {favoriteFilms.map((film) => (
          <FilmCard key={film.slug} film={film} isFavorite={true} />
        ))}
      </div>
    </section>
  );
}
