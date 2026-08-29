/* Hallmark · component: TasteMatchCard · genre: atmospheric · theme: Midnight Cinema
 * motion: card-lift · modal-spring
 */
"use client";

import React, { useState } from "react";
import { MapPin, ArrowRight, Star, Heart, Eye } from "lucide-react";
import { TasteMatchResult } from "@/lib/types";
import { motion } from "framer-motion";
import { UserDetailModal } from "@/components/ui/UserDetailModal";
import { Badge } from "@/components/ui/badge";

interface TasteMatchCardProps {
  match: TasteMatchResult;
  index: number;
}

export default function TasteMatchCard({ match, index }: TasteMatchCardProps) {
  const [avatarError, setAvatarError] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const avatarUrl =
    match.avatar_url && !avatarError
      ? match.avatar_url
      : "https://s.ltrbxd.com/static/img/avatar80-CTtJ8HSs.png";

  const isHighMatch = match.compatibility_score >= 75;
  const isMediumMatch = match.compatibility_score >= 50 && match.compatibility_score < 75;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, delay: Math.min(index * 0.04, 0.4) }}
        className="glass-card p-5 sm:p-6 flex flex-col justify-between group hover:border-brand-borderLight transition-all rounded-3xl relative overflow-hidden"
      >
        <div>
          <div className="flex items-start justify-between mb-4 gap-3">
            <div className="flex items-center space-x-3.5 min-w-0">
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="flex-shrink-0 cursor-pointer group-hover:scale-105 transition-transform duration-200"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={avatarUrl}
                  alt={match.display_name || match.username}
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarError(true)}
                  className="w-13 h-13 rounded-2xl object-cover border-2 border-brand-border group-hover:border-brand-green transition-colors shadow-md"
                />
              </button>
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  className="font-bold text-white text-sm sm:text-base hover:text-brand-green transition truncate block text-left font-display cursor-pointer"
                >
                  {match.display_name || match.username}
                </button>
                <span className="text-xs font-mono text-brand-blue block">
                  @{match.username}
                </span>
              </div>
            </div>

            <div className="text-right shrink-0">
              <Badge
                variant={isHighMatch ? "matchHigh" : isMediumMatch ? "matchMedium" : "matchLow"}
                className="text-xs px-2.5 py-1"
              >
                {match.compatibility_score}% Match
              </Badge>
              <span className="block text-[10px] text-brand-muted font-mono mt-1">
                {match.shared_films_count} of {match.total_target_films} Films
              </span>
            </div>
          </div>

          {/* Location Tag */}
          <div className="mb-3.5">
            <Badge variant="location" className="text-xs py-1 px-2.5 rounded-lg">
              <MapPin className="w-3 h-3 text-brand-green shrink-0" />
              <span>{match.matched_location || match.location || "Anywhere"}</span>
            </Badge>
          </div>

          {/* Shared Films List */}
          <div className="space-y-1.5 mb-3.5">
            <span className="text-[10px] font-bold text-brand-muted uppercase tracking-wider font-mono">
              Shared Films in Target Matrix:
            </span>
            <div className="space-y-1.5">
              {match.shared_films.map((f) => (
                <div
                  key={f.film_slug}
                  className="text-xs bg-brand-darker px-3 py-2 rounded-xl border border-brand-border flex items-center justify-between gap-2"
                >
                  <span className="font-semibold text-white truncate font-display">
                    {f.film_title || f.film_slug}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0 font-mono">
                    {f.user_rating_stars && (
                      <span className="text-brand-green text-[11px] font-bold flex items-center gap-0.5">
                        <Star className="w-3 h-3 fill-brand-green" />
                        {f.user_rating_stars}
                      </span>
                    )}
                    {f.user_liked && (
                      <Heart className="w-3.5 h-3.5 text-brand-orange fill-brand-orange" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {match.bio && (
            <p className="text-xs text-brand-subtext line-clamp-2 italic bg-brand-darker/80 p-2.5 rounded-xl border border-brand-border leading-relaxed">
              &ldquo;{match.bio}&rdquo;
            </p>
          )}
        </div>

        <div className="pt-3.5 mt-3.5 border-t border-brand-border flex items-center justify-between">
          <span className="text-xs font-mono text-brand-muted">Match #{index + 1}</span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center space-x-1 text-xs font-semibold text-brand-subtext hover:text-white px-2.5 py-1.5 rounded-xl hover:bg-brand-card transition cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-brand-blue" />
              <span>Details</span>
            </button>

            <a
              href={match.profile_url || `https://letterboxd.com/${match.username}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1 text-xs font-semibold text-brand-green hover:text-brand-greenHover px-2.5 py-1.5 rounded-xl hover:bg-brand-green/10 transition"
            >
              <span>Letterboxd</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </motion.div>

      {/* Detail Modal */}
      <UserDetailModal
        user={match}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
