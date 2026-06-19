/**
 * modules/company-verification/VerificationChecklist.jsx
 * Renders the Trust Score checklist — each row tagged "Verified" (a real
 * DNS/HTTP/MX check) or "AI Assessed" (Gemini's qualitative judgment) so
 * the UI never overstates what was actually confirmed.
 */

import { motion } from "framer-motion";
import { Check, X, Minus } from "lucide-react";

const NEON = "#A3FF12";
const TEXT = "#FFFFFF";
const TEXT_DIM = "#9E9E9E";
const DIVIDER = "rgba(255,255,255,0.06)";
const RED = "#FF5C5C";
const GRAY = "#6A6A6A";

const STATUS_CONFIG = {
  PASS: { color: NEON, Icon: Check },
  FAIL: { color: RED, Icon: X },
  UNKNOWN: { color: GRAY, Icon: Minus },
};

function ChecklistRow({ check, index, isLast }) {
  const { color, Icon } = STATUS_CONFIG[check.status] || STATUS_CONFIG.UNKNOWN;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04, ease: [0.4, 0, 0.2, 1] }}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 14,
        padding: "14px 4px",
        borderBottom: isLast ? "none" : `1px solid ${DIVIDER}`,
      }}
    >
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: 999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: `${color}1A`,
          border: `1px solid ${color}40`,
          flexShrink: 0,
          marginTop: 2,
        }}
      >
        <Icon size={14} color={color} strokeWidth={2.5} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 14.5, fontWeight: 600, color: TEXT, letterSpacing: "-0.01em" }}>
            {check.label}
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              padding: "2px 8px",
              borderRadius: 999,
              color: check.category === "AI_ASSESSED" ? "#C9A6FF" : TEXT_DIM,
              background: check.category === "AI_ASSESSED" ? "rgba(201,166,255,0.12)" : "rgba(255,255,255,0.05)",
              border: `1px solid ${check.category === "AI_ASSESSED" ? "rgba(201,166,255,0.3)" : "rgba(255,255,255,0.1)"}`,
            }}
          >
            {check.category === "AI_ASSESSED" ? "AI Assessed" : "Verified"}
          </span>
        </div>
        {check.detail && (
          <div style={{ fontSize: 12.5, color: TEXT_DIM, marginTop: 4, lineHeight: 1.6 }}>
            {check.detail}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function VerificationChecklist({ checks = [] }) {
  if (checks.length === 0) return null;

  return (
    <div>
      {checks.map((check, i) => (
        <ChecklistRow key={check.id} check={check} index={i} isLast={i === checks.length - 1} />
      ))}
    </div>
  );
}