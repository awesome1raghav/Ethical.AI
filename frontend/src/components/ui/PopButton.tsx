import React from "react";
import { cn } from "@/lib/utils";

export interface PopButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

/**
 * Primary action. Solid brand pill with a layered "pop" depth that compresses
 * on press.
 *
 * Colours come from the brand/ink tokens: black-on-cream in light mode and
 * white-on-black in dark mode, with the depth stack drawn in low-alpha ink.
 */
export function PopButton({ className, children = "Learn More", ...props }: PopButtonProps) {
  return (
    <button
      className={cn(
        "group relative inline-flex items-center justify-center font-semibold uppercase tracking-wide",
        "bg-brand text-brand-ink border border-brand",
        "px-8 py-5 rounded-xl",
        "transition-all duration-150 ease-[cubic-bezier(0,0,0.58,1)]",
        "shadow-[0_6px_0_-1px_hsl(var(--ink)/0.25),0_10px_18px_-6px_hsl(var(--ink)/0.35)]",
        "hover:translate-y-[3px] hover:shadow-[0_3px_0_-1px_hsl(var(--ink)/0.25),0_6px_12px_-6px_hsl(var(--ink)/0.3)]",
        "active:translate-y-[6px] active:shadow-[0_0_0_0_hsl(var(--ink)/0.2)]",
        "disabled:translate-y-0 disabled:shadow-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export default PopButton;
