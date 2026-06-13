import { cn } from "../../utils/cn";

const RISK_CONFIG = {
  LOW:      { label: "Low Risk",      color: "text-[#a3e635]",  bg: "bg-[#a3e635]/10",  border: "border-[#a3e635]/30"  },
  MEDIUM:   { label: "Medium Risk",   color: "text-amber-400",  bg: "bg-amber-400/10",  border: "border-amber-400/30"  },
  HIGH:     { label: "High Risk",     color: "text-orange-400", bg: "bg-orange-400/10", border: "border-orange-400/30" },
  CRITICAL: { label: "Critical Risk", color: "text-red-400",    bg: "bg-red-400/10",    border: "border-red-400/30"    },
};

const sizes = {
  sm: "text-xs px-2 py-0.5",
  md: "text-sm px-3 py-1",
  lg: "text-base px-4 py-1.5",
};

export function RiskBadge({ level, score, size = "md" }) {
  if (!level) return null;
  const config = RISK_CONFIG[level];
  if (!config) return null;

  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 font-semibold rounded-full border",
      config.color, config.bg, config.border,
      sizes[size]
    )}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {config.label}
      {score !== undefined && (
        <span className="opacity-70 font-normal">({score})</span>
      )}
    </span>
  );
}