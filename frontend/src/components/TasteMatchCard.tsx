"use client";

import React, { useState } from "react";
import { MapPin, ArrowRight, Star, Heart, Eye } from "lucide-react";
import { TasteMatchResult } from "@/lib/types";
import { motion } from "framer-motion";
import { UserDetailModal } from "@/components/ui/UserDetailModal";

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

  const scoreColor =
    match.compatibility_score >= 75
      ? "from-[#00e054] to-[#00b844] text-[#0d1114]"
      : match.compatibility_score >= 50
      ? "from-[#40bcf4] to-[#00a2e8] text-[#0d1114]"
      : "from-[#ff8000] to-[#ff4500] text-white";

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.5) }}
        className="glass-card p-5 flex flex-col justify-between group hover:border-[#3d4957] transition-all"
      >
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3 min-w-0">
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="flex-shrink-0 cursor-pointer"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={avatarUrl}
                  alt={match.display_name || match.username}
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarError(true)}
                  className="w-12 h-12 rounded-full object-cover border-2 border-[#2c3440] group-hover:border-[#00e054] transition-colors shadow-sm"
                />
              </button>
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  className="font-bold text-white text-base hover:text-[#00e054] transition truncate block text-left"
                >
                  {match.display_name || match.username}
                </button>
                <span className="text-xs font-mono text-[#40bcf4] block">
                  @{match.username}
                </span>
              </div>
            </div>

            <div className="text-right shrink-0 ml-2">
              <span
                className={`inline-block px-3 py-1 rounded-full bg-gradient-to-r ${scoreColor} text-xs font-extrabold shadow-sm`}
              >
                {match.compatibility_score}% Match
              </span>
              <span className="block text-[10px] text-[#99aabb] font-mono mt-0.5">
                {match.shared_films_count} of {match.total_target_films} Films
              </span>
            </div>
          </div>

          {/* Location Tag */}
          <div className="mb-3">
            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#14181c] text-[#00e054] border border-[#2c3440]">
              <MapPin className="w-3 h-3 text-[#00e054]" />
              <span className="font-medium">{match.matched_location || match.location}</span>
            </span>
          </div>

          {/* Shared Films List */}
          <div className="space-y-1.5 mb-3">
            <span className="text-[10px] font-bold text-[#667788] uppercase tracking-wider">
              Shared Films in Target Matrix:
            </span>
            <div className="space-y-1.5">
              {match.shared_films.map((f) => (
                <div
                  key={f.film_slug}
                  className="text-xs bg-[#14181c] px-3 py-2 rounded-xl border border-[#2c3440] flex items-center justify-between gap-2"
                >
                  <span className="font-semibold text-gray-200 truncate">
                    {f.film_title || f.film_slug}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {f.user_rating_stars && (
                      <span className="text-[#00e054] font-mono text-[11px] font-bold flex items-center gap-0.5">
                        <Star className="w-3 h-3 fill-[#00e054]" />
                        {f.user_rating_stars}
                      </span>
                    )}
                    {f.user_liked && (
                      <Heart className="w-3 h-3 text-[#ff8000] fill-[#ff8000]" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {match.bio && (
            <p className="text-xs text-[#99aabb] line-clamp-2 italic bg-[#14181c] p-2.5 rounded-xl border border-[#2c3440]">
              &ldquo;{match.bio}&rdquo;
            </p>
          )}
        </div>

        <div className="pt-4 mt-4 border-t border-[#2c3440] flex items-center justify-between">
          <span className="text-xs font-mono text-[#667788]">Match #{index + 1}</span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center space-x-1 text-xs font-semibold text-[#99aabb] hover:text-white px-2 py-1 rounded-lg hover:bg-[#222b33] transition"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Details</span>
            </button>

            <a
              href={match.profile_url || `https://letterboxd.com/${match.username}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1 text-xs font-semibold text-[#00e054] hover:text-[#00b844] px-2 py-1 rounded-lg hover:bg-[#00e054]/10 transition"
            >
              <span>Profile</span>
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
