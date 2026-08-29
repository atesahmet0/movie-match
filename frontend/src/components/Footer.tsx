/* Hallmark · component: Footer · archetype: Ft5 Statement Colophon · theme: Midnight Cinema
 */
"use client";

import React from "react";
import Link from "next/link";
import { Sparkles, Film, Heart } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-brand-border/80 bg-brand-darker/90 py-8 mt-16 text-xs text-brand-muted relative z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand statement & Letterboxd tri-dot */}
        <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left">
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-brand-orange"></span>
            <span className="w-2 h-2 rounded-full bg-brand-green"></span>
            <span className="w-2 h-2 rounded-full bg-brand-blue"></span>
          </div>
          <div className="text-brand-subtext font-medium">
            <span className="text-white font-bold font-display">MovieMatch</span> — Cinema Taste Soulmates & Letterboxd Scout
          </div>
        </div>

        {/* Live system state chip */}
        <div className="flex items-center gap-4 text-[11px] font-mono text-brand-muted">
          <div className="flex items-center gap-1.5 bg-brand-card/80 px-2.5 py-1 rounded-lg border border-brand-border">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-green animate-pulse"></span>
            <span className="text-brand-subtext">Scraper Engine Online</span>
          </div>
          <span className="hidden sm:inline">&bull;</span>
          <span className="hidden sm:inline">Built for Cinephiles</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 pt-4 border-t border-brand-border/40 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] text-brand-muted font-mono">
        <div>Not affiliated with or endorsed by Letterboxd Limited. All film metadata and posters &copy; their respective owners.</div>
        <div className="text-brand-subtext flex items-center gap-1">
          <span>Letterboxd &bull; TMDB</span>
        </div>
      </div>
    </footer>
  );
}
