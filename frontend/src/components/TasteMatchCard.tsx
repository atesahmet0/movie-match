/* Hallmark · component: TasteMatchCard · genre: editorial utility · theme: Studio Projection
 * motion: none; evidence stays readable and stable
 */
"use client";

import React, { useState } from "react";
import { MapPin, ArrowRight, Star, Heart, Eye } from "lucide-react";
import { TasteMatchResult } from "@/lib/types";
import { trackMemberProfileViewed, trackOutboundLetterboxdClick } from "@/lib/analytics";
import { UserDetailModal } from "@/components/ui/UserDetailModal";
import { Badge } from "@/components/ui/badge";

interface TasteMatchCardProps {
  match: TasteMatchResult;
  index: number;
  /** Renders the card as the headline result the search stopped for. */
  highlight?: boolean;
}

function TasteMatchCard({ match, index, highlight = false }: TasteMatchCardProps) {
  const [avatarError, setAvatarError] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const avatarUrl =
    match.avatar_url && !avatarError
      ? match.avatar_url
      : "https://s.ltrbxd.com/static/img/avatar80-CTtJ8HSs.png";

  const isHighMatch = match.compatibility_score >= 75;
  const isMediumMatch = match.compatibility_score >= 50 && match.compatibility_score < 75;

  const handleOpenModal = () => {
    setIsModalOpen(true);
    trackMemberProfileViewed({
      username: match.username,
      matchPercentage: match.compatibility_score,
      sharedFilmsCount: match.shared_films?.length || 0,
      location: match.location,
    });
  };

  return (
    <>
      <article
        className={`glass-card flex flex-col justify-between p-5 sm:p-6 ${
          highlight ? "border-brand-green/50 ring-1 ring-brand-green/30" : ""
        }`}
      >
        <div>
          <div className="flex items-start justify-between mb-4 gap-3">
            <div className="flex items-center space-x-3.5 min-w-0">
              <button
                type="button"
                onClick={handleOpenModal}
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
                  onClick={handleOpenModal}
                  className="block min-h-11 max-w-full cursor-pointer truncate text-left text-base font-bold text-white underline-offset-4 hover:underline"
                >
                  {match.display_name || match.username}
                </button>
                <div className="flex items-center space-x-1.5 text-xs text-brand-muted mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-brand-subtext shrink-0" />
                  <span className="truncate">{match.location || "Anywhere"}</span>
                </div>
              </div>
            </div>

            <div className="text-right flex flex-col items-end gap-1">
              <Badge
                variant={isHighMatch ? "default" : isMediumMatch ? "outline" : "secondary"}
                className={`font-mono text-xs font-bold ${
                  isHighMatch
                    ? "bg-brand-green text-brand-dark"
                    : isMediumMatch
                    ? "text-brand-orange border-brand-orange/40"
                    : "text-brand-muted"
                }`}
              >
                {match.compatibility_score}% match
              </Badge>
              <span className="text-[11px] text-brand-muted font-mono">
                {match.shared_films_count} of {match.total_target_films} shared
              </span>
            </div>
          </div>

          {/* Shared Films Chips with Rating info */}
          <div className="space-y-2 mb-3">
            <div className="text-xs font-semibold text-brand-muted uppercase tracking-wider">
              Shared Favorites:
            </div>
            <div className="flex flex-wrap gap-1.5">
              {match.shared_films.map((f, i) => (
                <div
                  key={i}
                  className="inline-flex items-center space-x-1.5 bg-brand-darker border border-brand-border px-2.5 py-1 rounded-lg text-xs"
                >
                  <span className="font-semibold text-white truncate max-w-[140px]">
                    {f.film_title || f.film_slug}
                  </span>
                  <div className="flex items-center space-x-1 text-[11px] text-brand-subtext border-l border-brand-border pl-1.5">
                    {f.user_rating ? (
                      <span className="flex items-center text-brand-green font-mono">
                        <Star className="w-3 h-3 fill-brand-green mr-0.5" />
                        {f.user_rating}
                      </span>
                    ) : null}
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
          <span className="text-xs font-mono text-brand-muted">
            {highlight ? "Best match" : `Match #${index + 1}`}
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenModal}
              className="inline-flex min-h-10 cursor-pointer items-center gap-1 whitespace-nowrap rounded-lg px-2.5 text-sm font-semibold text-brand-subtext transition-colors hover:bg-brand-darker hover:text-white"
            >
              <Eye className="w-3.5 h-3.5 text-brand-blue" />
              <span>Details</span>
            </button>

            <a
              href={match.profile_url || `https://letterboxd.com/${match.username}/`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                trackOutboundLetterboxdClick({
                  target: "user",
                  identifier: match.username,
                })
              }
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
