import { forwardRef } from "react";
import { cn } from "../../utils/cn";

export const Input = forwardRef(({
  label,
  error,
  hint,
  leftIcon,
  className,
  ...props
}, ref) => {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-gray-300">
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          className={cn(
            "w-full bg-[#0f0f1a] border rounded-lg px-4 py-2.5 text-[#f0f0f0]",
            "placeholder:text-gray-600 text-sm transition-all duration-200",
            "focus:outline-none focus:ring-2 focus:ring-[#a3e635]/40 focus:border-[rgba(163,230,53,0.35)]",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            leftIcon && "pl-10",
            error
              ? "border-red-500/50 focus:ring-red-500/30"
              : "border-[rgba(163,230,53,0.12)] hover:border-[rgba(163,230,53,0.25)]",
            className
          )}
          {...props}
        />
      </div>
      {error && (
        <p className="text-xs text-red-400 flex items-center gap-1">
          <span>⚠</span> {error}
        </p>
      )}
      {hint && !error && (
        <p className="text-xs text-gray-500">{hint}</p>
      )}
    </div>
  );
});

Input.displayName = "Input";