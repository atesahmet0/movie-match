"use client";

import { useRouter } from "next/navigation";
import { Star, Sparkles } from "lucide-react";
import { UserFilmItem } from "@/lib/types";
import { useTaste } from "@/lib/taste-context";
import FilmCard from "./FilmCard";

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
            Your top 4 Letterboxd favorites. Find local members who share your exact taste.
          </p>
        </div>

        <button
          onClick={handleMatchAllFavorites}
          className="self-start sm:self-auto px-4 py-2 rounded-xl bg-brand-green hover:bg-brand-greenHover text-black font-extrabold text-xs transition flex items-center space-x-1.5 cursor-pointer shadow-md shadow-brand-green/10"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Find My Taste Soulmates (1-Click)</span>
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
