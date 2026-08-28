"use client";

import { useState } from "react";
import { MapPin, ArrowRight } from "lucide-react";
import { TasteMatchResult } from "@/lib/types";

interface TasteMatchCardProps {
  match: TasteMatchResult;
  index: number;
}

export default function TasteMatchCard({ match, index }: TasteMatchCardProps) {
  const [avatarError, setAvatarError] = useState(false);

  const avatarUrl =
    match.avatar_url && !avatarError
      ? match.avatar_url
      : "https://s.ltrbxd.com/static/img/avatar80-CTtJ8HSs.png";

  return (
    <div className="solid-card rounded-2xl p-5 flex flex-col justify-between group">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <a
              href={match.profile_url || `https://letterboxd.com/${match.username}/`}
              target="_blank"
              rel="noopener noreferrer"
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
            <div>
              <a
                href={match.profile_url || `https://letterboxd.com/${match.username}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-white text-base hover:text-brand-green transition block"
              >
                {match.display_name || match.username}
              </a>
              <a
                href={match.profile_url || `https://letterboxd.com/${match.username}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono text-brand-blue hover:underline"
              >
                @{match.username}
              </a>
            </div>
          </div>

          <div className="text-right">
            <span className="inline-block px-3 py-1 rounded bg-brand-green text-black text-xs font-extrabold">
              {match.compatibility_score}% Match
            </span>
            <span className="block text-[10px] text-brand-subtext font-mono mt-0.5">
              {match.shared_films_count} of {match.total_target_films} Films
            </span>
          </div>
        </div>

        {/* Location Tag */}
        <div className="mb-3">
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-medium bg-brand-darker text-brand-green border border-brand-border">
            <MapPin className="w-3 h-3" />
            <span>{match.location || match.matched_location}</span>
          </span>
        </div>

        {/* Shared Films List */}
        <div className="space-y-1.5 mb-3">
          <span className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">
            Shared Films:
          </span>
          <div className="space-y-1">
            {match.shared_films.map((f) => (
              <div
                key={f.film_slug}
                className="text-xs bg-brand-darker px-2.5 py-1.5 rounded-lg border border-brand-border flex items-center justify-between"
              >
                <span className="font-semibold text-gray-200">
                  {f.film_title || f.film_slug}
                </span>
                <span className="text-brand-green font-mono text-[11px] font-bold">
                  {f.user_rating_stars}
                </span>
              </div>
            ))}
          </div>
        </div>

        {match.bio && (
          <p className="text-xs text-brand-subtext line-clamp-2 italic bg-brand-darker p-2 rounded-lg border border-brand-border">
            {match.bio}
          </p>
        )}
      </div>

      <div className="pt-4 mt-4 border-t border-brand-border flex items-center justify-between">
        <span className="text-xs font-mono text-brand-muted">Match #{index + 1}</span>
        <a
          href={match.profile_url || `https://letterboxd.com/${match.username}/`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center space-x-1 text-xs font-semibold text-brand-green hover:underline"
        >
          <span>View Profile</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}
