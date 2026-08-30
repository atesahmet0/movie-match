/* Hallmark · component: TasteMatchCard · genre: editorial utility · theme: Studio Projection
 * motion: none; evidence stays readable and stable
 */
"use client";

import React, { useState } from "react";
import { MapPin, ArrowRight, Star, Heart, Eye } from "lucide-react";
import { TasteMatchResult } from "@/lib/types";
import { UserDetailModal } from "@/components/ui/UserDetailModal";
import { Badge } from "@/components/ui/badge";

interface TasteMatchCardProps {
  match: TasteMatchResult;
  index: number;
}

function TasteMatchCard({ match, index }: TasteMatchCardProps) {
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
      <article className="glass-card flex flex-col justify-between p-5 sm:p-6">
        <div>
          <div className="flex items-start justify-between mb-4 gap-3">
            <div className="flex items-center space-x-3.5 min-w-0">
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="flex h-14 w-14 flex-shrink-0 cursor-pointer items-center justify-center rounded-lg"
                aria-label={`View ${match.display_name || match.username}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={avatarUrl}
                  alt={match.display_name || match.username}
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarError(true)}
                  className="h-13 w-13 rounded-lg border border-brand-border object-cover"
                />
              </button>
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  className="block min-h-11 max-w-full cursor-pointer truncate text-left text-base font-bold text-white underline-offset-4 hover:underline"
                >
                  {match.display_name || match.username}
                </button>
                <span className="block font-mono text-xs text-brand-muted">
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
              <span className="mt-1 block font-mono text-xs text-brand-muted tabular-nums">
                {match.shared_films_count} of {match.total_target_films} Films
              </span>
              {/* The score is computed over the signals we could measure, so a
                  thin match can still score high — say so rather than let the
                  percentage speak alone. */}
              {match.confidence < 0.6 && (
                <span className="mt-0.5 block font-mono text-xs text-brand-muted/70">
                  Limited evidence
                </span>
              )}
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
            <span className="text-sm font-semibold text-brand-subtext">
              Shared films
            </span>
            <div className="space-y-1.5">
              {match.shared_films.map((f) => (
                <div
                  key={f.film_slug}
                  className="flex items-center justify-between gap-2 border-t border-brand-border py-2 text-sm first:border-t-0"
                >
                  <span className="truncate font-semibold text-white">
                    {f.film_title || f.film_slug}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0 font-mono">
                    {f.user_rating_stars && (
                      <span className="flex items-center gap-0.5 text-xs font-bold text-brand-text">
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
            <p className="line-clamp-2 border-t border-brand-border pt-3 text-sm leading-relaxed text-brand-subtext">
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
              className="inline-flex min-h-10 cursor-pointer items-center gap-1 whitespace-nowrap rounded-lg px-2.5 text-sm font-semibold text-brand-subtext transition-colors hover:bg-brand-darker hover:text-white"
            >
              <Eye className="w-3.5 h-3.5 text-brand-blue" />
              <span>Details</span>
            </button>

            <a
              href={match.profile_url || `https://letterboxd.com/${match.username}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 items-center gap-1 whitespace-nowrap rounded-lg px-2.5 text-sm font-semibold text-brand-text underline decoration-brand-green decoration-2 underline-offset-4 hover:text-brand-green"
            >
              <span>Profile</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </article>

      {/* Detail Modal */}
      <UserDetailModal
        user={match}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}

export default React.memo(TasteMatchCard);
