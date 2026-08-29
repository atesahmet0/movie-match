/* Hallmark · component: Button · genre: atmospheric · theme: Midnight Cinema
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: pass (46–50)
 */
"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-xs font-semibold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/70 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-45 select-none active:scale-[0.98] cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-brand-green text-black hover:bg-brand-greenHover shadow-md shadow-brand-green/15 active:shadow-none font-bold",
        cinema:
          "bg-brand-green text-black hover:bg-brand-greenHover font-bold tracking-tight shadow-lg shadow-brand-green/20 hover:shadow-brand-green/35",
        orange:
          "bg-brand-orange text-white hover:bg-[#e67300] font-bold shadow-md shadow-brand-orange/20",
        blue:
          "bg-brand-blue text-black hover:bg-[#2fb0ec] font-bold shadow-md shadow-brand-blue/20",
        secondary:
          "bg-brand-card text-brand-text hover:bg-brand-cardHover hover:text-white border border-brand-border hover:border-brand-borderLight",
        outline:
          "border border-brand-border bg-transparent hover:bg-brand-card hover:text-white text-brand-subtext",
        ghost:
          "hover:bg-brand-card hover:text-white text-brand-subtext",
        glass:
          "bg-brand-card/75 backdrop-blur-md border border-brand-border/80 hover:border-brand-borderLight text-brand-text hover:text-white shadow-sm",
        destructive:
          "bg-red-500/15 border border-red-500/40 text-red-400 hover:bg-red-500/25 hover:border-red-500/60",
        link:
          "text-brand-green underline-offset-4 hover:underline p-0 h-auto font-normal",
      },
      size: {
        default: "h-9 px-4 py-2 rounded-xl",
        sm: "h-7.5 px-3 rounded-lg text-[11px]",
        lg: "h-11 px-6 rounded-2xl text-sm",
        icon: "h-9 w-9 rounded-xl p-0",
        "icon-sm": "h-7 w-7 rounded-lg p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  isLoading?: boolean;
  loadingText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      isLoading = false,
      loadingText,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || isLoading}
        data-state={isLoading ? "loading" : undefined}
        {...props}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
            {loadingText ? <span>{loadingText}</span> : children}
          </>
        ) : (
          <>
            {leftIcon && <span className="shrink-0">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="shrink-0">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
