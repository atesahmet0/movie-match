"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Star, Heart, Film, Search, Check, Plus } from "lucide-react";
import { UserFilmItem } from "@/lib/types";
import { useTaste } from "@/lib/taste-context";
import { motion } from "framer-motion";

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
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className="glass-card p-3 sm:p-4 flex flex-col justify-between group hover:border-[#3d4957] transition-all"
    >
      <div>
        <div className="w-full aspect-[2/3] rounded-xl bg-[#14181c] mb-2.5 overflow-hidden border border-[#2c3440] group-hover:border-[#00e054]/50 flex items-center justify-center relative shadow-md transition-colors">
          {posterSrc ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={posterSrc}
              alt={film.title}
              referrerPolicy="no-referrer"
              onError={() => setImageError(true)}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-[#1b2228] p-2 text-center select-none">
              <Film className="w-8 h-8 text-[#667788] mb-1.5" />
              <span className="text-[10px] font-bold text-[#99aabb] line-clamp-2">
                {film.title}
              </span>
            </div>
          )}

          {film.user_liked && (
            <span
              className="absolute top-2 right-2 text-[10px] bg-red-600/90 backdrop-blur-sm text-white rounded-md p-1 shadow-md"
              title="Liked"
            >
              <Heart className="w-3 h-3 fill-current" />
            </span>
          )}

          {isFavorite && (
            <span className="absolute top-2 left-2 text-[10px] bg-[#00e054]/90 backdrop-blur-sm text-[#0d1114] font-bold rounded-md px-1.5 py-0.5 shadow-md flex items-center gap-1">
              <Star className="w-2.5 h-2.5 fill-current" /> Top 4
            </span>
          )}
        </div>

        <a
          href={film.film_url || `https://letterboxd.com/film/${film.slug}/`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-bold text-white text-xs sm:text-sm hover:text-[#00e054] transition line-clamp-1 block"
          title={film.title}
        >
          {film.title}
        </a>

        <div className="flex items-center justify-between text-[11px] text-[#99aabb] font-mono mt-0.5">
          <span>{film.year || ""}</span>
          {film.user_rating_stars && !isFavorite && (
            <span className="text-[#00e054] font-bold flex items-center gap-0.5">
              <Star className="w-2.5 h-2.5 fill-[#00e054]" />
              {film.user_rating_stars}
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 pt-2.5 border-t border-[#2c3440] flex items-center justify-between gap-1.5">
        <Link
          href={`/scout?film=${encodeURIComponent(film.slug)}`}
          className="flex-1 py-1.5 px-2 bg-[#14181c] hover:bg-[#00e054] hover:text-[#0d1114] border border-[#2c3440] text-[11px] font-bold rounded-xl text-gray-300 transition text-center flex items-center justify-center space-x-1"
          title="Find members who liked this"
        >
          <Search className="w-3 h-3" />
          <span>Scout</span>
        </Link>
        <button
          type="button"
          onClick={() =>
            toggleFilm({
              slug: film.slug,
              title: film.title,
              year: film.year,
              poster_url: film.poster_url,
            })
          }
          className={`p-1.5 px-2.5 rounded-xl border text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
            isSelected
              ? "bg-[#ff8000] text-[#0d1114] border-[#ff8000] shadow-sm shadow-[#ff8000]/20"
              : "bg-[#14181c] text-[#99aabb] border-[#2c3440] hover:text-white hover:border-[#3d4957]"
          }`}
          title={isSelected ? "Remove from Taste Matrix" : "Add to Taste Matrix"}
        >
          {isSelected ? (
            <>
              <Check className="w-3 h-3" />
              <span>Added</span>
            </>
          ) : (
            <>
              <Plus className="w-3 h-3" />
              <span>Taste</span>
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}
