/* Hallmark · page: / · macrostructure: Workbench · theme: Midnight Cinema
 */
import { Metadata } from "next";
import { fetchTasteMatch, fetchUserProfile } from "@/lib/api";
import TasteSoulmatesSection from "@/components/TasteSoulmatesSection";
import TasteMatchCard from "@/components/TasteMatchCard";
import { Heart, Compass } from "lucide-react";
import { UserFilmItem } from "@/lib/types";

export const dynamic = "force-dynamic";

interface HomePageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ searchParams }: HomePageProps): Promise<Metadata> {
  const resolvedParams = await searchParams;
  const user = typeof resolvedParams.user === "string" ? resolvedParams.user : "";
  const location = typeof resolvedParams.location === "string" ? resolvedParams.location : "Anywhere";

  if (user) {
    return {
      title: `Movie Matches for @${user} in ${location} — MovieMatch`,
      description: `Find cinephiles in ${location} who share the favorite movies of @${user}.`,
    };
  }

  return {
    title: "MovieMatch — Cinema Taste & Location Matching",
    description:
      "Discover cinephiles who love the exact same movies you do in your area, ranked strictly by compatibility ratio.",
  };
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const resolvedParams = await searchParams;
  const userParam = typeof resolvedParams.user === "string" ? resolvedParams.user.trim() : "";
  const filmsParam = typeof resolvedParams.films === "string" ? resolvedParams.films : "";
  let locationParam =
    typeof resolvedParams.location === "string" ? resolvedParams.location : "";
  const minSharedParam =
    typeof resolvedParams.minShared === "string"
      ? parseInt(resolvedParams.minShared) || 1
      : typeof resolvedParams.min_shared === "string"
      ? parseInt(resolvedParams.min_shared) || 1
      : 1;
  const maxPagesParam =
    typeof resolvedParams.maxPages === "string"
      ? parseInt(resolvedParams.maxPages) || 2
      : typeof resolvedParams.max_pages === "string"
      ? parseInt(resolvedParams.max_pages) || 2
      : 2;
  const limitParam =
    typeof resolvedParams.limit === "string"
      ? parseInt(resolvedParams.limit) || 10
      : typeof resolvedParams.limit_matches === "string"
      ? parseInt(resolvedParams.limit_matches) || 10
      : 10;

  let filmList = Array.from(
    new Set(
      filmsParam
        .split(",")
        .map((f) => f.trim().toLowerCase().replace(/\/+$/, "").split("/").pop())
        .filter(Boolean) as string[]
    )
  );

  if (userParam && filmList.length === 0) {
    try {
      const userProfile = await fetchUserProfile(userParam);
      if (userProfile?.profile?.favorite_films && userProfile.profile.favorite_films.length > 0) {
        filmList = Array.from(
          new Set(
            userProfile.profile.favorite_films
              .map((f: UserFilmItem) => f.slug.trim().toLowerCase().replace(/\/+$/, "").split("/").pop())
              .filter(Boolean) as string[]
          )
        );
        if (!locationParam && userProfile.profile.location) {
          locationParam = userProfile.profile.location;
        }
      }
    } catch (e) {
      console.warn("Could not auto-resolve user favorites:", e);
    }
  }

  if (!locationParam) {
    locationParam = "Anywhere";
  }

  let tasteResponse = null;
  let errorMsg = null;

  if (filmList.length > 0) {
    try {
      tasteResponse = await fetchTasteMatch({
        films: filmList,
        location_query: locationParam,
        min_shared_films: minSharedParam,
        max_pages_per_film: maxPagesParam,
        limit_matches: limitParam,
        include_bio: false,
        source_username: userParam || undefined,
      });
    } catch (err: unknown) {
      errorMsg = err instanceof Error ? err.message : "Error executing movie match search";
    }
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header Intro */}
      <div className="text-center max-w-2xl mx-auto py-2">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight mb-2 flex items-center justify-center font-display">
          <span>Movie <span className="text-brand-green">Match</span></span>
        </h1>
        <p className="text-brand-subtext text-xs sm:text-sm leading-relaxed">
          Discover cinephiles who love the exact same movies you do in your area, ranked by compatibility match ratio.
        </p>
      </div>

      {/* 1-Click Match Studio */}
      <TasteSoulmatesSection
        initialUser={userParam}
        initialLocation={locationParam}
        initialFilms={filmList}
        initialMinShared={minSharedParam}
      />

      {errorMsg && (
        <div className="solid-card rounded-2xl p-5 max-w-4xl mx-auto text-center border-red-500/50 text-red-400 text-xs sm:text-sm font-mono">
          {errorMsg}
        </div>
      )}

      {/* Match Stats Bar */}
      {tasteResponse && (
        <div className="glass-card rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 max-w-4xl mx-auto border border-brand-border/90">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2 font-display">
              <Heart className="w-4 h-4 text-brand-green fill-brand-green shrink-0" />
              <span>
                Found {tasteResponse.matches_count} Movie Matches in {locationParam}
              </span>
            </h3>
            <p className="text-xs text-brand-subtext mt-1">
              Scanned {tasteResponse.stats?.total_users_discovered || 0} candidate members across {filmList.length} cornerstone films &bull; Ranked by compatibility %
            </p>
          </div>
          <div className="flex items-center space-x-3 text-xs font-mono shrink-0">
            <div className="bg-brand-darker px-3 py-1.5 rounded-xl border border-brand-border">
              Time:{" "}
              <span className="text-brand-green font-bold">
                {(tasteResponse.stats?.elapsed_seconds || 0).toFixed(2)}s
              </span>
            </div>
            <div className="bg-brand-darker px-3 py-1.5 rounded-xl border border-brand-border">
              Matches:{" "}
              <span className="text-brand-green font-bold">
                {tasteResponse.matches_count}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Ranked Match Cards Grid */}
      {tasteResponse && tasteResponse.matches.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
          {tasteResponse.matches.map((match, idx) => (
            <TasteMatchCard key={match.username} match={match} index={idx} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {tasteResponse && tasteResponse.matches.length === 0 && (
        <div className="text-center py-16 glass-card rounded-3xl max-w-4xl mx-auto space-y-3">
          <Compass className="w-10 h-10 mx-auto text-brand-muted opacity-40" />
          <p className="font-bold text-white text-base font-display">
            No movie matches found sharing these cornerstone films in &quot;{locationParam}&quot;.
          </p>
          <p className="text-xs text-brand-subtext max-w-md mx-auto leading-relaxed">
            Try setting location to &quot;Anywhere&quot; or lowering the minimum matching requirement to 1 film.
          </p>
        </div>
      )}
    </div>
  );
}
