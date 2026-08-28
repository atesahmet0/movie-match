import { Metadata } from "next";
import { fetchTasteMatch, fetchUserProfile } from "@/lib/api";
import TasteSoulmatesSection from "@/components/TasteSoulmatesSection";
import TasteMatchCard from "@/components/TasteMatchCard";
import { Sparkles, Heart } from "lucide-react";
import { UserFilmItem } from "@/lib/types";

export const dynamic = "force-dynamic";

interface TastePageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ searchParams }: TastePageProps): Promise<Metadata> {
  const resolvedParams = await searchParams;
  const user = typeof resolvedParams.user === "string" ? resolvedParams.user : "";
  const location = typeof resolvedParams.location === "string" ? resolvedParams.location : "Anywhere";

  if (user) {
    return {
      title: `Taste Soulmates for @${user} in ${location} - MovieMatch`,
      description: `Find Letterboxd members in ${location} who share the favorite films of @${user}.`,
    };
  }

  return {
    title: "Letterboxd Taste Soulmates - Match by Favorite Films",
    description:
      "Find local film lovers who share your 4 pinned favorite movies, ranked strictly by compatibility match ratio.",
  };
}

export default async function TastePage({ searchParams }: TastePageProps) {
  const resolvedParams = await searchParams;
  const userParam = typeof resolvedParams.user === "string" ? resolvedParams.user.trim() : "";
  const filmsParam = typeof resolvedParams.films === "string" ? resolvedParams.films : "";
  let locationParam =
    typeof resolvedParams.location === "string" ? resolvedParams.location : "";
  const minSharedParam =
    typeof resolvedParams.minShared === "string" ? parseInt(resolvedParams.minShared) || 1 : 1;
  const maxPagesParam =
    typeof resolvedParams.maxPages === "string" ? parseInt(resolvedParams.maxPages) || 2 : 2;

  let filmList = filmsParam
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean);

  // If user param was provided but no films yet, fetch user profile favorites
  if (userParam && filmList.length === 0) {
    try {
      const userProfile = await fetchUserProfile(userParam);
      if (userProfile?.profile?.favorite_films && userProfile.profile.favorite_films.length > 0) {
        filmList = userProfile.profile.favorite_films.map((f: UserFilmItem) => f.slug);
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
        limit_matches: 50,
      });
    } catch (err: unknown) {
      errorMsg = err instanceof Error ? err.message : "Error executing taste soulmates search";
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Intro */}
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-1 flex items-center justify-center gap-2">
          <Sparkles className="w-6 h-6 sm:w-7 sm:h-7 text-brand-green" />
          <span>Taste Soulmates</span>
        </h1>
        <p className="text-brand-subtext text-xs sm:text-sm">
          Discover members who love the same movies you do, ranked by compatibility match ratio.
        </p>
      </div>

      {/* 1-Click Soulmates Match Section */}
      <TasteSoulmatesSection
        initialUser={userParam}
        initialLocation={locationParam}
        initialFilms={filmList}
        initialMinShared={minSharedParam}
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
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Heart className="w-4 h-4 text-brand-green fill-brand-green" />
              <span>
                Found {tasteResponse.matches_count} Soulmates across {filmList.length} Favorite Films in {locationParam}
              </span>
            </h3>
            <p className="text-xs text-brand-subtext mt-0.5">
              Scanned {tasteResponse.stats?.total_users_discovered || 0} candidate members &bull; Ranked by match percentage
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
              Soulmates:{" "}
              <span className="text-brand-green font-bold">
                {tasteResponse.matches_count}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Ranked Soulmates Cards Grid */}
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
            No soulmates found sharing these favorite films in &quot;{locationParam}&quot;.
          </p>
          <p className="text-xs text-brand-subtext mt-1">
            Try setting location to &quot;Anywhere&quot; or matching at least 1 film.
          </p>
        </div>
      )}
    </div>
  );
}
