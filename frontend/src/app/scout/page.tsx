import { Metadata } from "next";
import { fetchSingleSearch, fetchTasteMatch } from "@/lib/api";
import ScoutForm from "@/components/ScoutForm";
import ScoutResultCard from "@/components/ScoutResultCard";
import TasteMatchCard from "@/components/TasteMatchCard";
import ExportButtons from "@/components/ExportButtons";
import { Clapperboard } from "lucide-react";

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
      title: `Scout fans of ${rawFilms} in ${location} - MovieMatch`,
      description: `Find Letterboxd members in ${location} who watched and rated ${rawFilms}.`,
    };
  }

  return {
    title: "Scout Film Lovers by Location - MovieMatch",
    description: "Filter Letterboxd members by movie, location, and sentiment.",
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
    typeof resolvedParams.max_pages === "string" ? parseInt(resolvedParams.max_pages) || 3 : 3;
  const limitParam =
    typeof resolvedParams.limit === "string" ? parseInt(resolvedParams.limit) || 50 : 50;
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
    <div className="space-y-6">
      {/* Intro Header */}
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-1 flex items-center justify-center gap-2">
          <Clapperboard className="w-6 h-6 sm:w-7 sm:h-7 text-brand-green" />
          <span>Scout Film Lovers</span>
        </h1>
        <p className="text-brand-subtext text-xs sm:text-sm">
          Scout Letterboxd fans across multiple films, locations, and sentiment filters simultaneously.
        </p>
      </div>

      {/* Multi-Film Scout Form */}
      <ScoutForm
        initialFilms={filmList.length > 0 ? filmList : ["vampire-hunter-d-bloodlust"]}
        initialLocation={locationParam}
        initialSentiment={sentimentParam}
        initialPages={maxPagesParam}
        initialLimit={limitParam}
        initialIncludeBio={includeBioParam}
      />

      {errorMsg && (
        <div className="solid-card rounded-2xl p-5 max-w-4xl mx-auto text-center border-red-500/50 text-red-400 text-sm">
          {errorMsg}
        </div>
      )}

      {/* Multi-Film Stats Bar */}
      {(singleSearchResponse || tasteMatchResponse) && (
        <div className="solid-card rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 max-w-6xl mx-auto">
          <div>
            <h3 className="text-sm font-bold text-white">
              Found {totalMatches} Matches across {filmList.length} {filmList.length === 1 ? "Film" : "Films"} in {locationParam}
            </h3>
            <p className="text-xs text-brand-subtext">
              Scanned {totalScanned} candidate members across target interaction pages.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            {singleSearchResponse && (
              <ExportButtons
                filmSlug={singleSearchResponse.film?.slug || filmList[0]}
                stats={singleSearchResponse.stats}
                matches={singleSearchResponse.matches}
              />
            )}
            <span className="text-xs font-mono text-brand-green font-bold bg-brand-darker px-2.5 py-1 rounded-lg border border-brand-border">
              {elapsedSec.toFixed(2)}s
            </span>
          </div>
        </div>
      )}

      {/* Multi-Film Results Grid */}
      {isMulti && tasteMatchResponse && tasteMatchResponse.matches.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-6xl mx-auto">
          {tasteMatchResponse.matches.map((match, idx) => (
            <TasteMatchCard key={match.username} match={match} index={idx} />
          ))}
        </div>
      )}

      {/* Single-Film Results Grid */}
      {!isMulti && singleSearchResponse && singleSearchResponse.matches.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
          {singleSearchResponse.matches.map((match) => (
            <ScoutResultCard key={match.username} match={match} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {(singleSearchResponse || tasteMatchResponse) && totalMatches === 0 && (
        <div className="text-center py-12 solid-card rounded-2xl max-w-4xl mx-auto">
          <p className="font-semibold text-white">
            No matching members found in &quot;{locationParam}&quot;.
          </p>
          <p className="text-xs text-brand-subtext mt-1">
            Try increasing Scan Depth, adding more film targets, or setting Location to &quot;Anywhere&quot;.
          </p>
        </div>
      )}
    </div>
  );
}
