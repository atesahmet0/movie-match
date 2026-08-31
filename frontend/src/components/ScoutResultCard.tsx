/* Hallmark · component: ScoutResultCard · genre: editorial utility · theme: Studio Projection
 * motion: none; evidence stays readable and stable
 */
"use client";

import React, { useState } from "react";
import { MapPin, Heart, ArrowRight, Star, Eye } from "lucide-react";
import { UserMatch } from "@/lib/types";
import { trackMemberProfileViewed, trackOutboundLetterboxdClick } from "@/lib/analytics";
import { UserDetailModal } from "@/components/ui/UserDetailModal";
import { Badge } from "@/components/ui/badge";

interface ScoutResultCardProps {
  match: UserMatch;
  index?: number;
}

function ScoutResultCard({ match }: ScoutResultCardProps) {
  const [avatarError, setAvatarError] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const avatarUrl =
    match.avatar_url && !avatarError
      ? match.avatar_url
      : "https://s.ltrbxd.com/static/img/avatar80-CTtJ8HSs.png";

  const handleOpenModal = () => {
    setIsModalOpen(true);
    trackMemberProfileViewed({
      username: match.username,
      location: match.location,
    });
  };

  return (
    <>
      <article className="glass-card flex flex-col justify-between p-5 sm:p-6">
        <div>
          <div className="flex items-center space-x-3.5 mb-3.5">
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
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={handleOpenModal}
                className="block min-h-11 max-w-full cursor-pointer truncate text-left text-base font-bold text-white underline-offset-4 hover:underline"
              >
                {match.display_name || match.username}
              </button>
              <span className="block font-mono text-xs text-brand-muted">
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
            <p className="line-clamp-3 border-t border-brand-border pt-3 text-sm leading-relaxed text-brand-text">
              &ldquo;{match.user_review}&rdquo;
            </p>
          ) : match.bio ? (
            <p className="line-clamp-2 text-sm leading-relaxed text-brand-subtext">{match.bio}</p>
          ) : null}
        </div>

        <div className="pt-3.5 mt-3.5 border-t border-brand-border flex items-center justify-between">
          <span className="font-mono text-xs text-brand-muted">
            {match.found_via ? match.found_via.replace("-", " ") : "Letterboxd"}
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

      {/* Modal */}
      <UserDetailModal
        user={match}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}

export default React.memo(ScoutResultCard);
