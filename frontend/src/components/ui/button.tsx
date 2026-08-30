/* Hallmark · component: Button · genre: editorial utility · theme: Studio Projection
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
  "tactile-btn inline-flex items-center justify-center gap-2 whitespace-nowrap border text-sm font-semibold focus-visible:outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 select-none cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "border-brand-green bg-brand-green text-black hover:bg-brand-greenHover font-bold",
        cinema:
          "border-brand-green bg-brand-green text-black hover:bg-brand-greenHover font-bold",
        orange:
          "border-brand-green bg-brand-green text-black hover:bg-brand-greenHover font-bold",
        blue:
          "border-brand-border bg-brand-card text-brand-text hover:bg-brand-cardHover hover:border-brand-borderLight",
        secondary:
          "border-brand-border bg-brand-card text-brand-text hover:bg-brand-cardHover hover:border-brand-borderLight",
        outline:
          "border-brand-border bg-transparent text-brand-text hover:bg-brand-card hover:border-brand-borderLight",
        ghost:
          "border-transparent bg-transparent text-brand-subtext hover:bg-brand-card hover:text-white",
        glass:
          "border-brand-border bg-brand-card text-brand-text hover:bg-brand-cardHover hover:border-brand-borderLight",
        destructive:
          "border-[color:var(--color-error)] bg-[color:var(--color-error-soft)] text-[color:var(--color-error)] hover:bg-brand-card",
        link:
          "h-auto border-transparent bg-transparent p-0 text-brand-text underline decoration-brand-green decoration-2 underline-offset-4 hover:text-brand-green font-semibold",
      },
      size: {
        default: "h-11 px-4 rounded-lg",
        sm: "h-10 px-3 rounded-lg text-sm",
        lg: "h-12 px-6 rounded-lg text-base",
        icon: "h-11 w-11 rounded-lg p-0",
        "icon-sm": "h-10 w-10 rounded-lg p-0",
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
      asChild = false,
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
    const classes = cn(buttonVariants({ variant, size, className }));

    if (asChild) {
      const child = React.Children.only(children) as React.ReactElement<{
        className?: string;
      }>;
      return React.cloneElement(child, {
        ...props,
        className: cn(classes, child.props.className),
        ref,
      } as React.Attributes);
    }

    return (
      <button
        className={classes}
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
