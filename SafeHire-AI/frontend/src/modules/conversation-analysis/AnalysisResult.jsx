/**
 * modules/conversation-analysis/AnalysisResult.jsx
 * The explainable AI risk report — premium neon/black redesign
 * Functionality, data, hooks, routes and component hierarchy unchanged.
 */

import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle,
  ChevronLeft,
  Info,
  Lightbulb,
  FileText,
  Sparkles,
} from "lucide-react";
import { AppLayout } from "../../components/layouts/AppLayout";
import { RiskBadge } from "../../components/ui/RiskBadge";
import { CardSkeleton } from "../../components/ui/Skeleton";
import { Button } from "../../components/ui/Button";
import { analysisApi } from "../../services/api/analysis.api";
import { QUERY_KEYS } from "../../constants";
import { cn } from "../../utils/cn";

/* ─── Design tokens (matches Dashboard / Analyze redesign) ─────────────── */
const NEON = "#A3FF12";
const NEON_SOFT = "rgba(163,255,18,0.25)";
const NEON_LINE = "rgba(163,255,18,0.12)";
const NEON_LINE_HOVER = "rgba(163,255,18,0.35)";
const SURFACE = "rgba(15,15,15,0.95)";
const SURFACE_2 = "rgba(20,20,20,0.9)";
const BG = "#050505";
const TEXT = "#FFFFFF";
const TEXT_BODY = "#D8D8D8";
const TEXT_DIM = "#9E9E9E";
const BORDER_SOFT = "rgba(255,255,255,0.08)";
const DIVIDER = "rgba(255,255,255,0.06)";

const FONT_STACK =
  '"Inter","SF Pro Display","General Sans","Satoshi",ui-sans-serif,system-ui,-apple-system,sans-serif';

/* Page-level background */
const pageBg = {
  minHeight: "100%",
  background: `radial-gradient(1200px 600px at 80% -10%, rgba(163,255,18,0.08), transparent 60%),
               radial-gradient(900px 500px at -10% 20%, rgba(163,255,18,0.05), transparent 55%),
               ${BG}`,
  color: TEXT,
  fontFamily: FONT_STACK,
  padding: "40px 24px 96px",
};

/* Glass panel */
const panel = {
  background: SURFACE,
  border: `1px solid ${NEON_LINE}`,
  borderRadius: 24,
  backdropFilter: "blur(20px)",
  boxShadow:
    "0 8px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.03)",
  position: "relative",
  overflow: "hidden",
};

/* ─── Indicator labels ─────────────────────────────────────────────────── */
const INDICATOR_LABELS = {
  PAYMENT_REQUEST: "Payment Request",
  URGENCY_PRESSURE: "Urgency Pressure",
  PERSONAL_DATA_REQUEST: "Personal Data Request",
  IMPERSONATION: "Impersonation",
  SUSPICIOUS_LINK: "Suspicious Link",
  GROOMING_BEHAVIOR: "Grooming Behavior",
  GRAMMAR_ANOMALY: "Grammar Anomaly",
  UNREALISTIC_OFFER: "Unrealistic Offer",
  CONFIDENTIALITY_DEMAND: "Confidentiality Demand",
  FAKE_CREDENTIAL: "Fake Credential",
};

