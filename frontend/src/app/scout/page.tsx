/* Hallmark · page: /scout · macrostructure: Workbench · theme: Midnight Cinema
 */
import { Metadata } from "next";
import { fetchSingleSearch, fetchTasteMatch } from "@/lib/api";
import ScoutForm from "@/components/ScoutForm";
import ScoutResultCard from "@/components/ScoutResultCard";
import TasteMatchCard from "@/components/TasteMatchCard";
import ExportButtons from "@/components/ExportButtons";
import { Clapperboard, Compass, Users } from "lucide-react";

export const dynamic = "force-dynamic";

interface ScoutPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ searchParams }: ScoutPageProps): Promise<Metadata> {
  const resolvedParams = await searchParams;
  const rawFilms =
    typeof resolvedParams.films === "string"
      ? resolvedParams.films
      : typeof resolvedParams.film === "string"
      ? resolvedParams.film
      : "";
  const location = typeof resolvedParams.location === "string" ? resolvedParams.location : "Anywhere";

  if (rawFilms) {
    return {
      title: `Scout fans of ${rawFilms} in ${location} — MovieMatch`,
      description: `Find cinephiles in ${location} who watched and rated ${rawFilms}.`,
    };
  }

  return {
    title: "Find Members by Location — MovieMatch",
    description: "Filter cinephiles by movie, location, and sentiment.",
  };
}

export default async function ScoutPage({ searchParams }: ScoutPageProps) {
  const resolvedParams = await searchParams;
  const rawFilmsParam =
    typeof resolvedParams.films === "string"
      ? resolvedParams.films
      : typeof resolvedParams.film === "string"
      ? resolvedParams.film
      : "";

  const filmList = rawFilmsParam
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean);

  const locationParam =
    typeof resolvedParams.location === "string" ? resolvedParams.location.trim() : "Anywhere";
  const sentimentParam =
    typeof resolvedParams.sentiment === "string" ? resolvedParams.sentiment : "liked";
  const maxPagesParam =
    typeof resolvedParams.max_pages === "string"
      ? parseInt(resolvedParams.max_pages) || 2
      : typeof resolvedParams.maxPages === "string"
      ? parseInt(resolvedParams.maxPages) || 2
      : 2;
  const limitParam =
    typeof resolvedParams.limit === "string" ? parseInt(resolvedParams.limit) || 10 : 10;
  const includeBioParam =
    typeof resolvedParams.include_bio === "string"
      ? resolvedParams.include_bio !== "false"
      : true;

  let singleSearchResponse = null;
  let tasteMatchResponse = null;
  let errorMsg = null;

  if (filmList.length > 1) {
    // Multi-film scout
    try {
      tasteMatchResponse = await fetchTasteMatch({
        films: filmList,
        location_query: locationParam,
        min_shared_films: 1,
        sentiment: sentimentParam,
        max_pages_per_film: maxPagesParam,
        limit_matches: limitParam,
        include_bio: includeBioParam,
      });
    } catch (err: unknown) {
      errorMsg = err instanceof Error ? err.message : "Error executing multi-film scout search";
    }
  } else if (filmList.length === 1) {
    // Single-film scout
    try {
      singleSearchResponse = await fetchSingleSearch({
        film: filmList[0],
        location: locationParam,
        sentiment: sentimentParam,
        max_pages: maxPagesParam,
        limit: limitParam,
        include_bio: includeBioParam,
      });
    } catch (err: unknown) {
      errorMsg = err instanceof Error ? err.message : "Error executing scout search";
    }
  }

  const isMulti = filmList.length > 1;
  const totalMatches = isMulti
    ? tasteMatchResponse?.matches_count || 0
    : singleSearchResponse?.matches_count || 0;
  const totalScanned = isMulti
    ? tasteMatchResponse?.stats?.total_users_discovered || 0
    : singleSearchResponse?.stats?.total_users_discovered || 0;
  const elapsedSec = isMulti
    ? tasteMatchResponse?.stats?.elapsed_seconds || 0
    : singleSearchResponse?.stats?.elapsed_seconds || 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Intro Header */}
      <div className="text-center max-w-2xl mx-auto py-2">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight mb-2 flex items-center justify-center gap-2.5 font-display">
          <Clapperboard className="w-6 h-6 sm:w-7 sm:h-7 text-brand-green" />
          <span>Find <span className="text-brand-green">Members</span></span>
        </h1>
        <p className="text-brand-subtext text-xs sm:text-sm leading-relaxed">
          Filter Letterboxd fans across any movies, world cities, and sentiment criteria simultaneously.
        </p>
      </div>

      {/* Multi-Film Scout Form */}
      <ScoutForm
        initialFilms={filmList.length > 0 ? filmList : ["parasite-2019"]}
        initialLocation={locationParam}
        initialSentiment={sentimentParam}
        initialPages={maxPagesParam}
        initialLimit={limitParam}
        initialIncludeBio={includeBioParam}
      />

      {errorMsg && (
        <div className="solid-card rounded-2xl p-5 max-w-4xl mx-auto text-center border-red-500/50 text-red-400 text-xs sm:text-sm font-mono">
          {errorMsg}
        </div>
      )}

      {/* Multi-Film Stats Bar */}
      {(singleSearchResponse || tasteMatchResponse) && (
        <div className="glass-card rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-brand-border/90">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white font-display flex items-center gap-2">
              <Users className="w-4 h-4 text-brand-green" />
              <span>
                Found {totalMatches} Matches across {filmList.length} {filmList.length === 1 ? "Film" : "Films"} in {locationParam}
              </span>
            </h3>
            <p className="text-xs text-brand-subtext mt-1">
              Scanned {totalScanned} candidate members across target interaction pages.
            </p>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            {singleSearchResponse && (
              <ExportButtons
                filmSlug={singleSearchResponse.film?.slug || filmList[0]}
                stats={singleSearchResponse.stats}
                matches={singleSearchResponse.matches}
              />
            )}
            <span className="text-xs font-mono text-brand-green font-bold bg-brand-darker px-3 py-1.5 rounded-xl border border-brand-border">
              {elapsedSec.toFixed(2)}s
            </span>
          </div>
        </div>
      )}

      {/* Multi-Film Results Grid */}
      {isMulti && tasteMatchResponse && tasteMatchResponse.matches.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tasteMatchResponse.matches.map((match, idx) => (
            <TasteMatchCard key={match.username} match={match} index={idx} />
          ))}
        </div>
      )}

      {/* Single-Film Results Grid */}
      {!isMulti && singleSearchResponse && singleSearchResponse.matches.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {singleSearchResponse.matches.map((match, idx) => (
            <ScoutResultCard key={match.username} match={match} index={idx} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {(singleSearchResponse || tasteMatchResponse) && totalMatches === 0 && (
        <div className="text-center py-16 glass-card rounded-3xl space-y-3">
          <Compass className="w-10 h-10 mx-auto text-brand-muted opacity-40" />
          <p className="font-bold text-white text-base font-display">
            No matching members found in &quot;{locationParam}&quot;.
          </p>
          <p className="text-xs text-brand-subtext max-w-md mx-auto leading-relaxed">
            Try increasing Scan Depth, adding more film targets, or setting Location to &quot;Anywhere&quot;.
          </p>
        </div>
      )}
    </div>
  );
}
