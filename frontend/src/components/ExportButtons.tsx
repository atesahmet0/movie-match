/* Hallmark · component: ExportButtons · genre: atmospheric · theme: Midnight Cinema
 */
"use client";

import React, { useState } from "react";
import { Check, FileJson, FileSpreadsheet } from "lucide-react";
import { ScanStats, UserMatch } from "@/lib/types";
import { trackExport } from "@/lib/analytics";
import { Button } from "@/components/ui/button";

interface ExportButtonsProps {
  filmSlug: string;
  stats: ScanStats;
  matches: UserMatch[];
}

export default function ExportButtons({ filmSlug, stats, matches }: ExportButtonsProps) {
  const [exportedFormat, setExportedFormat] = useState<"json" | "csv" | null>(null);

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

    trackExport({ format: "json", count: matches.length });
    setExportedFormat("json");
    setTimeout(() => setExportedFormat(null), 2000);
  };

  const handleExportCSV = () => {
    const csvCell = (value: unknown) => {
      const text = String(value ?? "");
      // Prevent spreadsheet formula injection while preserving the displayed value.
      const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
      return `"${safe.replace(/"/g, '""')}"`;
    };
    let csv = "username,display_name,location,matched_location,rating,liked,profile_url\n";
    matches.forEach((m) => {
      csv += [
        m.username,
        m.display_name,
        m.location,
        m.matched_location,
        m.user_rating,
        m.user_liked || false,
        m.profile_url,
      ].map(csvCell).join(",") + "\n";
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

    trackExport({ format: "csv", count: matches.length });
    setExportedFormat("csv");
    setTimeout(() => setExportedFormat(null), 2000);
  };

  return (
    <div className="flex items-center space-x-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleExportJSON}
        leftIcon={exportedFormat === "json" ? <Check className="w-3 h-3 text-brand-green" /> : <FileJson className="w-3 h-3 text-brand-green" />}
        className="font-mono text-xs"
      >
        <span>{exportedFormat === "json" ? "Saved JSON" : "Export JSON"}</span>
      </Button>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleExportCSV}
        leftIcon={exportedFormat === "csv" ? <Check className="w-3 h-3 text-brand-blue" /> : <FileSpreadsheet className="w-3 h-3 text-brand-blue" />}
        className="font-mono text-xs"
      >
        <span>{exportedFormat === "csv" ? "Saved CSV" : "Export CSV"}</span>
      </Button>
    </div>
  );
}
