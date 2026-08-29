"use client";

import React from "react";
import { CheckCircle2, Globe, Layers, Users, Sparkles, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

export interface StatusProgressProps {
  isPending: boolean;
  elapsedSeconds: number;
  statusStep: number;
  selectedFilmsCount: number;
  locations: string[];
  maxPages: number;
}

export function StatusProgress({
  isPending,
  elapsedSeconds,
  statusStep,
  selectedFilmsCount,
  locations,
  maxPages,
}: StatusProgressProps) {
  if (!isPending) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-6 border-brand-green/40 space-y-4 rounded-3xl"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-border pb-3">
        <div className="flex items-center space-x-3">
          <span className="relative flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-green opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-brand-green"></span>
          </span>
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2 font-display">
              <span>Scouting Letterboxd Members</span>
              <span className="text-xs font-mono text-brand-green font-normal">
                &bull; {selectedFilmsCount} Films in {locations.join(", ")}
              </span>
            </h4>
            <p className="text-[11px] text-brand-subtext">
              Bypassing rate limits & scanning member network across target films and locations
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 bg-brand-darker px-3 py-1.5 rounded-xl border border-brand-border text-xs font-mono">
          <span className="text-brand-muted">Elapsed:</span>
          <span className="font-bold text-brand-green">{elapsedSeconds.toFixed(1)}s</span>
        </div>
      </div>

      {/* Stepper Status Progression */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-1 text-xs">
        <div
          className={`p-3 rounded-2xl border flex items-center space-x-2.5 transition ${
            statusStep >= 1
              ? "bg-brand-card border-brand-green/60 text-white"
              : "bg-brand-darker border-brand-border text-brand-muted"
          }`}
        >
          {statusStep > 1 ? (
            <CheckCircle2 className="w-4 h-4 text-brand-green shrink-0" />
          ) : (
            <Globe className="w-4 h-4 text-brand-green animate-pulse shrink-0" />
          )}
          <div className="min-w-0">
            <span className="block font-semibold truncate text-xs font-display">1. Connection</span>
            <span className="text-[10px] text-brand-subtext block truncate font-mono">
              {selectedFilmsCount} target films
            </span>
          </div>
        </div>

        <div
          className={`p-3 rounded-2xl border flex items-center space-x-2.5 transition ${
            statusStep >= 2
              ? "bg-brand-card border-brand-green/60 text-white"
              : "bg-brand-darker border-brand-border text-brand-muted"
          }`}
        >
          {statusStep > 2 ? (
            <CheckCircle2 className="w-4 h-4 text-brand-green shrink-0" />
          ) : statusStep === 2 ? (
            <Loader2 className="w-4 h-4 text-brand-orange animate-spin shrink-0" />
          ) : (
            <Layers className="w-4 h-4 shrink-0" />
          )}
          <div className="min-w-0">
            <span className="block font-semibold truncate text-xs font-display">2. Reviews & Likes</span>
            <span className="text-[10px] text-brand-subtext block truncate font-mono">
              Parsing {maxPages} pages/film
            </span>
          </div>
        </div>

        <div
          className={`p-3 rounded-2xl border flex items-center space-x-2.5 transition ${
            statusStep >= 3
              ? "bg-brand-card border-brand-green/60 text-white"
              : "bg-brand-darker border-brand-border text-brand-muted"
          }`}
        >
          {statusStep > 3 ? (
            <CheckCircle2 className="w-4 h-4 text-brand-green shrink-0" />
          ) : statusStep === 3 ? (
            <Loader2 className="w-4 h-4 text-brand-blue animate-spin shrink-0" />
          ) : (
            <Users className="w-4 h-4 shrink-0" />
          )}
          <div className="min-w-0">
            <span className="block font-semibold truncate text-xs font-display">3. Member Profiles</span>
            <span className="text-[10px] text-brand-subtext block truncate font-mono">
              {locations.join(", ")}
            </span>
          </div>
        </div>

        <div
          className={`p-3 rounded-2xl border flex items-center space-x-2.5 transition ${
            statusStep >= 4
              ? "bg-brand-card border-brand-green/60 text-white"
              : "bg-brand-darker border-brand-border text-brand-muted"
          }`}
        >
          {statusStep >= 4 ? (
            <Loader2 className="w-4 h-4 text-brand-green animate-spin shrink-0" />
          ) : (
            <Sparkles className="w-4 h-4 shrink-0" />
          )}
          <div className="min-w-0">
            <span className="block font-semibold truncate text-xs font-display">4. Filtering</span>
            <span className="text-[10px] text-brand-subtext block truncate font-mono">
              Rendering matches
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
