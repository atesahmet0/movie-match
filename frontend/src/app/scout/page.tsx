import { Metadata } from "next";
import { fetchSingleSearch } from "@/lib/api";
import ScoutForm from "@/components/ScoutForm";
import ScoutResultCard from "@/components/ScoutResultCard";
import ExportButtons from "@/components/ExportButtons";

export const dynamic = "force-dynamic";

interface ScoutPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ searchParams }: ScoutPageProps): Promise<Metadata> {
  const resolvedParams = await searchParams;
  const film = typeof resolvedParams.film === "string" ? resolvedParams.film : "";
  const location = typeof resolvedParams.location === "string" ? resolvedParams.location : "Anywhere";

  if (film) {
    return {
      title: `Scout fans of ${film} in ${location} - MovieMatch`,
      description: `Find Letterboxd members in ${location} who watched and rated ${film}.`,
    };
  }

  return {
    title: "Scout Film Lovers by Location - MovieMatch",
    description: "Filter Letterboxd members by movie, location, and sentiment.",
  };
}

export default async function ScoutPage({ searchParams }: ScoutPageProps) {
  const resolvedParams = await searchParams;
  const filmParam = typeof resolvedParams.film === "string" ? resolvedParams.film.trim() : "";
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

  let searchResponse = null;
  let errorMsg = null;

  if (filmParam) {
    try {
      searchResponse = await fetchSingleSearch({
        film: filmParam,
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

  return (
    <div className="space-y-6">
      {/* Intro Header */}
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-1">
          Scout Film Lovers by Location
        </h1>
        <p className="text-brand-subtext text-xs sm:text-sm">
          Filter Letterboxd members by movie, location, and sentiment.
        </p>
      </div>

      {/* Scout Form */}
      <ScoutForm
        initialFilm={filmParam || "vampire-hunter-d-bloodlust"}
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

      {/* Search Stats Bar */}
      {searchResponse && (
        <div className="solid-card rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 max-w-6xl mx-auto">
          <div>
            <h3 className="text-sm font-bold text-white">
              Found {searchResponse.matches_count} Matches for{" "}
              {searchResponse.stats?.film_title || filmParam} in {locationParam}
            </h3>
            <p className="text-xs text-brand-subtext">
              Scanned {searchResponse.stats?.total_users_discovered || 0} candidate members across{" "}
              {searchResponse.stats?.total_pages_scanned || 0} pages.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <ExportButtons
              filmSlug={searchResponse.film?.slug || filmParam}
              stats={searchResponse.stats}
              matches={searchResponse.matches}
            />
            <span className="text-xs font-mono text-brand-subtext">
              {(searchResponse.stats?.elapsed_seconds || 0).toFixed(2)}s
            </span>
          </div>
        </div>
      )}

      {/* Matches Grid */}
      {searchResponse && searchResponse.matches.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
          {searchResponse.matches.map((match) => (
            <ScoutResultCard key={match.username} match={match} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {searchResponse && searchResponse.matches.length === 0 && (
        <div className="text-center py-12 solid-card rounded-2xl max-w-4xl mx-auto">
          <p className="font-semibold text-white">
            No matching members found in &quot;{locationParam}&quot;.
          </p>
          <p className="text-xs text-brand-subtext mt-1">
            Try increasing Scan Depth or broadening the location query.
          </p>
        </div>
      )}
    </div>
  );
}
