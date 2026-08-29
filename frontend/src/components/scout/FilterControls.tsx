"use client";

import React from "react";

export interface FilterControlsProps {
  sentiment: string;
  onSentimentChange: (val: string) => void;
  maxPages: number;
  onMaxPagesChange: (val: number) => void;
  limit: number;
  onLimitChange: (val: number) => void;
  includeBio: boolean;
  onIncludeBioChange: (val: boolean) => void;
}

export function FilterControls({
  sentiment,
  onSentimentChange,
  maxPages,
  onMaxPagesChange,
  limit,
  onLimitChange,
  includeBio,
  onIncludeBioChange,
}: FilterControlsProps) {
  return (
    <div className="space-y-4 pt-4 border-t border-brand-border/80">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold text-white mb-1.5 font-display">
            Sentiment Filter
          </label>
          <select
            value={sentiment}
            onChange={(e) => onSentimentChange(e.target.value)}
            className="w-full text-xs bg-brand-darker border border-brand-border rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-brand-green/60 focus:border-brand-green/80 cursor-pointer font-medium"
          >
            <option value="liked">Liked / High Rating (4-5 Stars)</option>
            <option value="disliked">Disliked / Low Rating (0.5-2 Stars)</option>
            <option value="all">All Members (Watched / Rated)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-white mb-1.5 font-display">
            Scan Depth
          </label>
          <select
            value={maxPages}
            onChange={(e) => onMaxPagesChange(parseInt(e.target.value) || 3)}
            className="w-full text-xs bg-brand-darker border border-brand-border rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-brand-green/60 focus:border-brand-green/80 cursor-pointer font-medium"
          >
            <option value={2}>2 Pages per film (~150 candidates)</option>
            <option value={3}>3 Pages per film (~225 candidates)</option>
            <option value={5}>5 Pages per film (~375 candidates)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-white mb-1.5 font-display">
            Matches Limit
          </label>
          <select
            value={limit}
            onChange={(e) => onLimitChange(parseInt(e.target.value) || 50)}
            className="w-full text-xs bg-brand-darker border border-brand-border rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-brand-green/60 focus:border-brand-green/80 cursor-pointer font-medium"
          >
            <option value={25}>Stop at 25 Matches</option>
            <option value={50}>Stop at 50 Matches</option>
            <option value={100}>Stop at 100 Matches</option>
          </select>
        </div>
      </div>

      <div className="flex items-center space-x-2.5 pt-1">
        <input
          type="checkbox"
          id="scout-bio-checkbox"
          checked={includeBio}
          onChange={(e) => onIncludeBioChange(e.target.checked)}
          className="rounded bg-brand-darker border-brand-border text-brand-green focus:ring-0 w-4 h-4 cursor-pointer accent-brand-green"
        />
        <label htmlFor="scout-bio-checkbox" className="text-xs text-brand-subtext cursor-pointer select-none">
          Search member profile bio in addition to location field
        </label>
      </div>
    </div>
  );
}
