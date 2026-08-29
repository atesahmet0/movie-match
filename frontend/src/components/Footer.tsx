/* Hallmark · component: Footer · archetype: Ft5 Statement Colophon · theme: Midnight Cinema
 */
"use client";

import React from "react";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="w-full border-t border-brand-border/80 bg-brand-darker/90 py-8 mt-16 text-xs text-brand-muted relative z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Brand info & nav links */}
          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-6 text-center sm:text-left">
            <div>
              <Link href="/" className="text-white font-extrabold font-display hover:text-brand-green transition-colors text-sm">
                Movie<span className="text-brand-green">Match</span>
              </Link>
              <span className="text-brand-muted ml-2 hidden md:inline">— Cinema Taste &amp; Location Matching</span>
            </div>

            <nav className="flex items-center gap-3 text-xs text-brand-subtext font-medium">
              <Link href="/" className="hover:text-white transition-colors">
                Movie Match
              </Link>
              <span className="text-brand-border">&bull;</span>
              <Link href="/scout" className="hover:text-white transition-colors">
                Find Members
              </Link>
            </nav>
          </div>

          {/* Live system state chip */}
          <div className="flex items-center gap-3 text-[11px] font-mono text-brand-muted">
            <div className="flex items-center gap-2 bg-brand-card/80 px-3 py-1 rounded-xl border border-brand-border">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-green opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-green"></span>
              </span>
              <span className="text-brand-subtext">Everything is Working</span>
            </div>
            <span className="hidden md:inline text-brand-border">&bull;</span>
            <span className="hidden md:inline">Built for Cinephiles</span>
          </div>
        </div>

        {/* Colophon & legal / data provider attribution */}
        <div className="mt-6 pt-6 border-t border-brand-border/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-brand-muted font-mono text-center sm:text-left">
          <div>
            Not affiliated with or endorsed by Letterboxd Limited. All film metadata and posters &copy; their respective owners.
          </div>
          <div className="flex items-center gap-2 text-brand-subtext shrink-0">
            <a
              href="https://letterboxd.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white hover:underline transition-colors"
            >
              Letterboxd
            </a>
            <span className="text-brand-border">&bull;</span>
            <a
              href="https://www.themoviedb.org"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white hover:underline transition-colors"
            >
              TMDB
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

