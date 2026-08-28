"use client";

import React from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  MapPin,
  ExternalLink,
  Star,
  Heart,
  Film,
  Sparkles,
  UserCheck,
  Quote,
} from "lucide-react";
import { UserMatch, TasteMatchResult } from "@/lib/types";
import { useTaste } from "@/lib/taste-context";

interface UserDetailModalProps {
  user: UserMatch | TasteMatchResult | null;
  isOpen: boolean;
  onClose: () => void;
}

export function UserDetailModal({ user, isOpen, onClose }: UserDetailModalProps) {
  const { setActiveUsername } = useTaste();

  if (!user) return null;

  const isTasteMatch = "shared_films" in user;
  const matchResult = user as TasteMatchResult;
  const scoutResult = user as UserMatch;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-left space-y-4">
          <div className="flex items-start gap-4">
            <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-[#2c3440] bg-[#1b2228] shrink-0 shadow-lg">
              {user.avatar_url ? (
                <Image
                  src={user.avatar_url}
                  alt={user.display_name || user.username}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-lg font-bold text-[#667788]">
                  {(user.display_name || user.username).charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-xl font-bold text-white">
                  {user.display_name || user.username}
                </DialogTitle>
                {isTasteMatch && (
                  <Badge
                    variant={
                      matchResult.compatibility_score >= 75
                        ? "success"
                        : matchResult.compatibility_score >= 50
                        ? "info"
                        : "warning"
                    }
                  >
                    {matchResult.compatibility_score}% Compatibility
                  </Badge>
                )}
              </div>

              <div className="text-sm text-[#99aabb] flex items-center gap-2 mt-0.5">
                <span>@{user.username}</span>
                {user.location && (
                  <span className="flex items-center gap-1 text-xs text-[#667788]">
                    <MapPin className="w-3.5 h-3.5 text-[#00e054]" />
                    <span className="text-[#00e054] font-medium">{user.matched_location || user.location}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Bio */}
        {user.bio && (
          <div className="bg-[#1b2228] border border-[#2c3440] rounded-xl p-3.5 text-sm text-[#e1e7ed] italic relative">
            <Quote className="w-4 h-4 text-[#667788] absolute top-2 right-2 opacity-30" />
            <p className="leading-relaxed whitespace-pre-wrap">{user.bio}</p>
          </div>
        )}

        {/* Scout Result Single Film Details */}
        {!isTasteMatch && (scoutResult.user_rating_stars || scoutResult.user_liked || scoutResult.user_review) && (
          <div className="bg-[#1b2228] border border-[#2c3440] rounded-xl p-4 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-[#667788] flex items-center gap-1.5">
              <Film className="w-3.5 h-3.5 text-[#00e054]" />
              Film Interaction
            </div>
            <div className="flex items-center gap-3">
              {scoutResult.user_rating_stars && (
                <span className="text-[#00e054] text-base font-bold flex items-center gap-1">
                  <Star className="w-4 h-4 fill-[#00e054]" />
                  {scoutResult.user_rating_stars}
                </span>
              )}
              {scoutResult.user_liked && (
                <span className="text-[#ff8000] text-sm flex items-center gap-1 font-semibold">
                  <Heart className="w-4 h-4 fill-[#ff8000]" />
                  Liked
                </span>
              )}
            </div>
            {scoutResult.user_review && (
              <div className="text-xs text-[#99aabb] bg-[#14181c] p-3 rounded-lg border border-[#2c3440]">
                {scoutResult.user_review}
              </div>
            )}
          </div>
        )}

        {/* Taste Match Shared Films List */}
        {isTasteMatch && matchResult.shared_films && matchResult.shared_films.length > 0 && (
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-[#667788] flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#00e054]" />
                Shared Films in Target Matrix ({matchResult.shared_films.length})
              </span>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {matchResult.shared_films.map((film, idx) => (
                <div
                  key={idx}
                  className="bg-[#1b2228] border border-[#2c3440] rounded-xl p-3 flex items-center justify-between gap-3 text-sm"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-white truncate">
                      {film.film_title || film.film_slug}
                    </div>
                    {film.found_via && (
                      <div className="text-[11px] text-[#667788] capitalize">
                        {film.found_via.replace("-", " ")}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {film.user_rating_stars && (
                      <span className="text-xs font-bold text-[#00e054] flex items-center gap-0.5">
                        <Star className="w-3 h-3 fill-[#00e054]" />
                        {film.user_rating_stars}
                      </span>
                    )}
                    {film.user_liked && (
                      <Heart className="w-3.5 h-3.5 text-[#ff8000] fill-[#ff8000]" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <a
            href={user.profile_url || `https://letterboxd.com/${user.username}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 bg-[#00e054] hover:bg-[#00b844] text-[#0d1114] font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-sm transition-colors shadow-lg shadow-[#00e054]/10"
          >
            <ExternalLink className="w-4 h-4" />
            Open on Letterboxd
          </a>

          <button
            type="button"
            onClick={() => {
              setActiveUsername(user.username);
              window.location.href = `/?user=${user.username}`;
            }}
            className="bg-[#1b2228] hover:bg-[#222b33] border border-[#2c3440] hover:border-[#3d4957] text-[#e1e7ed] font-medium py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-sm transition-colors"
          >
            <UserCheck className="w-4 h-4 text-[#40bcf4]" />
            Inspect Library
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
