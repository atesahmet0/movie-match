/* Hallmark · component: Input · genre: atmospheric · theme: Midnight Cinema
 * states: default · hover · focus · active · disabled · error
 */
"use client";

import * as React from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  leftElement?: React.ReactNode;
  rightElement?: React.ReactNode;
  error?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, leftElement, rightElement, error, disabled, ...props }, ref) => {
    return (
      <div className="relative flex items-center w-full">
        {leftElement && (
          <div className="absolute left-3.5 flex items-center pointer-events-none text-brand-muted z-10">
            {leftElement}
          </div>
        )}
        <input
          type={type}
          className={cn(
            "flex h-10 w-full rounded-xl border bg-brand-darker px-3.5 py-2 text-xs font-medium text-white transition-all",
            "placeholder:text-brand-muted",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/60 focus-visible:border-brand-green/80",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error
              ? "border-red-500/60 focus-visible:ring-red-500/50"
              : "border-brand-border hover:border-brand-borderLight",
            leftElement ? "pl-9" : "",
            rightElement ? "pr-9" : "",
            className
          )}
          ref={ref}
          disabled={disabled}
          {...props}
        />
        {rightElement && (
          <div className="absolute right-3 flex items-center text-brand-muted z-10">
            {rightElement}
          </div>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };
