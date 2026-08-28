import * as React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "success" | "warning" | "info" | "outline" | "pro" | "patron";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variantStyles = {
    default: "bg-[#2c3440] text-[#e1e7ed] border-transparent",
    success: "bg-[#00e054]/15 text-[#00e054] border-[#00e054]/30",
    warning: "bg-[#ff8000]/15 text-[#ff8000] border-[#ff8000]/30",
    info: "bg-[#40bcf4]/15 text-[#40bcf4] border-[#40bcf4]/30",
    outline: "border-[#2c3440] text-[#99aabb]",
    pro: "bg-gradient-to-r from-[#ff8000] to-[#ff4500] text-white font-bold text-[10px] tracking-wider border-none shadow-sm",
    patron: "bg-gradient-to-r from-[#00e054] to-[#40bcf4] text-[#0d1114] font-bold text-[10px] tracking-wider border-none shadow-sm",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        variantStyles[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge };
