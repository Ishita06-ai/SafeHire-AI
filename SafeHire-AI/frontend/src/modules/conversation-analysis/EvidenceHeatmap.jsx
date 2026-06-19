/**
 * modules/conversation-analysis/EvidenceHeatmap.jsx
 * Scam Evidence Heatmap — unifies legitimacySignals + indicators into one
 * scannable red/yellow/green checklist instead of a bare score.
 */

import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";

/* ─── Design tokens (matches AnalysisResult) ───────────────────────────── */
const NEON = "#A3FF12";
const NEON_LINE = "rgba(163,255,18,0.12)";
const NEON_LINE_HOVER = "rgba(163,255,18,0.35)";
const SURFACE = "rgba(15,15,15,0.95)";
const TEXT = "#FFFFFF";
const TEXT_DIM = "#9E9E9E";
const DIVIDER = "rgba(255,255,255,0.06)";
const RED = "#FF5C5C";
const YELLOW = "#FFD24A";

/* High-confidence indicators read as Red Flags, lower-confidence as Caution */
const HIGH_CONFIDENCE_THRESHOLD = 0.65;

/* Short, evidence-style phrasing for each indicator type */
const EVIDENCE_LABELS = {
  PAYMENT_REQUEST: "Payment / Registration Fee Requested",
  URGENCY_PRESSURE: "Urgent Action Pressure",
  PERSONAL_DATA_REQUEST: "Sensitive Personal Data Requested",
  IMPERSONATION: "Possible Recruiter or Company Impersonation",
  SUSPICIOUS_LINK: "Suspicious or Unverified Link",
  GROOMING_BEHAVIOR: "Grooming / Trust-Building Behavior",
  GRAMMAR_ANOMALY: "Unprofessional Grammar",
  UNREALISTIC_OFFER: "Unrealistic Salary or Offer",
  CONFIDENTIALITY_DEMAND: "Asked to Keep Offer Secret",
  FAKE_CREDENTIAL: "Unverifiable or Fake Credential",
};

function EvidenceRow({ color, label, sublabel, badge, index, isLast }) {
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
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: 999,
          background: color,
          boxShadow: `0 0 10px ${color}`,
          marginTop: 5,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14.5,
            fontWeight: 600,
            color: TEXT,
            letterSpacing: "-0.01em",
            lineHeight: 1.4,
          }}
        >
          {label}
        </div>
        {sublabel && (
          <div style={{ fontSize: 12.5, color: TEXT_DIM, marginTop: 3, lineHeight: 1.6 }}>
            {sublabel}
          </div>
        )}
      </div>
      <span
        style={{
          flexShrink: 0,
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          padding: "4px 10px",
          borderRadius: 999,
          color,
          background: `${color}1A`,
          border: `1px solid ${color}40`,
          whiteSpace: "nowrap",
        }}
      >
        {badge}
      </span>
    </motion.div>
  );
}

export function EvidenceHeatmap({ indicators = [], legitimacySignals = [] }) {
  const greenRows = legitimacySignals.map((signal) => ({
    color: NEON,
    label: signal,
    badge: "Verified",
  }));

  const flagRows = indicators.map((indicator) => {
    const isHighConfidence = indicator.confidence >= HIGH_CONFIDENCE_THRESHOLD;
    return {
      color: isHighConfidence ? RED : YELLOW,
      label: EVIDENCE_LABELS[indicator.type] || indicator.type,
      sublabel: indicator.explanation,
      badge: isHighConfidence ? "Red Flag" : "Caution",
      confidence: indicator.confidence,
    };
  });

  const yellowRows = flagRows.filter((row) => row.badge === "Caution");
  const redRows = flagRows
    .filter((row) => row.badge === "Red Flag")
    .sort((a, b) => b.confidence - a.confidence);

  const rows = [...greenRows, ...yellowRows, ...redRows];

  if (rows.length === 0) return null;

  return (
    <div
      style={{
        background: SURFACE,
        border: `1px solid ${NEON_LINE}`,
        borderRadius: 24,
        backdropFilter: "blur(20px)",
        boxShadow: "0 8px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.03)",
        padding: 28,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 32,
          right: 32,
          height: 1,
          background: `linear-gradient(90deg, transparent, ${NEON_LINE_HOVER}, transparent)`,
        }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 6,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(163,255,18,0.10)",
              border: `1px solid ${NEON_LINE}`,
              flexShrink: 0,
            }}
          >
            <ShieldCheck size={14} color={NEON} />
          </div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: TEXT_DIM,
            }}
          >
            Evidence Analysis
          </div>
        </div>

        <div style={{ display: "flex", gap: 16, fontSize: 12, fontWeight: 600 }}>
          {greenRows.length > 0 && (
            <span style={{ color: NEON }}>{greenRows.length} Verified</span>
          )}
          {yellowRows.length > 0 && (
            <span style={{ color: YELLOW }}>{yellowRows.length} Caution</span>
          )}
          {redRows.length > 0 && (
            <span style={{ color: RED }}>
              {redRows.length} Red Flag{redRows.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      <div style={{ marginTop: 8 }}>
        {rows.map((row, i) => (
          <EvidenceRow key={i} {...row} index={i} isLast={i === rows.length - 1} />
        ))}
      </div>
    </div>
  );
}