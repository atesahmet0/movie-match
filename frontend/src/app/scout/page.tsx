/* Hallmark · page: /scout · macrostructure: Workbench · theme: Midnight Cinema
 */
import { Metadata } from "next";
import { fetchSingleSearch, fetchTasteMatch } from "@/lib/api";
import ScoutForm from "@/components/ScoutForm";
import ScoutResultCard from "@/components/ScoutResultCard";
import TasteMatchCard from "@/components/TasteMatchCard";
import ExportButtons from "@/components/ExportButtons";
import { Compass, Search, Users } from "lucide-react";

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
  const filmsParam =
    typeof resolvedParams.films === "string"
      ? resolvedParams.films
      : typeof resolvedParams.film === "string"
      ? resolvedParams.film
      : "";

  const filmList = Array.from(
    new Set(
      filmsParam
        .split(",")
        .map((f) => f.trim().toLowerCase().replace(/\/+$/, "").split("/").pop())
        .filter(Boolean) as string[]
    )
  );

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
      ? resolvedParams.include_bio === "true"
      : false;

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
    <div className="space-y-10">
      <section className="workspace-grid pt-4" aria-labelledby="scout-title">
        <div className="space-y-6 lg:sticky lg:top-24">
          <Search className="h-7 w-7 text-brand-green" aria-hidden="true" />
          <h1 id="scout-title" className="page-title">Scout the audience.</h1>
          <p className="page-lede">
            Choose one or more films, set a location, and decide which kind of activity counts. Results show the public evidence behind every member.
          </p>
          <p className="max-w-[48ch] border-t border-brand-border pt-5 text-sm text-brand-subtext">
            One film finds people around that title. Several films rank members by overlap across the set.
          </p>
        </div>

        <ScoutForm
          initialFilms={filmList.length > 0 ? filmList : ["parasite-2019"]}
          initialLocation={locationParam}
          initialSentiment={sentimentParam}
          initialPages={maxPagesParam}
          initialLimit={limitParam}
          initialIncludeBio={includeBioParam}
        />
      </section>

      {errorMsg && (
        <div role="alert" className="rounded-lg border border-[color:var(--color-error)] bg-[color:var(--color-error-soft)] p-4 text-sm text-[color:var(--color-error)]">
          {errorMsg}
        </div>
      )}

      {/* Multi-Film Stats Bar */}
      {(singleSearchResponse || tasteMatchResponse) && (
        <section className="result-summary" aria-live="polite">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold text-white">
              <Users className="w-4 h-4 text-brand-green" />
              <span>
                Found {totalMatches} Matches across {filmList.length} {filmList.length === 1 ? "Film" : "Films"} in {locationParam}
              </span>
            </h2>
            <p className="mt-1 text-sm text-brand-subtext">
              Scanned {totalScanned} candidate members across target interaction pages.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {singleSearchResponse && (
              <ExportButtons
                filmSlug={singleSearchResponse.film?.slug || filmList[0]}
                stats={singleSearchResponse.stats}
                matches={singleSearchResponse.matches}
              />
            )}
            <span className="whitespace-nowrap font-mono text-xs font-bold text-brand-subtext tabular-nums">
              {elapsedSec.toFixed(2)}s
            </span>
          </div>
        </section>
      )}

      {/* Multi-Film Results Grid */}
      {isMulti && tasteMatchResponse && tasteMatchResponse.matches.length > 0 && (
        <section className="result-grid result-grid--two" aria-label="Multi-film scout results">
          {tasteMatchResponse.matches.map((match, idx) => (
            <TasteMatchCard key={match.username} match={match} index={idx} />
          ))}
        </section>
      )}

      {/* Single-Film Results Grid */}
      {!isMulti && singleSearchResponse && singleSearchResponse.matches.length > 0 && (
        <section className="result-grid result-grid--three" aria-label="Scout results">
          {singleSearchResponse.matches.map((match, idx) => (
            <ScoutResultCard key={match.username} match={match} index={idx} />
          ))}
        </section>
      )}

      {/* Empty State */}
      {(singleSearchResponse || tasteMatchResponse) && totalMatches === 0 && (
        <section className="empty-state">
          <Compass className="h-8 w-8 text-brand-muted" />
          <h2 className="text-xl font-bold text-white">
            No matching members found in &quot;{locationParam}&quot;.
          </h2>
          <p className="max-w-md text-sm text-brand-subtext">
            Try increasing Scan Depth, adding more film targets, or setting Location to &quot;Anywhere&quot;.
          </p>
        </section>
      )}
    </div>
  );
}
