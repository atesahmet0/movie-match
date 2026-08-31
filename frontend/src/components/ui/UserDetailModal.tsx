/* Hallmark · component: UserDetailModal · genre: editorial utility · theme: Studio Projection
 */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();

  if (!user) return null;

  const isTasteMatch = "shared_films" in user;
  const matchResult = user as TasteMatchResult;
  const scoutResult = user as UserMatch;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-left space-y-4">
          <div className="flex items-start gap-4">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-brand-border bg-brand-card">
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
          <div className="relative border-y border-brand-border bg-brand-darker p-4 text-sm text-brand-text">
            <Quote className="w-4 h-4 text-brand-muted absolute top-2 right-2 opacity-30" />
            <p className="leading-relaxed whitespace-pre-wrap">{user.bio}</p>
          </div>
        )}

        {/* Scout Result Single Film Details */}
        {!isTasteMatch &&
          (scoutResult.user_rating_stars ||
            scoutResult.user_liked ||
            scoutResult.user_review) && (
            <div className="space-y-3 border-y border-brand-border py-4">
              <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-brand-muted">
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
                <div className="border-t border-brand-border pt-3 text-sm leading-relaxed text-brand-subtext">
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
              <div className="flex items-center justify-between font-mono text-xs font-bold text-brand-muted">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-brand-green" />
                  <span>Shared Films ({matchResult.shared_films.length})</span>
                </span>
                {/* Below the 3-pair threshold the backend reports a neutral
                    placeholder, so showing a percentage would invent a
                    measurement that was never taken. */}
                <span className="text-xs font-normal text-brand-muted">
                  {matchResult.correlation_pairs >= 3 ? (
                    <>
                      Rating Agreement: {matchResult.correlation_score}%{" "}
                      <span className="text-brand-subtext">
                        ({matchResult.correlation_pairs} rated by both)
                      </span>
                    </>
                  ) : (
                    "Not enough mutually rated films"
                  )}
                </span>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {matchResult.shared_films.map((film, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-3 border-t border-brand-border py-2.5 text-sm first:border-t-0"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white truncate">
                          {film.film_title || film.film_slug}
                        </span>
                        {film.film_tier && film.film_tier !== "unknown" && (
                          <span className={`rounded px-1.5 py-0.5 font-mono text-xs font-semibold ${
                            film.film_tier === "favorite"
                              ? "bg-brand-orange/20 text-brand-orange border border-brand-orange/30"
                              : film.film_tier === "top_rated"
                              ? "bg-brand-green/20 text-brand-green border border-brand-green/30"
                              : film.film_tier === "liked"
                              ? "bg-brand-blue/20 text-brand-blue border border-brand-blue/30"
                              : "bg-brand-darker text-brand-muted border border-brand-border"
                          }`}>
                            {film.film_tier.replace("_", " ")}
                          </span>
                        )}
                      </div>
                      {film.found_via && (
                        <div className="font-mono text-xs capitalize text-brand-muted">
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
        <div className="flex flex-col gap-3 pt-2 sm:flex-row">
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
              onClose();
              router.push(`/?user=${encodeURIComponent(user.username)}`);
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
