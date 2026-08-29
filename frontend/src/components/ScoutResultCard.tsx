/* Hallmark · component: ScoutResultCard · genre: atmospheric · theme: Midnight Cinema
 * motion: card-lift · modal-spring
 */
"use client";

import React, { useState } from "react";
import { MapPin, Heart, ArrowRight, Star, Eye } from "lucide-react";
import { UserMatch } from "@/lib/types";
import { motion } from "framer-motion";
import { UserDetailModal } from "@/components/ui/UserDetailModal";
import { Badge } from "@/components/ui/badge";

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
        transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.3) }}
        className="glass-card p-5 sm:p-6 flex flex-col justify-between group hover:border-brand-borderLight transition-all rounded-3xl relative overflow-hidden"
      >
        <div>
          <div className="flex items-center space-x-3.5 mb-3.5">
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
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="font-bold text-white text-sm sm:text-base truncate hover:text-brand-green transition block text-left font-display cursor-pointer"
              >
                {match.display_name || match.username}
              </button>
              <span className="text-xs font-mono text-brand-blue block">
                @{match.username}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 mb-3.5">
            <Badge variant="location" className="text-xs py-1 px-2.5 rounded-lg">
              <MapPin className="w-3 h-3 text-brand-green" />
              <span>{match.matched_location || match.location || "Anywhere"}</span>
            </Badge>

            {match.user_rating_stars && (
              <Badge variant="rating" className="text-xs py-1 px-2.5 rounded-lg">
                <Star className="w-3 h-3 fill-brand-green text-brand-green" />
                <span>{match.user_rating_stars}</span>
              </Badge>
            )}

            {match.user_liked && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-brand-darker text-brand-orange border border-brand-border">
                <Heart className="w-3 h-3 fill-brand-orange text-brand-orange" />
                <span>Liked</span>
              </span>
            )}
          </div>

          {match.user_review ? (
            <p className="text-xs text-[#e1e7ed] line-clamp-3 bg-brand-darker p-3 rounded-xl border border-brand-border italic leading-relaxed">
              &ldquo;{match.user_review}&rdquo;
            </p>
          ) : match.bio ? (
            <p className="text-xs text-brand-subtext line-clamp-2 leading-relaxed">{match.bio}</p>
          ) : null}
        </div>

        <div className="pt-3.5 mt-3.5 border-t border-brand-border flex items-center justify-between">
          <span className="text-[10px] font-mono text-brand-muted uppercase tracking-wider">
            {match.found_via ? match.found_via.replace("-", " ") : "Letterboxd"}
          </span>

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
