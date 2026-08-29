/* Hallmark · page: /history/[id] · macrostructure: Workbench · theme: Midnight Cinema
 */
import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, MapPin } from "lucide-react";
import { fetchHistoryItem } from "@/lib/api";
import ScoutResultCard from "@/components/ScoutResultCard";
import ExportButtons from "@/components/ExportButtons";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

interface HistoryDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: HistoryDetailPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  return {
    title: `Historical Search #${resolvedParams.id} — MovieMatch`,
  };
}

export default async function HistoryDetailPage({ params }: HistoryDetailPageProps) {
  const resolvedParams = await params;
  const historyRes = await fetchHistoryItem(resolvedParams.id);

  if (!historyRes || !historyRes.item) {
    notFound();
  }

  const item = historyRes.item;
  const matches = item.results || [];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <Link
          href="/history"
          className="inline-flex items-center space-x-1.5 text-xs text-brand-subtext hover:text-white transition font-mono bg-brand-darker px-3 py-1.5 rounded-xl border border-brand-border"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Search History</span>
        </Link>
      </div>

      {/* History Item Summary Header */}
      <div className="glass-card rounded-3xl p-6 sm:p-7 border border-brand-border/90">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-xl sm:text-2xl font-extrabold text-white font-display">
                {item.film_title || item.film_slug}
              </h1>
              <span className="text-xs font-mono text-brand-muted">
                ({item.film_slug})
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 mt-2.5 text-xs text-brand-subtext font-mono">
              <Badge variant="location" className="text-xs py-0.5 px-2">
                <MapPin className="w-3.5 h-3.5 text-brand-green" />
                <span>{item.location_query}</span>
              </Badge>
              <span>&bull;</span>
              <span>Sentiment: <strong className="text-white">{item.sentiment}</strong></span>
              {item.rating_range && (
                <>
                  <span>&bull;</span>
                  <span>Rating: {item.rating_range}</span>
                </>
              )}
              <span>&bull;</span>
              <span className="inline-flex items-center space-x-1 text-brand-muted">
                <Clock className="w-3.5 h-3.5" />
                <span>{new Date(item.created_at * 1000).toLocaleString()}</span>
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            <ExportButtons
              filmSlug={item.film_slug}
              stats={{
                film_title: item.film_title,
                film_slug: item.film_slug,
                total_pages_scanned: 0,
                total_users_discovered: matches.length,
                profiles_fetched: matches.length,
                cache_hits: 0,
                matches_count: matches.length,
                elapsed_seconds: 0,
              }}
              matches={matches}
            />
            <Badge variant="matchHigh" className="text-xs px-3 py-1.5 font-mono">
              {matches.length} Matches
            </Badge>
          </div>
        </div>
      </div>

      {/* Matches Grid */}
      {matches.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {matches.map((match, idx) => (
            <ScoutResultCard key={match.username} match={match} index={idx} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 glass-card rounded-3xl text-xs text-brand-muted">
          No matches stored for this historical search.
        </div>
      )}
    </div>
  );
}

