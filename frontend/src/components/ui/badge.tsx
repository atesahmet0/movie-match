/* Hallmark · component: Badge · genre: editorial utility · theme: Studio Projection
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
  "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold select-none",
  {
    variants: {
      variant: {
        default:
          "border-brand-green bg-brand-green/15 text-brand-text",
        secondary:
          "border-brand-border bg-brand-darker text-brand-subtext",
        destructive:
          "border-[color:var(--color-error)] bg-[color:var(--color-error-soft)] text-[color:var(--color-error)]",
        outline:
          "border-brand-border text-brand-subtext bg-transparent",
        patron:
          "border-brand-border bg-brand-darker text-brand-text font-bold font-mono",
        pro:
          "border-brand-border bg-brand-darker text-brand-text font-bold font-mono",
        matchHigh:
          "border-brand-green bg-brand-green/20 text-brand-text font-bold font-mono",
        matchMedium:
          "border-brand-borderLight bg-brand-darker text-brand-text font-bold font-mono",
        matchLow:
          "border-brand-border bg-brand-card text-brand-subtext font-mono",
        location:
          "border-brand-border bg-brand-darker text-brand-text font-medium",
        rating:
          "border-brand-border bg-brand-darker text-brand-text font-mono font-bold",
        chip:
          "border-brand-border bg-brand-card text-brand-subtext rounded-lg px-2.5 py-1 text-xs",
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
