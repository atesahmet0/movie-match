/* Hallmark · component: Input · genre: editorial utility · theme: Studio Projection
 * states: default · hover · focus · active · disabled · loading · error · success
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
            "flex h-11 w-full rounded-lg border bg-brand-card px-3.5 pr-10 py-2 text-sm font-medium text-white transition-colors",
            "placeholder:text-brand-muted",
            "focus-visible:border-brand-borderLight focus-visible:outline-2 focus-visible:outline-brand-green",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error
              ? "border-[color:var(--color-error)] bg-[color:var(--color-error-soft)]"
              : "border-brand-border hover:bg-brand-darker",
            leftElement ? "pl-9" : "",
            rightElement ? "pr-9" : "",
            className
          )}
          ref={ref}
          disabled={disabled}
          aria-invalid={error || undefined}
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
