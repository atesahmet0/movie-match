/* Hallmark · component: MatchResults · genre: editorial utility · theme: Studio Projection
 * The Movie Match result view. It runs on the connected member's pinned
 * favorites alone — no film picker, no scouting controls.
 */
"use client";

import React, { useDeferredValue, useMemo, useEffect, useRef } from "react";
import { Compass, Loader2, Sparkles } from "lucide-react";
import TasteMatchCard from "@/components/TasteMatchCard";
import { TasteMatchResult } from "@/lib/types";
import { useSearchStream } from "@/lib/hooks/use-search-stream";
import { trackSearchCompleted, trackSearchFailed } from "@/lib/analytics";

interface MatchResultsProps {
  /** The connected member, excluded from their own results. */
  username: string;
  /** Slugs of that member's pinned favorites — the only films matched on. */
  favoriteFilms: string[];
  location: string;
  /** Shared-film goal. Members below it appear only as a fallback. */
  targetShared?: number;
  /** Changes on every explicit re-run of the match. */
  searchRun?: string;
}

export default function MatchResults({
  username,
  favoriteFilms,
  location,
  targetShared = 3,
  searchRun = "",
}: MatchResultsProps) {
  const searchUrl = useMemo(() => {
    if (!username || favoriteFilms.length === 0) return null;
    const params = new URLSearchParams({
      films: favoriteFilms.join(","),
      location: location || "Anywhere",
      sentiment: "liked",
      max_pages: "6",
      limit: "10",
      include_bio: "false",
      // The goal is `target_shared`; the floor stays at 1 so that when nobody
      // reaches the goal the backend can still return the next best members.
      min_shared: "1",
      target_shared: String(targetShared),
      favorites_only: "true",
      source_username: username,
    });
    if (searchRun) {
      params.set("request_id", searchRun);
      params.set("refresh", "true");
    }
    return `/api/search/stream?${params.toString()}`;
  }, [username, favoriteFilms, location, targetShared, searchRun]);

  const { matches, stats, progress, isSearching, error } = useSearchStream({
    url: searchUrl,
    runKey: searchRun,
    initialProgress: "Reading who liked your favorites…",
  });

  const trackedRef = useRef(false);

  useEffect(() => {
    if (isSearching) {
      trackedRef.current = false;
    } else if (!isSearching && searchUrl && !trackedRef.current) {
      trackedRef.current = true;
      if (error) {
        trackSearchFailed({
          type: "taste_match",
          error: error,
        });
      } else {
        trackSearchCompleted({
          type: "taste_match",
          matchesCount: matches.length,
          durationMs: stats ? stats.elapsed_seconds * 1000 : undefined,
          location: location,
        });
      }
    }
  }, [isSearching, error, matches.length, stats, location, searchUrl]);

  const deferredMatches = useDeferredValue(matches) as TasteMatchResult[];
  const goal = stats?.target_shared_films || Math.min(targetShared, favoriteFilms.length);
  const qualified = deferredMatches.filter((match) => match.shared_films_count >= goal);
  const others = deferredMatches.filter((match) => match.shared_films_count < goal);
  // Only a finished scan can say nobody reached the goal; mid-scan the list is
  // still filling, so it stays framed as a running best-so-far.
  const isFallback = !isSearching && qualified.length === 0 && others.length > 0;
  const headline = deferredMatches[0];

  if (!searchUrl) return null;

  return (
    <div className="space-y-8" aria-live="polite">
      <section className="result-summary">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-white">
            {isSearching ? (
              <Loader2 className="h-4 w-4 animate-spin text-brand-green" />
            ) : (
              <Sparkles className="h-4 w-4 text-brand-green" />
            )}
            <span>
              {isSearching
                ? `Matching ${favoriteFilms.length} favorites (${deferredMatches.length} found)`
                : headline
                ? `${isFallback ? "Closest member" : "Movie Match"}: ${
                    headline.display_name || headline.username
                  }`
                : "No Movie Match yet"}
            </span>
          </h2>
          <p className="mt-1 text-sm text-brand-subtext">{progress}</p>
        </div>
        {stats && (
          <span className="font-mono text-xs text-brand-subtext tabular-nums">
            {stats.elapsed_seconds.toFixed(1)}s
          </span>
        )}
      </section>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-[color:var(--color-error)] bg-[color:var(--color-error-soft)] p-4 text-sm text-[color:var(--color-error)]"
        >
          {error}
        </div>
      )}

      {headline && (
        <div className="space-y-8">
          <section aria-label="Movie Match" className="space-y-3">
            <h3 className="font-mono text-xs font-bold uppercase tracking-wide text-brand-green">
              {isSearching
                ? `Best so far (${headline.shared_films_count} of ${goal} favorites)`
                : isFallback
                ? `Closest member (${headline.shared_films_count} of ${goal} favorites)`
                : "Movie Match"}
            </h3>
            <TasteMatchCard match={headline} index={0} highlight />
          </section>

          {deferredMatches.length > 1 && (
            <section aria-label="Other members" className="space-y-3">
              <h3 className="font-mono text-xs font-bold uppercase tracking-wide text-brand-muted">
                Other members who liked your favorites ({deferredMatches.length - 1})
              </h3>
              <div className="result-grid result-grid--two">
                {deferredMatches.slice(1).map((match, index) => (
                  <TasteMatchCard key={match.username} match={match} index={index + 1} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {!isSearching && !error && stats && deferredMatches.length === 0 && (
        <section className="empty-state">
          <Compass className="h-8 w-8 text-brand-muted" />
          <h2 className="text-xl font-bold text-white">
            No member in &quot;{location || "Anywhere"}&quot; liked your favorites.
          </h2>
          <p className="max-w-md text-sm text-brand-subtext">
            Try a wider location, or pin different favorites on your Letterboxd profile.
          </p>
        </section>
      )}
    </div>
  );
}
