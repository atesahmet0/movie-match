/* Hallmark · page: /scout · macrostructure: Workbench · theme: Midnight Cinema
 */
import { Metadata } from "next";
import ScoutForm from "@/components/ScoutForm";
import ScoutSearchResults from "@/components/ScoutSearchResults";
import { Search } from "lucide-react";

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
  const minSharedParam =
    typeof resolvedParams.min_shared === "string"
      ? Math.max(1, parseInt(resolvedParams.min_shared) || 1)
      : 1;
  const sourceUsername =
    typeof resolvedParams.user === "string" ? resolvedParams.user.trim() : "";
  const searchRun =
    typeof resolvedParams.run === "string" ? resolvedParams.run : "";

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

      <ScoutSearchResults
        films={filmList}
        location={locationParam}
        sentiment={sentimentParam}
        maxPages={maxPagesParam}
        limit={limitParam}
        includeBio={includeBioParam}
        minShared={Math.min(minSharedParam, Math.max(1, filmList.length))}
        sourceUsername={sourceUsername}
        searchRun={searchRun}
      />
    </div>
  );
}
