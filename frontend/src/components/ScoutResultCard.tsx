"use client";

import { useState } from "react";
import { MapPin, Heart, ArrowRight } from "lucide-react";
import { UserMatch } from "@/lib/types";

interface ScoutResultCardProps {
  match: UserMatch;
}

export default function ScoutResultCard({ match }: ScoutResultCardProps) {
  const [avatarError, setAvatarError] = useState(false);

  const avatarUrl =
    match.avatar_url && !avatarError
      ? match.avatar_url
      : "https://s.ltrbxd.com/static/img/avatar80-CTtJ8HSs.png";

  return (
    <div className="solid-card rounded-xl p-5 flex flex-col justify-between group">
      <div>
        <div className="flex items-center space-x-3.5 mb-3">
          <a
            href={match.profile_url || `https://letterboxd.com/${match.username}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatarUrl}
              alt={match.display_name || match.username}
              referrerPolicy="no-referrer"
              onError={() => setAvatarError(true)}
              className="w-12 h-12 rounded-full object-cover border border-brand-border group-hover:border-brand-green transition"
            />
          </a>
          <div className="min-w-0 flex-1">
            <a
              href={match.profile_url || `https://letterboxd.com/${match.username}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-white text-base truncate hover:text-brand-green hover:underline transition block"
            >
              {match.display_name || match.username}
            </a>
            <a
              href={match.profile_url || `https://letterboxd.com/${match.username}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-mono text-brand-blue hover:underline block"
            >
              @{match.username}
            </a>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-medium bg-brand-darker text-brand-green border border-brand-border">
            <MapPin className="w-3 h-3" />
            <span>{match.location || match.matched_location}</span>
          </span>

          {match.user_rating_stars && (
            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-brand-darker text-brand-green border border-brand-border">
              {match.user_rating_stars}
            </span>
          )}

          {match.user_liked && (
            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-brand-darker text-red-400 border border-brand-border">
              <Heart className="w-3 h-3 fill-current mr-1" /> Liked
            </span>
          )}
        </div>

        {match.user_review ? (
          <p className="text-xs text-gray-300 line-clamp-3 bg-brand-darker p-2.5 rounded-lg border border-brand-border">
            &ldquo;{match.user_review}&rdquo;
          </p>
        ) : match.bio ? (
          <p className="text-xs text-brand-subtext line-clamp-2">{match.bio}</p>
        ) : null}
      </div>

      <div className="pt-4 mt-4 border-t border-brand-border flex items-center justify-between">
        <span className="text-[11px] font-mono text-brand-muted">
          {match.found_via || "Letterboxd"}
        </span>
        <a
          href={match.profile_url || `https://letterboxd.com/${match.username}/`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center space-x-1 text-xs font-semibold text-brand-green hover:underline"
        >
          <span>Profile</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}
