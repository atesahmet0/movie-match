import { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import { fetchHistory } from "@/lib/api";
import HistoryClearButton from "@/components/HistoryClearButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Search History - Letterboxd Movie Matcher",
  description: "Review and inspect your historical Letterboxd scans and matches.",
};

export default async function HistoryPage() {
  const historyRes = await fetchHistory(100);
  const historyList = historyRes?.history || [];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Previous Searches</h1>
          <p className="text-xs text-brand-subtext">
            Review and inspect your historical scans.
          </p>
        </div>
        {historyList.length > 0 && <HistoryClearButton />}
      </div>

      <div className="space-y-3">
        {historyList.map((item) => (
          <div
            key={item.id}
            className="solid-card rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-base font-bold text-white">
                  {item.film_title || item.film_slug}
                </span>
                <span className="text-xs font-mono text-brand-subtext">
                  ({item.film_slug})
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-brand-subtext">
                <span>Location: {item.location_query}</span>
                <span>&bull;</span>
                <span>Sentiment: {item.sentiment}</span>
                <span>&bull;</span>
                <span>{new Date(item.created_at * 1000).toLocaleString()}</span>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <span className="px-3 py-1 bg-brand-darker text-brand-green border border-brand-border rounded-lg text-xs font-bold font-mono">
                {item.matches_count} Matches
              </span>
              <Link
                href={`/history/${item.id}`}
                className="px-3 py-1.5 rounded-lg bg-brand-card hover:bg-brand-cardHover border border-brand-border text-xs text-white transition flex items-center space-x-1"
              >
                <span>View</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        ))}

        {historyList.length === 0 && (
          <div className="text-center py-16 solid-card rounded-2xl text-brand-muted space-y-2">
            <Clock className="w-8 h-8 mx-auto text-brand-muted mb-2 opacity-50" />
            <p className="font-medium text-white">No previous searches recorded yet.</p>
            <p className="text-xs text-brand-subtext">
              Run a scout on the &quot;Scout Any Film&quot; or &quot;Taste Soulmates&quot; tab to start saving history.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
