/* Hallmark · page: / · macrostructure: Workbench · theme: Midnight Cinema
 */
import { Metadata } from "next";
import { fetchTasteMatch, fetchUserProfile } from "@/lib/api";
import TasteSoulmatesSection from "@/components/TasteSoulmatesSection";
import TasteMatchCard from "@/components/TasteMatchCard";
import { Compass, Heart, MapPin, Users } from "lucide-react";
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
    <div className="space-y-10">
      <section className="workspace-grid pt-4" aria-labelledby="match-title">
        <div className="space-y-7 lg:sticky lg:top-24">
          <div className="space-y-4">
            <h1 id="match-title" className="page-title">
              Find your film people.
            </h1>
            <p className="page-lede">
              Start with four films you already care about. MovieMatch looks for public Letterboxd members who share them, then filters by place.
            </p>
          </div>

          <dl className="grid gap-0 border-y border-brand-border text-sm">
            <div className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 border-b border-brand-border py-4">
              <Heart className="mt-0.5 h-4 w-4 text-brand-green" aria-hidden="true" />
              <div>
                <dt className="font-bold text-white">Taste first</dt>
                <dd className="mt-1 text-brand-subtext">Your pinned favorites become the matching signal.</dd>
              </div>
            </div>
            <div className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 border-b border-brand-border py-4">
              <MapPin className="mt-0.5 h-4 w-4 text-brand-green" aria-hidden="true" />
              <div>
                <dt className="font-bold text-white">Place second</dt>
                <dd className="mt-1 text-brand-subtext">Search a city, country, or anywhere.</dd>
              </div>
            </div>
            <div className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 py-4">
              <Users className="mt-0.5 h-4 w-4 text-brand-green" aria-hidden="true" />
              <div>
                <dt className="font-bold text-white">Evidence included</dt>
                <dd className="mt-1 text-brand-subtext">Every result shows the films and ratings behind the score.</dd>
              </div>
            </div>
          </dl>
        </div>

        <TasteSoulmatesSection
          initialUser={userParam}
          initialLocation={locationParam}
          initialFilms={filmList}
          initialMinShared={minSharedParam}
        />
      </section>

      {errorMsg && (
        <div role="alert" className="rounded-lg border border-[color:var(--color-error)] bg-[color:var(--color-error-soft)] p-4 text-sm text-[color:var(--color-error)]">
          {errorMsg}
        </div>
      )}

      {/* Match Stats Bar */}
      {tasteResponse && (
        <section className="result-summary" aria-live="polite">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold text-white">
              <Heart className="w-4 h-4 text-brand-green fill-brand-green shrink-0" />
              <span>
                Found {tasteResponse.matches_count} Movie Matches in {locationParam}
              </span>
            </h2>
            <p className="mt-1 text-sm text-brand-subtext">
              Scanned {tasteResponse.stats?.total_users_discovered || 0} candidate members across {filmList.length} cornerstone films &bull; Ranked by compatibility %
            </p>
          </div>
          <div className="flex items-center gap-4 whitespace-nowrap font-mono text-xs tabular-nums">
            <div>
              Time:{" "}
              <span className="text-brand-green font-bold">
                {(tasteResponse.stats?.elapsed_seconds || 0).toFixed(2)}s
              </span>
            </div>
            <div>
              Matches:{" "}
              <span className="text-brand-green font-bold">
                {tasteResponse.matches_count}
              </span>
            </div>
          </div>
        </section>
      )}

      {/* Ranked Match Cards Grid */}
      {tasteResponse && tasteResponse.matches.length > 0 && (
        <section className="result-grid result-grid--two" aria-label="Taste matches">
          {tasteResponse.matches.map((match, idx) => (
            <TasteMatchCard key={match.username} match={match} index={idx} />
          ))}
        </section>
      )}

      {/* Empty State */}
      {tasteResponse && tasteResponse.matches.length === 0 && (
        <section className="empty-state">
          <Compass className="h-8 w-8 text-brand-muted" />
          <h2 className="text-xl font-bold text-white">
            No movie matches found sharing these cornerstone films in &quot;{locationParam}&quot;.
          </h2>
          <p className="max-w-md text-sm text-brand-subtext">
            Try setting location to &quot;Anywhere&quot; or lowering the minimum matching requirement to 1 film.
          </p>
        </section>
      )}
    </div>
  );
}
