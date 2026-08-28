"use client";

import { Download } from "lucide-react";
import { ScanStats, UserMatch } from "@/lib/types";

interface ExportButtonsProps {
  filmSlug: string;
  stats: ScanStats;
  matches: UserMatch[];
}

export default function ExportButtons({ filmSlug, stats, matches }: ExportButtonsProps) {
  const handleExportJSON = () => {
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify({ stats, matches }, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `matches_${filmSlug || "export"}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportCSV = () => {
    let csv = "username,display_name,location,matched_location,rating,liked,profile_url\n";
    matches.forEach((m) => {
      csv += `"${m.username}","${m.display_name}","${m.location}","${m.matched_location}","${m.user_rating || ""}","${m.user_liked || false}","${m.profile_url}"\n`;
    });
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute(
      "href",
      encodeURI("data:text/csv;charset=utf-8," + csv)
    );
    downloadAnchor.setAttribute("download", `matches_${filmSlug || "export"}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="flex items-center space-x-2">
      <button
        onClick={handleExportJSON}
        className="px-3 py-1 bg-brand-darker hover:bg-brand-cardHover border border-brand-border rounded-lg text-xs font-mono text-brand-green flex items-center space-x-1 cursor-pointer"
        title="Download JSON export"
      >
        <Download className="w-3 h-3" />
        <span>Export JSON</span>
      </button>
      <button
        onClick={handleExportCSV}
        className="px-3 py-1 bg-brand-darker hover:bg-brand-cardHover border border-brand-border rounded-lg text-xs font-mono text-brand-blue flex items-center space-x-1 cursor-pointer"
        title="Download CSV export"
      >
        <Download className="w-3 h-3" />
        <span>Export CSV</span>
      </button>
    </div>
  );
}
