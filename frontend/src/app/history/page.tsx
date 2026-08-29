/* Hallmark · page: /history · macrostructure: Workbench · theme: Midnight Cinema
 */
import { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock, MapPin, Film, Sparkles } from "lucide-react";
import { fetchHistory } from "@/lib/api";
import HistoryClearButton from "@/components/HistoryClearButton";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Search Logs & History — MovieMatch",
  description: "Review and inspect your historical Letterboxd scans and matches.",
};

export default async function HistoryPage() {
  const historyRes = await fetchHistory(100);
  const historyList = historyRes?.history || [];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-brand-border/80 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-display flex items-center gap-2">
            <Clock className="w-6 h-6 text-brand-green" />
            <span>Search <span className="text-brand-green">History</span></span>
          </h1>
          <p className="text-xs text-brand-subtext mt-1">
            Review and inspect past Letterboxd scouts and recorded matches.
          </p>
        </div>
        {historyList.length > 0 && <HistoryClearButton />}
      </div>

      <div className="space-y-3">
        {historyList.map((item) => (
          <div
            key={item.id}
            className="glass-card rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-brand-borderLight transition-all group"
          >
            <div>
              <div className="flex items-center space-x-2.5">
                <span className="text-base sm:text-lg font-bold text-white font-display group-hover:text-brand-green transition-colors">
                  {item.film_title || item.film_slug}
                </span>
                <span className="text-xs font-mono text-brand-muted">
                  ({item.film_slug})
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 mt-2 text-xs text-brand-subtext font-mono">
                <Badge variant="location" className="text-[11px] py-0.5 px-2">
                  <MapPin className="w-3 h-3 text-brand-green" />
                  <span>{item.location_query}</span>
                </Badge>
                <span>&bull;</span>
                <span>Sentiment: <strong className="text-white">{item.sentiment}</strong></span>
                <span>&bull;</span>
                <span className="text-brand-muted">{new Date(item.created_at * 1000).toLocaleString()}</span>
              </div>
            </div>

            <div className="flex items-center space-x-3 shrink-0">
              <Badge variant="matchHigh" className="text-xs px-3 py-1 font-mono">
                {item.matches_count} Matches
              </Badge>
              <Link
                href={`/history/${item.id}`}
                className="px-3.5 py-2 rounded-xl bg-brand-card hover:bg-brand-cardHover border border-brand-border text-xs text-white transition flex items-center space-x-1.5 font-semibold font-mono"
              >
                <span>View</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        ))}

        {historyList.length === 0 && (
          <div className="text-center py-20 glass-card rounded-3xl text-brand-muted space-y-3">
            <Clock className="w-10 h-10 mx-auto text-brand-muted opacity-40 mb-1" />
            <p className="font-bold text-white text-base font-display">No previous searches recorded yet.</p>
            <p className="text-xs text-brand-subtext max-w-sm mx-auto">
              Run a scout on the &quot;Scout Cinema&quot; or &quot;Taste Soulmates&quot; tab to save your match records.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
