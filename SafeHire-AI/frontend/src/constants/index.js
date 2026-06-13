export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1";

export const RISK_LEVELS = {
  LOW:      { label: "Low Risk",      color: "text-green-400",  bg: "bg-green-400/10",  border: "border-green-400/30"  },
  MEDIUM:   { label: "Medium Risk",   color: "text-amber-400",  bg: "bg-amber-400/10",  border: "border-amber-400/30"  },
  HIGH:     { label: "High Risk",     color: "text-orange-400", bg: "bg-orange-400/10", border: "border-orange-400/30" },
  CRITICAL: { label: "Critical Risk", color: "text-red-400",    bg: "bg-red-400/10",    border: "border-red-400/30"    },
};

export const PLATFORMS = [
  { value: "WHATSAPP",  label: "WhatsApp"  },
  { value: "TELEGRAM",  label: "Telegram"  },
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "LINKEDIN",  label: "LinkedIn"  },
  { value: "EMAIL",     label: "Email"     },
  { value: "OTHER",     label: "Other"     },
];

export const QUERY_KEYS = {
  ME:            ["auth", "me"],
  CONVERSATIONS: ["conversations"],
  CONVERSATION:  (id) => ["conversations", id],
  STATS:         ["stats"],
  THREATS:       ["threats"],
  REPORTS:       ["reports"],
};