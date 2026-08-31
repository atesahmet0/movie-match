"use client";

import React, { useDeferredValue, useMemo } from "react";
import { Compass, Loader2, Users } from "lucide-react";
import ExportButtons from "@/components/ExportButtons";
import ScoutResultCard from "@/components/ScoutResultCard";
import TasteMatchCard from "@/components/TasteMatchCard";
import { SearchResponse, TasteMatchResult, UserMatch } from "@/lib/types";
import { useSearchStream } from "@/lib/hooks/use-search-stream";
import { useTaste } from "@/lib/taste-context";

interface ScoutSearchResultsProps {
  films: string[];
  location: string;
  sentiment: string;
  maxPages: number;
  limit: number;
  includeBio: boolean;
  minShared?: number;
  sourceUsername?: string;
  searchRun?: string;
}

export default function ScoutSearchResults({
  films,
  location,
  sentiment,
  maxPages,
  limit,
  includeBio,
  minShared = 1,
  sourceUsername = "",
  searchRun = "",
}: ScoutSearchResultsProps) {
  const isMulti = films.length > 1;
  const { activeUsername } = useTaste();
  // The URL param wins (a shared link is explicit), but a connected profile
  // still applies when the scout form was submitted without one.
  const effectiveSourceUsername = sourceUsername || activeUsername;

  const searchUrl = useMemo(() => {
    if (films.length === 0) return null;
    const params = new URLSearchParams({
      films: films.join(","),
      location,
      sentiment,
      max_pages: String(maxPages),
      limit: String(limit),
      include_bio: String(includeBio),
      min_shared: String(minShared),
    });
    if (effectiveSourceUsername) params.set("source_username", effectiveSourceUsername);
    if (searchRun) {
      params.set("request_id", searchRun);
      params.set("refresh", "true");
    }
    return `/api/search/stream?${params.toString()}`;
  }, [films, location, sentiment, maxPages, limit, includeBio, minShared, effectiveSourceUsername, searchRun]);

  const { matches, stats, payload, progress, isSearching, error } = useSearchStream({
    url: searchUrl,
    runKey: searchRun,
  });
  const deferredMatches = useDeferredValue(matches);
  const topMatch = deferredMatches[0] as TasteMatchResult | undefined;
  const singlePayload = !isMulti ? (payload as SearchResponse | null) : null;

  if (!searchUrl) return null;

  return (
    <div className="space-y-8" aria-live="polite">
      {(isSearching || matches.length > 0 || stats) && (
        <section className="result-summary">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold text-white">
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin text-brand-green" />
              ) : (
                <Users className="h-4 w-4 text-brand-green" />
              )}
              <span>
                {isSearching
                  ? `Scouting for a strong match (${matches.length} so far)`
                  : isMulti && matches.length > 0
                  ? `Best match: ${topMatch?.display_name || topMatch?.username}`
                  : `Found ${matches.length} ${matches.length === 1 ? "match" : "matches"}`}
              </span>
            </h2>
            <p className="mt-1 text-sm text-brand-subtext">{progress}</p>
          </div>
          <div className="flex items-center gap-3">
            {singlePayload && (
              <ExportButtons
                filmSlug={singlePayload.film?.slug || films[0]}
                stats={singlePayload.stats}
                matches={singlePayload.matches}
              />
            )}
            {stats && (
              <span className="font-mono text-xs text-brand-subtext tabular-nums">
                {stats.elapsed_seconds.toFixed(1)}s
              </span>
            )}
          </div>
        </section>
      )}

      {error && (
        <div role="alert" className="rounded-lg border border-[color:var(--color-error)] bg-[color:var(--color-error-soft)] p-4 text-sm text-[color:var(--color-error)]">
          {error}
        </div>
      )}

      {deferredMatches.length > 0 && isMulti && (
        <div className="space-y-8">
          {/* The search stops at the first convincing candidate, so the list is
              a headline plus context — not a leaderboard of equals. */}
          <section aria-label="Best match" className="space-y-3">
            <h3 className="font-mono text-xs font-bold uppercase tracking-wide text-brand-green">
              Best match
            </h3>
            <TasteMatchCard
              match={deferredMatches[0] as TasteMatchResult}
              index={0}
              highlight
            />
          </section>

          {deferredMatches.length > 1 && (
            <section aria-label="Other candidates" className="space-y-3">
              <h3 className="font-mono text-xs font-bold uppercase tracking-wide text-brand-muted">
                Other high-ranking candidates ({deferredMatches.length - 1})
              </h3>
              <div className="result-grid result-grid--two">
                {deferredMatches.slice(1).map((match, index) => (
                  <TasteMatchCard
                    key={match.username}
                    match={match as TasteMatchResult}
                    index={index + 1}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {deferredMatches.length > 0 && !isMulti && (
        <section className="result-grid result-grid--three" aria-label="Scout results">
          {deferredMatches.map((match) => (
            <ScoutResultCard key={match.username} match={match as UserMatch} />
          ))}
        </section>
      )}

      {!isSearching && !error && stats && matches.length === 0 && (
        <section className="empty-state">
          <Compass className="h-8 w-8 text-brand-muted" />
          <h2 className="text-xl font-bold text-white">No matching members found in &quot;{location}&quot;.</h2>
          <p className="max-w-md text-sm text-brand-subtext">
            Try adding more film targets or setting Location to Anywhere.
          </p>
        </section>
      )}
    </div>
  );
}
