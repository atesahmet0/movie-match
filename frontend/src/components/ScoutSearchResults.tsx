"use client";

import React, { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Compass, Loader2, Users } from "lucide-react";
import ExportButtons from "@/components/ExportButtons";
import ScoutResultCard from "@/components/ScoutResultCard";
import TasteMatchCard from "@/components/TasteMatchCard";
import {
  ScanStats,
  SearchResponse,
  TasteMatchResponse,
  TasteMatchResult,
  UserMatch,
} from "@/lib/types";

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

type StreamMatch = UserMatch | TasteMatchResult;
type CompletePayload = SearchResponse | TasteMatchResponse;

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
  const [matches, setMatches] = useState<StreamMatch[]>([]);
  const [stats, setStats] = useState<ScanStats | null>(null);
  const [singlePayload, setSinglePayload] = useState<SearchResponse | null>(null);
  const [progress, setProgress] = useState("Preparing search…");
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deferredMatches = useDeferredValue(matches);
  const isMulti = films.length > 1;

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
    if (sourceUsername) params.set("source_username", sourceUsername);
    if (searchRun) {
      params.set("request_id", searchRun);
      params.set("refresh", "true");
    }
    return `/api/search/stream?${params.toString()}`;
  }, [films, location, sentiment, maxPages, limit, includeBio, minShared, sourceUsername, searchRun]);

  useEffect(() => {
    if (!searchUrl) return;
    const controller = new AbortController();
    const searchStartedAt = Date.now();
    let completionTimer: number | null = null;
    let timedOut = false;
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 60_000);

    const run = async () => {
      setMatches([]);
      setStats(null);
      setSinglePayload(null);
      setError(null);
      setProgress("Connecting to the search stream…");
      setIsSearching(true);

      try {
        const response = await fetch(searchUrl, {
          signal: controller.signal,
          headers: { Accept: "text/event-stream" },
          cache: "no-store",
        });
        if (!response.ok || !response.body) {
          throw new Error(`Search failed (HTTP ${response.status})`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const consumeEvent = (block: string) => {
          if (!block || block.startsWith(":")) return;
          let eventName = "message";
          const dataLines: string[] = [];
          for (const line of block.split("\n")) {
            if (line.startsWith("event:")) eventName = line.slice(6).trim();
            if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
          }
          if (dataLines.length === 0) return;
          const data = JSON.parse(dataLines.join("\n"));

          if (eventName === "progress") {
            setProgress(data.message || "Searching…");
          } else if (eventName === "result") {
            const next = data.match as StreamMatch;
            setMatches((current) =>
              current.some((match) => match.username === next.username)
                ? current
                : [...current, next]
            );
          } else if (eventName === "complete") {
            const payload = data.payload as CompletePayload;
            const finishSearch = () => {
              setStats(payload.stats);
              setMatches(payload.matches as StreamMatch[]);
              if (!isMulti) setSinglePayload(payload as SearchResponse);
              setProgress(
                payload.stats.partial
                  ? "Time limit reached — showing the best matches found so far."
                  : searchRun
                  ? "Results refreshed."
                  : payload.stats.cache_status === "hit"
                  ? "Loaded from the shared search cache."
                  : "Search complete."
              );
              setIsSearching(false);
            };
            const feedbackDelay = searchRun
              ? Math.max(0, 600 - (Date.now() - searchStartedAt))
              : 0;
            if (feedbackDelay > 0) {
              completionTimer = window.setTimeout(finishSearch, feedbackDelay);
            } else {
              finishSearch();
            }
          } else if (eventName === "error") {
            throw new Error("The search service could not finish this request.");
          } else if (eventName === "cancelled") {
            throw new Error("The search was cancelled before it finished.");
          }
        };

        while (true) {
          const { value, done } = await reader.read();
          buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, "\n");
          const blocks = buffer.split("\n\n");
          buffer = blocks.pop() || "";
          blocks.forEach(consumeEvent);
          if (done) {
            if (buffer.trim()) consumeEvent(buffer.trim());
            break;
          }
        }
      } catch (caught) {
        if (controller.signal.aborted && !timedOut) return;
        setError(
          timedOut
            ? "This search reached its one-minute limit. Any matches already found are shown below; try fewer pages or a narrower location for a faster result."
            : caught instanceof Error
            ? caught.message
            : "The search could not be completed. Please try again."
        );
        setIsSearching(false);
      } finally {
        window.clearTimeout(timeoutId);
      }
    };

    void run();
    return () => {
      window.clearTimeout(timeoutId);
      if (completionTimer !== null) window.clearTimeout(completionTimer);
      controller.abort();
    };
  }, [searchUrl, isMulti, searchRun]);

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
                {isSearching ? "Scouting" : "Found"} {matches.length} {matches.length === 1 ? "match" : "matches"}
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
                {stats.elapsed_seconds.toFixed(2)}s · {stats.upstream_requests || 0} upstream
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

      {deferredMatches.length > 0 && (
        <section
          className={`result-grid ${isMulti ? "result-grid--two" : "result-grid--three"}`}
          aria-label="Scout results"
        >
          {isMulti
            ? deferredMatches.map((match, index) => (
                <TasteMatchCard
                  key={match.username}
                  match={match as TasteMatchResult}
                  index={index}
                />
              ))
            : deferredMatches.map((match) => (
                <ScoutResultCard key={match.username} match={match as UserMatch} />
              ))}
        </section>
      )}

      {!isSearching && !error && stats && matches.length === 0 && (
        <section className="empty-state">
          <Compass className="h-8 w-8 text-brand-muted" />
          <h2 className="text-xl font-bold text-white">No matching members found in &quot;{location}&quot;.</h2>
          <p className="max-w-md text-sm text-brand-subtext">
            Try increasing Scan Depth, adding more film targets, or setting Location to Anywhere.
          </p>
        </section>
      )}
    </div>
  );
}
