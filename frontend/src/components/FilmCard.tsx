"use client";

import { useState } from "react";
import Link from "next/link";
import { Star, Heart, Film, Search } from "lucide-react";
import { UserFilmItem } from "@/lib/types";
import { useTaste } from "@/lib/taste-context";

interface FilmCardProps {
  film: UserFilmItem;
  isFavorite?: boolean;
}

export default function FilmCard({ film, isFavorite = false }: FilmCardProps) {
  const [imageError, setImageError] = useState(false);
  const { toggleFilm, isFilmSelected } = useTaste();
  const isSelected = isFilmSelected(film.slug);

  const posterSrc = film.poster_url && !imageError ? film.poster_url : null;

  return (
    <div className="solid-card rounded-xl p-3 sm:p-4 flex flex-col justify-between group">
      <div>
        <div className="w-full aspect-[2/3] rounded-lg bg-brand-darker mb-2 overflow-hidden border border-brand-border flex items-center justify-center relative">
          {posterSrc ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={posterSrc}
              alt={film.title}
              referrerPolicy="no-referrer"
              onError={() => setImageError(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-brand-card p-2 text-center select-none">
              <Film className="w-8 h-8 text-brand-muted mb-1.5" />
              <span className="text-[10px] font-bold text-brand-subtext line-clamp-2">
                {film.title}
              </span>
            </div>
          )}

          {film.user_liked && (
            <span
              className="absolute top-1.5 right-1.5 text-[10px] bg-red-600 text-white rounded p-1 shadow"
              title="Liked"
            >
              <Heart className="w-3 h-3 fill-current" />
            </span>
          )}
        </div>

        <a
          href={film.film_url || `https://letterboxd.com/film/${film.slug}/`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-bold text-white text-xs sm:text-sm hover:text-brand-green transition line-clamp-1 block"
          title={film.title}
        >
          {film.title}
        </a>

        <div className="flex items-center justify-between text-[11px] text-brand-subtext font-mono mt-0.5">
          <span>{film.year || ""}</span>
          {isFavorite ? (
            <span className="flex items-center text-brand-green font-bold text-[10px]">
              <Star className="w-2.5 h-2.5 fill-current mr-0.5" /> Favorite
            </span>
          ) : (
            <span className="text-brand-green font-bold">{film.user_rating_stars}</span>
          )}
        </div>
      </div>

      <div className="mt-2.5 pt-2 border-t border-brand-border flex items-center justify-between gap-1.5">
        <Link
          href={`/scout?film=${encodeURIComponent(film.slug)}`}
          className="flex-1 py-1.5 px-2 bg-brand-darker hover:bg-brand-green hover:text-black border border-brand-border text-[11px] font-bold rounded-lg text-gray-300 transition text-center flex items-center justify-center space-x-1"
          title="Find members who liked this"
        >
          <Search className="w-3 h-3" />
          <span>Scout</span>
        </Link>
        <button
          onClick={() =>
            toggleFilm({
              slug: film.slug,
              title: film.title,
              year: film.year,
              poster_url: film.poster_url,
            })
          }
          className={`p-1.5 px-2.5 rounded-lg border text-[11px] font-bold transition cursor-pointer ${
            isSelected
              ? "bg-brand-orange text-black border-brand-orange"
              : "bg-brand-darker text-brand-subtext border-brand-border hover:text-white"
          }`}
          title={isSelected ? "Remove from Taste Match" : "Add to Taste Match"}
        >
          {isSelected ? "Selected" : "+ Taste"}
        </button>
      </div>
    </div>
  );
}
