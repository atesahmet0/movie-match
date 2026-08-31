"use client";

import { useEffect, useState } from "react";
import {
  ScanStats,
  SearchResponse,
  TasteMatchResponse,
  TasteMatchResult,
  UserMatch,
} from "@/lib/types";

export type StreamMatch = UserMatch | TasteMatchResult;
export type StreamPayload = SearchResponse | TasteMatchResponse;

interface UseSearchStreamOptions {
  /** Fully-formed `/api/search/stream` URL, or null to stay idle. */
  url: string | null;
  /** Changes on every explicit re-run, and gates the minimum feedback delay. */
  runKey?: string;
  initialProgress?: string;
}

export interface SearchStreamState {
  matches: StreamMatch[];
  stats: ScanStats | null;
  payload: StreamPayload | null;
  progress: string;
  isSearching: boolean;
  error: string | null;
}

/** Outlasts the server's own budgets (180s scan, 195s endpoint) so a slow
 *  search ends with partial results rather than a client-side abort. */
const CLIENT_TIMEOUT_MS = 200_000;

function completionMessage(stats: ScanStats, isRerun: boolean): string {
  if (stats.stop_reason === "strong_match") {
    return "Found a strong match — stopped searching.";
  }
  if (stats.fallback_used) {
    const target = stats.target_shared_films || 3;
    return `No member shared ${target} of the films in time — showing the next highest ranking members.`;
  }
  if (stats.partial) {
    return "Time limit reached — showing the best matches found so far.";
  }
  return isRerun ? "Results refreshed." : "Search complete.";
}

/**
 * Consumes the server-sent search stream: progress lines, matches as they are
 * discovered, and the final payload. Shared by the Movie Match and Scout
 * result views so both read the same events the backend emits.
 */
export function useSearchStream({
  url,
  runKey = "",
  initialProgress = "Searching for cinephiles with shared taste…",
}: UseSearchStreamOptions): SearchStreamState {
  const [matches, setMatches] = useState<StreamMatch[]>([]);
  const [stats, setStats] = useState<ScanStats | null>(null);
  const [payload, setPayload] = useState<StreamPayload | null>(null);
  const [progress, setProgress] = useState(initialProgress);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    const searchStartedAt = Date.now();
    let completionTimer: number | null = null;
    let timedOut = false;
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, CLIENT_TIMEOUT_MS);

    const run = async () => {
      setMatches([]);
      setStats(null);
      setPayload(null);
      setError(null);
      setProgress(initialProgress);
      setIsSearching(true);

      try {
        const response = await fetch(url, {
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
            const complete = data.payload as StreamPayload;
            const finishSearch = () => {
              setStats(complete.stats);
              setMatches(complete.matches as StreamMatch[]);
              setPayload(complete);
              setProgress(completionMessage(complete.stats, Boolean(runKey)));
              setIsSearching(false);
            };
            // A re-run that returns instantly reads as a no-op; hold the
            // spinner just long enough for the refresh to be visible.
            const feedbackDelay = runKey
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
            ? "Search timed out. Any matches found so far are shown below; try selecting a specific city or country for faster results."
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
    // `initialProgress` is a constant label per call site, not a re-run trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, runKey]);

  return { matches, stats, payload, progress, isSearching, error };
}
