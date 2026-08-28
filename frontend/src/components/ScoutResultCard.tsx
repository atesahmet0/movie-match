"use client";

import React, { useState } from "react";
import { MapPin, Heart, ArrowRight, Star, ExternalLink, Eye } from "lucide-react";
import { UserMatch } from "@/lib/types";
import { motion } from "framer-motion";
import { UserDetailModal } from "@/components/ui/UserDetailModal";

interface ScoutResultCardProps {
  match: UserMatch;
  index?: number;
}

export default function ScoutResultCard({ match, index = 0 }: ScoutResultCardProps) {
  const [avatarError, setAvatarError] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const avatarUrl =
    match.avatar_url && !avatarError
      ? match.avatar_url
      : "https://s.ltrbxd.com/static/img/avatar80-CTtJ8HSs.png";

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.4) }}
        className="glass-card p-5 flex flex-col justify-between group hover:border-[#3d4957] transition-all"
      >
        <div>
          <div className="flex items-center space-x-3.5 mb-3">
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
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="font-bold text-white text-base truncate hover:text-[#00e054] transition block text-left"
              >
                {match.display_name || match.username}
              </button>
              <span className="text-xs font-mono text-[#40bcf4] block">
                @{match.username}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 mb-3">
            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#14181c] text-[#00e054] border border-[#2c3440]">
              <MapPin className="w-3 h-3 text-[#00e054]" />
              <span className="font-medium">{match.matched_location || match.location}</span>
            </span>

            {match.user_rating_stars && (
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#14181c] text-[#00e054] border border-[#2c3440]">
                <Star className="w-3 h-3 fill-[#00e054]" />
                <span>{match.user_rating_stars}</span>
              </span>
            )}

            {match.user_liked && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#14181c] text-[#ff8000] border border-[#2c3440]">
                <Heart className="w-3 h-3 fill-current mr-1 text-[#ff8000]" /> Liked
              </span>
            )}
          </div>

          {match.user_review ? (
            <p className="text-xs text-gray-300 line-clamp-3 bg-[#14181c] p-2.5 rounded-xl border border-[#2c3440] italic">
              &ldquo;{match.user_review}&rdquo;
            </p>
          ) : match.bio ? (
            <p className="text-xs text-[#99aabb] line-clamp-2">{match.bio}</p>
          ) : null}
        </div>

        <div className="pt-4 mt-4 border-t border-[#2c3440] flex items-center justify-between">
          <span className="text-[11px] font-mono text-[#667788] capitalize">
            {match.found_via ? match.found_via.replace("-", " ") : "Letterboxd"}
          </span>

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

      {/* Modal */}
      <UserDetailModal
        user={match}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
