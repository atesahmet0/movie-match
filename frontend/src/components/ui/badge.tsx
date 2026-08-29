/* Hallmark · component: Badge · genre: atmospheric · theme: Midnight Cinema
 */
"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 select-none",
  {
    variants: {
      variant: {
        default:
          "border border-transparent bg-brand-green/20 text-brand-green border-brand-green/30",
        secondary:
          "border border-brand-border bg-brand-darker text-brand-subtext hover:border-brand-borderLight",
        destructive:
          "border border-red-500/30 bg-red-500/15 text-red-400",
        outline:
          "border border-brand-border text-brand-subtext bg-transparent",
        patron:
          "border border-brand-blue/40 bg-brand-blue/15 text-brand-blue font-bold font-mono tracking-wider shadow-sm",
        pro:
          "border border-brand-orange/40 bg-brand-orange/15 text-brand-orange font-bold font-mono tracking-wider shadow-sm",
        matchHigh:
          "border border-brand-green/50 bg-brand-green/15 text-brand-green font-bold font-mono shadow-sm",
        matchMedium:
          "border border-brand-orange/40 bg-brand-orange/15 text-brand-orange font-bold font-mono",
        matchLow:
          "border border-brand-border bg-brand-card text-brand-subtext font-mono",
        location:
          "border border-brand-border/80 bg-brand-darker/90 text-[#e1e7ed] font-medium",
        rating:
          "border border-brand-green/30 bg-brand-darker text-brand-green font-mono font-bold",
        chip:
          "border border-brand-border bg-brand-card hover:bg-brand-cardHover hover:border-brand-borderLight text-brand-subtext hover:text-white rounded-lg px-2.5 py-1 text-xs cursor-pointer transition-all",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
