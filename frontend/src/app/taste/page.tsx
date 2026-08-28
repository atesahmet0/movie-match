import { Metadata } from "next";
import { fetchTasteMatch } from "@/lib/api";
import TasteForm from "@/components/TasteForm";
import TasteMatchCard from "@/components/TasteMatchCard";

export const dynamic = "force-dynamic";

interface TastePageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ searchParams }: TastePageProps): Promise<Metadata> {
  const resolvedParams = await searchParams;
  const films = typeof resolvedParams.films === "string" ? resolvedParams.films : "";
  const location = typeof resolvedParams.location === "string" ? resolvedParams.location : "Anywhere";

  if (films) {
    return {
      title: `Taste Match for ${films} in ${location} - MovieMatch`,
      description: `Find Letterboxd members in ${location} who share taste in ${films}.`,
    };
  }

  return {
    title: "Taste Compatibility Matcher - Letterboxd Soulmates",
    description:
      "Select multiple movies you love to find local members who share your specific taste across multiple films.",
  };
}

export default async function TastePage({ searchParams }: TastePageProps) {
  const resolvedParams = await searchParams;
  const filmsParam = typeof resolvedParams.films === "string" ? resolvedParams.films : "";
  const locationParam =
    typeof resolvedParams.location === "string" ? resolvedParams.location : "Anywhere";
  const minSharedParam =
    typeof resolvedParams.minShared === "string" ? parseInt(resolvedParams.minShared) || 1 : 1;
  const maxPagesParam =
    typeof resolvedParams.maxPages === "string" ? parseInt(resolvedParams.maxPages) || 2 : 2;

  const filmList = filmsParam
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean);

  let tasteResponse = null;
  let errorMsg = null;

  if (filmList.length > 0) {
    try {
      tasteResponse = await fetchTasteMatch({
        films: filmList,
        location_query: locationParam,
        min_shared_films: minSharedParam,
        max_pages_per_film: maxPagesParam,
        limit_matches: 50,
      });
    } catch (err: unknown) {
      errorMsg = err instanceof Error ? err.message : "Error executing taste match";
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Intro */}
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-1">
          Taste Compatibility Matcher
        </h1>
        <p className="text-brand-subtext text-xs sm:text-sm">
          Select multiple movies you love to find local members who share your specific taste across multiple films.
        </p>
      </div>

      {/* Interactive Config Box */}
      <TasteForm
        initialFilms={filmList}
        initialLocation={locationParam}
        initialMinShared={minSharedParam}
        initialPages={maxPagesParam}
      />

      {errorMsg && (
        <div className="solid-card rounded-2xl p-5 max-w-4xl mx-auto text-center border-red-500/50 text-red-400 text-sm">
          {errorMsg}
        </div>
      )}

      {/* Taste Stats Bar */}
      {tasteResponse && (
        <div className="solid-card rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 max-w-4xl mx-auto">
          <div>
            <h3 className="text-sm font-bold text-white">
              Found {tasteResponse.matches_count} Taste Matches in {locationParam}
            </h3>
            <p className="text-xs text-brand-subtext">
              Scanned {tasteResponse.stats?.total_users_discovered || 0} candidate members.
            </p>
          </div>
          <div className="flex items-center space-x-4 text-xs font-mono">
            <div>
              Time:{" "}
              <span className="text-brand-green font-bold">
                {(tasteResponse.stats?.elapsed_seconds || 0).toFixed(2)}s
              </span>
            </div>
            <div>
              Hits:{" "}
              <span className="text-brand-blue font-bold">
                {tasteResponse.matches_count}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Results Cards */}
      {tasteResponse && tasteResponse.matches.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
          {tasteResponse.matches.map((match, idx) => (
            <TasteMatchCard key={match.username} match={match} index={idx} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {tasteResponse && tasteResponse.matches.length === 0 && (
        <div className="text-center py-12 solid-card rounded-2xl max-w-4xl mx-auto">
          <p className="font-semibold text-white">
            No members matched this exact criteria in this location.
          </p>
          <p className="text-xs text-brand-subtext mt-1">
            Try lowering &quot;Min Shared Films&quot; or broadening the location.
          </p>
        </div>
      )}
    </div>
  );
}
