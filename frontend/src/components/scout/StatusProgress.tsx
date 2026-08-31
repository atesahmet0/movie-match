/* Hallmark · component: StatusProgress · genre: editorial utility · theme: Studio Projection */
"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, Globe, Layers, Loader2, Sparkles, Users } from "lucide-react";

export interface StatusProgressProps {
  isPending: boolean;
  selectedFilmsCount: number;
  locations: string[];
  maxPages?: number;
}

export function StatusProgress({
  isPending,
  selectedFilmsCount,
  locations,
}: StatusProgressProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!isPending) return;
    const started = performance.now();
    const interval = window.setInterval(
      () => setElapsedSeconds((performance.now() - started) / 1000),
      250
    );
    return () => window.clearInterval(interval);
  }, [isPending]);

  if (!isPending) return null;

  const statusStep = elapsedSeconds > 7 ? 4 : elapsedSeconds > 3.5 ? 3 : elapsedSeconds > 1.2 ? 2 : 1;

  const steps = [
    {
      label: "Target films",
      detail: `${selectedFilmsCount} ${selectedFilmsCount === 1 ? "film" : "films"} selected`,
      icon: Globe,
    },
    {
      label: "Discover cinephiles",
      detail: "Finding film lovers",
      icon: Layers,
    },
    {
      label: "Check locations",
      detail: locations.join(", "),
      icon: Users,
    },
    {
      label: "Rank taste matches",
      detail: "Calculating shared films",
      icon: Sparkles,
    },
  ];

  return (
    <div role="status" aria-live="polite" className="workspace-panel space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-brand-border pb-4">
        <div className="flex items-start gap-3">
          <Loader2 className="mt-1 h-4 w-4 shrink-0 animate-spin text-brand-green" />
          <div>
            <h2 className="text-lg font-bold text-white">Finding movie matches</h2>
            <p className="mt-1 text-sm text-brand-subtext">
              Discovering cinephiles with shared favorites in your selected area.
            </p>
          </div>
        </div>
        <span className="whitespace-nowrap font-mono text-xs text-brand-muted tabular-nums">
          {elapsedSeconds.toFixed(1)} s
        </span>
      </div>

      <ol className="grid grid-cols-1 border-y border-brand-border text-sm sm:grid-cols-2">
        {steps.map((step, index) => {
          const complete = statusStep > index + 1;
          const active = statusStep === index + 1;
          const Icon = step.icon;
          return (
            <li
              key={step.label}
              className={`flex min-h-16 items-center gap-3 border-b border-brand-border p-3 last:border-b-0 sm:[&:nth-child(odd)]:border-r sm:[&:nth-child(3)]:border-b-0 ${
                active || complete ? "bg-brand-green/10 text-white" : "bg-brand-darker text-brand-muted"
              }`}
            >
              {complete ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-green" />
              ) : active ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-brand-green" />
              ) : (
                <Icon className="h-4 w-4 shrink-0" />
              )}
              <div className="min-w-0">
                <span className="block truncate font-semibold">{step.label}</span>
                <span className="block truncate font-mono text-xs text-brand-subtext">
                  {step.detail}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
