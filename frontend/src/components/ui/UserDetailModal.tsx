/* Hallmark · component: UserDetailModal · genre: atmospheric · theme: Midnight Cinema
 */
"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
            <div className="relative w-16 h-16 rounded-2xl overflow-hidden border-2 border-brand-border bg-brand-card shrink-0 shadow-xl">
              {user.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatar_url}
                  alt={user.display_name || user.username}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-lg font-bold text-brand-muted">
                  {(user.display_name || user.username).charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-lg sm:text-xl font-bold text-white">
                  {user.display_name || user.username}
                </DialogTitle>
                {isTasteMatch && (
                  <Badge
                    variant={
                      matchResult.compatibility_score >= 75
                        ? "matchHigh"
                        : matchResult.compatibility_score >= 50
                        ? "matchMedium"
                        : "matchLow"
                    }
                  >
                    {matchResult.compatibility_score}% Compatibility
                  </Badge>
                )}
              </div>

              <div className="text-xs text-brand-subtext flex items-center gap-2 mt-1">
                <span className="font-mono">@{user.username}</span>
                {user.location && (
                  <span className="flex items-center gap-1 text-xs text-brand-muted">
                    <MapPin className="w-3.5 h-3.5 text-brand-green" />
                    <span className="text-brand-green font-medium">
                      {user.matched_location || user.location}
                    </span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Bio */}
        {user.bio && (
          <div className="bg-brand-card border border-brand-border rounded-xl p-3.5 text-xs sm:text-sm text-[#e1e7ed] italic relative">
            <Quote className="w-4 h-4 text-brand-muted absolute top-2 right-2 opacity-30" />
            <p className="leading-relaxed whitespace-pre-wrap">{user.bio}</p>
          </div>
        )}

        {/* Scout Result Single Film Details */}
        {!isTasteMatch &&
          (scoutResult.user_rating_stars ||
            scoutResult.user_liked ||
            scoutResult.user_review) && (
            <div className="bg-brand-card border border-brand-border rounded-xl p-4 space-y-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-brand-muted flex items-center gap-1.5 font-mono">
                <Film className="w-3.5 h-3.5 text-brand-green" />
                <span>Film Interaction</span>
              </div>
              <div className="flex items-center gap-3">
                {scoutResult.user_rating_stars && (
                  <span className="text-brand-green text-sm font-bold flex items-center gap-1 font-mono">
                    <Star className="w-4 h-4 fill-brand-green text-brand-green" />
                    {scoutResult.user_rating_stars}
                  </span>
                )}
                {scoutResult.user_liked && (
                  <span className="text-brand-orange text-xs flex items-center gap-1 font-bold">
                    <Heart className="w-4 h-4 fill-brand-orange text-brand-orange" />
                    <span>Liked</span>
                  </span>
                )}
              </div>
              {scoutResult.user_review && (
                <div className="text-xs text-brand-subtext bg-brand-darker p-3 rounded-lg border border-brand-border leading-relaxed">
                  {scoutResult.user_review}
                </div>
              )}
            </div>
          )}

        {/* Taste Match Shared Films List */}
        {isTasteMatch &&
          matchResult.shared_films &&
          matchResult.shared_films.length > 0 && (
            <div className="space-y-2.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-brand-muted flex items-center justify-between font-mono">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-brand-green" />
                  <span>Shared Films in Target Matrix ({matchResult.shared_films.length})</span>
                </span>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {matchResult.shared_films.map((film, idx) => (
                  <div
                    key={idx}
                    className="bg-brand-card border border-brand-border rounded-xl p-2.5 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-white truncate">
                        {film.film_title || film.film_slug}
                      </div>
                      {film.found_via && (
                        <div className="text-[10px] text-brand-muted capitalize font-mono">
                          {film.found_via.replace("-", " ")}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {film.user_rating_stars && (
                        <span className="text-xs font-bold text-brand-green flex items-center gap-0.5 font-mono">
                          <Star className="w-3 h-3 fill-brand-green text-brand-green" />
                          {film.user_rating_stars}
                        </span>
                      )}
                      {film.user_liked && (
                        <Heart className="w-3.5 h-3.5 text-brand-orange fill-brand-orange" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <Button
            asChild
            variant="cinema"
            className="flex-1"
          >
            <a
              href={user.profile_url || `https://letterboxd.com/${user.username}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open on Letterboxd</span>
            </a>
          </Button>

          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setActiveUsername(user.username);
              window.location.href = `/?user=${user.username}`;
            }}
            className="flex items-center justify-center gap-1.5"
          >
            <UserCheck className="w-3.5 h-3.5 text-brand-blue" />
            <span>Inspect Library</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
