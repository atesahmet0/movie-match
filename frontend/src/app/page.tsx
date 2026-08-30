/* Hallmark · page: / · macrostructure: Workbench · theme: Midnight Cinema
 */
import { Metadata } from "next";
import { redirect } from "next/navigation";
import TasteSoulmatesSection from "@/components/TasteSoulmatesSection";
import { Heart, MapPin, Users } from "lucide-react";

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
  const locationParam =
    typeof resolvedParams.location === "string" ? resolvedParams.location.trim() : "";
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

  const filmList = Array.from(
    new Set(
      filmsParam
        .split(",")
        .map((film) => film.trim().toLowerCase().replace(/\/+$/, "").split("/").pop())
        .filter(Boolean) as string[]
    )
  );

  // Preserve old shared URLs while moving every actual search to the streamed UI.
  if (filmList.length > 0) {
    const params = new URLSearchParams({
      films: filmList.join(","),
      location: locationParam || "Anywhere",
      min_shared: String(Math.min(minSharedParam, filmList.length)),
      max_pages: String(maxPagesParam),
      limit: String(limitParam),
    });
    if (userParam) params.set("user", userParam);
    redirect(`/scout?${params.toString()}`);
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
          initialLocation={locationParam || "Anywhere"}
          initialMinShared={minSharedParam}
        />
      </section>
    </div>
  );
}