/* ─── Indicator card ───────────────────────────────────────────────────── */
function IndicatorCard({ indicator, index }) {
  const pct = Math.round(indicator.confidence * 100);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05, ease: [0.4, 0, 0.2, 1] }}
      style={{
        ...panel,
        padding: 24,
        borderRadius: 20,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(163,255,18,0.10)",
              border: `1px solid ${NEON_LINE}`,
              flexShrink: 0,
            }}
          >
            <AlertTriangle size={16} color={NEON} />
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: TEXT,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {INDICATOR_LABELS[indicator.type] || indicator.type}
          </div>
        </div>

        {/* Confidence pill */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 600, color: TEXT_DIM, letterSpacing: "-0.01em" }}>
            {pct}%
          </span>
          <div
            style={{
              width: 72,
              height: 6,
              borderRadius: 999,
              background: "rgba(255,255,255,0.06)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${pct}%`,
                height: "100%",
                background: NEON,
                boxShadow: `0 0 10px ${NEON_SOFT}`,
                transition: "width 0.6s cubic-bezier(.4,0,.2,1)",
              }}
            />
          </div>
        </div>
      </div>

      {/* Phrase */}
      <div
        style={{
          background: "rgba(255,255,255,0.02)",
          border: `1px solid ${BORDER_SOFT}`,
          borderLeft: `2px solid ${NEON}`,
          borderRadius: 12,
          padding: "14px 16px",
          fontSize: 13.5,
          fontStyle: "italic",
          color: TEXT_BODY,
          lineHeight: 1.6,
          marginBottom: 14,
        }}
      >
        “{indicator.phrase}”
      </div>

      {/* Explanation */}
      <div style={{ fontSize: 13.5, lineHeight: 1.7, color: TEXT_DIM }}>
        {indicator.explanation}
      </div>
    </motion.div>
  );
}

