"use client";

import React, { useState } from "react";
import UpcomingFeatureModal from "@/components/UpcomingFeatureModal";

export interface FilterControlsProps {
  sentiment: string;
  onSentimentChange: (val: string) => void;
  maxPages: number;
  onMaxPagesChange: (val: number) => void;
  limit: number;
  onLimitChange: (val: number) => void;
  includeBio?: boolean;
  onIncludeBioChange?: (val: boolean) => void;
}

export function FilterControls({
  sentiment,
  onSentimentChange,
  maxPages,
  onMaxPagesChange,
  limit,
  onLimitChange,
}: FilterControlsProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalDesc, setModalDesc] = useState("");
  const [modalKey, setModalKey] = useState("");

  const handleDepthSelect = (val: string) => {
    if (val === "extended") {
      setModalTitle("Extended Scan Depth");
      setModalDesc(
        "Extended scan depth parses 5+ pages of user ratings per film (~375 candidates/film) across Letterboxd. Enter your email to be notified when Extended Tier launches!"
      );
      setModalKey("extended_scan_depth");
      setModalOpen(true);
      return;
    }
    onMaxPagesChange(2);
  };

  const handleLimitSelect = (val: number) => {
    if (val !== 10) {
      setModalTitle(`${val} Matches Limit`);
      setModalDesc(
        `High-volume member scouting (${val} matches) requires higher scraper concurrency and is currently in early preview. Enter your email to receive early access!`
      );
      setModalKey(`matches_limit_${val}`);
      setModalOpen(true);
      return;
    }
    onLimitChange(10);
  };

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
          <label className="block text-xs font-semibold text-white mb-1.5 font-display flex items-center justify-between">
            <span>Scan Depth</span>
            <span className="text-brand-blue font-mono text-[11px]">Basic (2 pgs)</span>
          </label>
          <select
            value={maxPages >= 4 ? "extended" : "basic"}
            onChange={(e) => handleDepthSelect(e.target.value)}
            className="w-full text-xs bg-brand-darker border border-brand-border rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-brand-green/60 focus:border-brand-green/80 cursor-pointer font-medium"
          >
            <option value="basic">Basic (2 Pages per film) — Default</option>
            <option value="extended">Extended (5 Pages per film) 🔒</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-white mb-1.5 font-display flex items-center justify-between">
            <span>Matches Limit</span>
            <span className="text-brand-orange font-mono text-[11px]">{limit} Matches</span>
          </label>
          <select
            value={limit}
            onChange={(e) => handleLimitSelect(parseInt(e.target.value) || 10)}
            className="w-full text-xs bg-brand-darker border border-brand-border rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-brand-green/60 focus:border-brand-green/80 cursor-pointer font-medium"
          >
            <option value={10}>10 Matches (Default)</option>
            <option value={25}>25 Matches 🔒</option>
            <option value={50}>50 Matches 🔒</option>
            <option value={100}>100 Matches 🔒</option>
          </select>
        </div>
      </div>

      {/* Upcoming Feature Early Access Modal */}
      <UpcomingFeatureModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        featureTitle={modalTitle}
        featureDescription={modalDesc}
        featureKey={modalKey}
      />
    </div>
  );
}

