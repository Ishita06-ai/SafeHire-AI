/**
 * components/ui/Button.jsx — Reusable button component
 *
 * WHY BUILD THIS:
 * Instead of repeating Tailwind classes on every button,
 * one component handles all variants, sizes, loading states.
 * Change button style once → updates everywhere.
 */

import { cn } from "../../utils/cn";

const variants = {
  primary:   "bg-[#a3e635] hover:bg-[#bef264] text-black shadow-lg shadow-[#a3e635]/20 font-semibold",
  secondary: "bg-[#141425] hover:bg-[#1c1c30] text-[#f0f0f0] border border-[rgba(163,230,53,0.18)]",
  danger:    "bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-500/30",
  ghost:     "hover:bg-[#141425] text-gray-400 hover:text-[#a3e635]",
};

const sizes = {
  sm:  "px-3 py-1.5 text-sm rounded-lg",
  md:  "px-4 py-2 text-sm rounded-lg",
  lg:  "px-6 py-3 text-base rounded-xl",
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  isLoading = false,
  disabled = false,
  className,
  ...props
}) {
  return (
    <button
      disabled={disabled || isLoading}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium",
        "transition-all duration-200 focus:outline-none focus:ring-2",
        "focus:ring-[#a3e635]/40 disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {isLoading && (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </button>
  );
}