/* ─── Risk score circular gauge ────────────────────────────────────────── */
function RiskGauge({ score }) {
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  // Keep neon green for safe, escalate to warm/red for danger (semantic clarity)
  const color =
    score >= 85 ? "#FF5C5C" : score >= 60 ? "#FF9F45" : score >= 30 ? "#FFD24A" : NEON;
  const glow =
    score >= 85
      ? "rgba(255,92,92,0.35)"
      : score >= 60
      ? "rgba(255,159,69,0.35)"
      : score >= 30
      ? "rgba(255,210,74,0.35)"
      : NEON_SOFT;

  return (
    <div style={{ position: "relative", width: 160, height: 160 }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${glow}, transparent 70%)`,
          filter: "blur(8px)",
        }}
      />
      <svg width="160" height="160" style={{ position: "relative", transform: "rotate(-90deg)" }}>
        <circle
          cx="80"
          cy="80"
          r={radius}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="10"
          fill="none"
        />
        <circle
          cx="80"
          cy="80"
          r={radius}
          stroke={color}
          strokeWidth="10"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: "stroke-dashoffset 0.9s cubic-bezier(.4,0,.2,1)",
            filter: `drop-shadow(0 0 8px ${glow})`,
          }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: FONT_STACK,
        }}
      >
        <div
          style={{
            fontSize: 44,
            fontWeight: 800,
            letterSpacing: "-0.04em",
            lineHeight: 1,
            color,
          }}
        >
          {score}
        </div>
        <div style={{ fontSize: 11, color: TEXT_DIM, marginTop: 4, letterSpacing: "0.08em" }}>
          / 100
        </div>
      </div>
    </div>
  );
}

/* ─── Section header ───────────────────────────────────────────────────── */
function SectionLabel({ icon: Icon, label, count }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
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
        }}
      >
        <Icon size={14} color={NEON} />
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
        {label}
        {count !== undefined ? ` · ${count}` : ""}
      </div>
      <div style={{ flex: 1, height: 1, background: DIVIDER }} />
    </div>
  );
}

/* ─── Main page ────────────────────────────────────────────────────────── */
export default function AnalysisResult() {
  const { id } = useParams();

  const { data, isLoading, isError } = useQuery({
    queryKey: QUERY_KEYS.CONVERSATION(id),
    queryFn: () => analysisApi.getConversation(id).then((r) => r.data.data),
    refetchInterval: (data) =>
      data?.status === "PROCESSING" || data?.status === "PENDING" ? 3000 : false,
  });

  /* ── Loading ── */
  if (isLoading) {
    return (
      <AppLayout>
        <div style={pageBg}>
          <div style={{ maxWidth: 960, margin: "0 auto", display: "grid", gap: 24 }}>
            {[...Array(4)].map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  /* ── Error ── */
  if (isError || !data) {
    return (
      <AppLayout>
        <div style={pageBg}>
          <div
            style={{
              maxWidth: 520,
              margin: "80px auto 0",
              ...panel,
              padding: 40,
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: TEXT,
                marginBottom: 8,
              }}
            >
              Analysis not found
            </div>
            <div style={{ color: TEXT_DIM, fontSize: 14, marginBottom: 24, lineHeight: 1.7 }}>
              We couldn’t locate this report. It may have been removed or the link is invalid.
            </div>
            <Link
              to="/analyze"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 22px",
                borderRadius: 999,
                background: NEON,
                color: "#050505",
                fontWeight: 700,
                fontSize: 14,
                textDecoration: "none",
                boxShadow: `0 10px 30px ${NEON_SOFT}`,
              }}
            >
              Go back
            </Link>
          </div>
        </div>
      </AppLayout>
    );
  }

  /* ── Processing ── */
  if (data.status === "PENDING" || data.status === "PROCESSING") {
    return (
      <AppLayout>
        <div style={pageBg}>
          <div
            style={{
              maxWidth: 520,
              margin: "80px auto 0",
              ...panel,
              padding: 48,
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                margin: "0 auto 20px",
                borderRadius: "50%",
                border: `3px solid rgba(163,255,18,0.15)`,
                borderTopColor: NEON,
                animation: "spin 0.9s linear infinite",
                boxShadow: `0 0 30px ${NEON_SOFT}`,
              }}
            />
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: TEXT,
                marginBottom: 8,
              }}
            >
              AI Analysis in progress
            </div>
            <div style={{ color: TEXT_DIM, fontSize: 14, lineHeight: 1.7 }}>
              Running OCR and scanning for scam patterns…
            </div>
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </AppLayout>
    );
  }

  /* ── Result ── */
  return (
    <AppLayout>
      <div style={pageBg}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          {/* Back link */}
          <Link
            to="/analyze"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              color: TEXT_DIM,
              textDecoration: "none",
              marginBottom: 24,
              transition: "color 0.3s cubic-bezier(.4,0,.2,1)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = NEON)}
            onMouseLeave={(e) => (e.currentTarget.style.color = TEXT_DIM)}
          >
            <ChevronLeft size={14} /> Back to Analyze
          </Link>

          {/* ── Risk Score Hero ──────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
            style={{ ...panel, padding: 40, marginBottom: 32 }}
          >
            {/* neon top edge */}
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
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 12px",
                borderRadius: 999,
                border: `1px solid ${NEON_LINE}`,
                background: "rgba(163,255,18,0.06)",
                color: NEON,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: 24,
              }}
            >
              <Sparkles size={11} />
              Risk Report
            </div>

            <div
              style={{
                display: "flex",
                gap: 40,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <RiskGauge score={data.riskScore ?? 0} />

              <div style={{ flex: 1, minWidth: 260 }}>
                <div style={{ marginBottom: 14 }}>
                  <RiskBadge level={data.riskLevel} />
                </div>
                <p
                  style={{
                    fontSize: "clamp(1.25rem, 2.2vw, 1.6rem)",
                    fontWeight: 700,
                    letterSpacing: "-0.03em",
                    lineHeight: 1.25,
                    color: TEXT,
                    margin: 0,
                  }}
                >
                  {data.explanation}
                </p>

                {/* Meta row */}
                <div
                  style={{
                    marginTop: 22,
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  {data.platform && (
                    <span
                      style={{
                        padding: "5px 12px",
                        borderRadius: 999,
                        background: "rgba(255,255,255,0.04)",
                        border: `1px solid ${BORDER_SOFT}`,
                        fontSize: 12,
                        fontWeight: 500,
                        color: TEXT_BODY,
                      }}
                    >
                      {data.platform}
                    </span>
                  )}
                  <span style={{ fontSize: 12, color: TEXT_DIM }}>
                    {new Date(data.createdAt).toLocaleString()}
                  </span>
                  {data.processingTimeMs && (
                    <>
                      <span style={{ color: "rgba(255,255,255,0.15)" }}>·</span>
                      <span style={{ fontSize: 12, color: TEXT_DIM }}>
                        Analyzed in {(data.processingTimeMs / 1000).toFixed(1)}s
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          {/* ── Scam Indicators ──────────────────────────────────────── */}
          {data.indicators?.length > 0 && (
            <section style={{ marginBottom: 32 }}>
              <SectionLabel
                icon={AlertTriangle}
                label="Scam Indicators"
                count={data.indicators.length}
              />
              <div style={{ display: "grid", gap: 16 }}>
                {data.indicators.map((indicator, i) => (
                  <IndicatorCard key={i} indicator={indicator} index={i} />
                ))}
              </div>
            </section>
          )}

          {/* ── Recommendations ──────────────────────────────────────── */}
          {data.recommendations?.length > 0 && (
            <section style={{ marginBottom: 32 }}>
              <SectionLabel
                icon={Lightbulb}
                label="Recommendations"
                count={data.recommendations.length}
              />
              <div style={{ ...panel, padding: 24 }}>
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 14 }}>
                  {data.recommendations.map((rec, i) => (
                    <li
                      key={i}
                      style={{
                        display: "flex",
                        gap: 12,
                        alignItems: "flex-start",
                        paddingBottom: i < data.recommendations.length - 1 ? 14 : 0,
                        borderBottom:
                          i < data.recommendations.length - 1
                            ? `1px solid ${DIVIDER}`
                            : "none",
                      }}
                    >
                      <div
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 999,
                          background: "rgba(163,255,18,0.10)",
                          border: `1px solid ${NEON_LINE}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          marginTop: 2,
                        }}
                      >
                        <Lightbulb size={11} color={NEON} />
                      </div>
                      <span
                        style={{
                          fontSize: 14,
                          lineHeight: 1.7,
                          color: TEXT_BODY,
                        }}
                      >
                        {rec}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {/* ── Legitimacy Signals ───────────────────────────────────── */}
          {data.legitimacySignals?.length > 0 && (
            <section style={{ marginBottom: 32 }}>
              <SectionLabel
                icon={CheckCircle}
                label="Legitimacy Signals"
                count={data.legitimacySignals.length}
              />
              <div style={{ ...panel, padding: 24, position: "relative" }}>
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
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }}>
                  {data.legitimacySignals.map((signal, i) => (
                    <li
                      key={i}
                      style={{
                        display: "flex",
                        gap: 12,
                        alignItems: "flex-start",
                      }}
                    >
                      <span
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 999,
                          background: "rgba(163,255,18,0.12)",
                          color: NEON,
                          fontSize: 12,
                          fontWeight: 800,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          marginTop: 2,
                        }}
                      >
                        ✓
                      </span>
                      <span style={{ fontSize: 14, lineHeight: 1.7, color: TEXT_BODY }}>
                        {signal}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {/* ── Extracted Text ───────────────────────────────────────── */}
          {data.extractedText && (
            <section style={{ marginBottom: 32 }}>
              <details style={{ ...panel, padding: 0, overflow: "hidden" }}>
                <summary
                  style={{
                    cursor: "pointer",
                    listStyle: "none",
                    padding: "20px 24px",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    fontSize: 13,
                    fontWeight: 600,
                    letterSpacing: "-0.01em",
                    color: TEXT_BODY,
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 999,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "rgba(163,255,18,0.10)",
                      border: `1px solid ${NEON_LINE}`,
                    }}
                  >
                    <FileText size={12} color={NEON} />
                  </div>
                  View Extracted Text (OCR output)
                </summary>
                <pre
                  style={{
                    margin: 0,
                    padding: "20px 24px",
                    borderTop: `1px solid ${DIVIDER}`,
                    background: SURFACE_2,
                    color: TEXT_BODY,
                    fontSize: 12.5,
                    lineHeight: 1.7,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    fontFamily:
                      'ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace',
                  }}
                >
                  {data.extractedText}
                </pre>
              </details>
            </section>
          )}

          <div style={{ height: 24 }} />
        </div>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </AppLayout>
  );
}
