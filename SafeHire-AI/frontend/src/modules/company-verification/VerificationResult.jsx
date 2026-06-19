/**
 * modules/company-verification/VerificationResult.jsx
 * Trust score report for a single Company Verification run.
 */

import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  Sparkles,
  Building2,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import { AppLayout } from "../../components/layouts/AppLayout";
import { CardSkeleton } from "../../components/ui/Skeleton";
import { VerificationChecklist } from "./VerificationChecklist";
import { verificationApi } from "../../services/api/verification.api";
import { QUERY_KEYS } from "../../constants";

/* ─── Design tokens (matches AnalysisResult) ───────────────────────────── */
const NEON = "#A3FF12";
const NEON_SOFT = "rgba(163,255,18,0.25)";
const NEON_LINE = "rgba(163,255,18,0.12)";
const NEON_LINE_HOVER = "rgba(163,255,18,0.35)";
const SURFACE = "rgba(15,15,15,0.95)";
const BG = "#050505";
const TEXT = "#FFFFFF";
const TEXT_BODY = "#D8D8D8";
const TEXT_DIM = "#9E9E9E";
const BORDER_SOFT = "rgba(255,255,255,0.08)";
const DIVIDER = "rgba(255,255,255,0.06)";
const RED = "#FF5C5C";

const FONT_STACK =
  '"Inter","SF Pro Display","General Sans","Satoshi",ui-sans-serif,system-ui,-apple-system,sans-serif';

const pageBg = {
  minHeight: "100%",
  background: `radial-gradient(1200px 600px at 80% -10%, rgba(163,255,18,0.08), transparent 60%),
               radial-gradient(900px 500px at -10% 20%, rgba(163,255,18,0.05), transparent 55%),
               ${BG}`,
  color: TEXT,
  fontFamily: FONT_STACK,
  padding: "40px 24px 96px",
};

const panel = {
  background: SURFACE,
  border: `1px solid ${NEON_LINE}`,
  borderRadius: 24,
  backdropFilter: "blur(20px)",
  boxShadow: "0 8px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.03)",
  position: "relative",
  overflow: "hidden",
};

/* ─── Trust gauge — inverse of the Risk gauge: high score = good ────────── */
function TrustGauge({ score }) {
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color =
    score >= 80 ? NEON : score >= 60 ? "#FFD24A" : score >= 40 ? "#FF9F45" : RED;
  const glow =
    score >= 80
      ? NEON_SOFT
      : score >= 60
      ? "rgba(255,210,74,0.35)"
      : score >= 40
      ? "rgba(255,159,69,0.35)"
      : "rgba(255,92,92,0.35)";

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
        <circle cx="80" cy="80" r={radius} stroke="rgba(255,255,255,0.06)" strokeWidth="10" fill="none" />
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
        }}
      >
        <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, color }}>
          {score}
        </div>
        <div style={{ fontSize: 11, color: TEXT_DIM, marginTop: 4, letterSpacing: "0.08em" }}>
          TRUST SCORE
        </div>
      </div>
    </div>
  );
}

function trustLabel(score) {
  if (score >= 80) return "Looks Legitimate";
  if (score >= 60) return "Mostly Consistent";
  if (score >= 40) return "Proceed With Caution";
  return "High Risk — Many Checks Failed";
}

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

/* Row inside "Extracted Details" — shows what Gemini found, or "Not found" */
function DetailRow({ label, value, isLast, source }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 16,
        padding: "12px 0",
        borderBottom: isLast ? "none" : `1px solid ${DIVIDER}`,
      }}
    >
      <span style={{ fontSize: 13, color: TEXT_DIM, flexShrink: 0 }}>{label}</span>
      <span style={{ textAlign: "right" }}>
        <span
          style={{
            fontSize: 13.5,
            fontWeight: 600,
            color: value ? TEXT : TEXT_DIM,
            fontStyle: value ? "normal" : "italic",
            wordBreak: "break-word",
          }}
        >
          {value || "Not found in provided text"}
        </span>
        {value && source === "WEB_SEARCH" && (
          <span
            style={{
              display: "block",
              fontSize: 10.5,
              fontWeight: 600,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: "#C9A6FF",
              marginTop: 3,
            }}
          >
            Found via web search
          </span>
        )}
      </span>
    </div>
  );
}

export default function VerificationResult() {
  const { id } = useParams();

  const { data, isLoading, isError } = useQuery({
    queryKey: QUERY_KEYS.VERIFICATION(id),
    queryFn: () => verificationApi.getVerification(id).then((r) => r.data.data),
    refetchInterval: (data) =>
      data?.status === "PROCESSING" || data?.status === "PENDING" ? 3000 : false,
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div style={pageBg}>
          <div style={{ maxWidth: 960, margin: "0 auto", display: "grid", gap: 24 }}>
            {[...Array(3)].map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  if (isError || !data) {
    return (
      <AppLayout>
        <div style={pageBg}>
          <div style={{ maxWidth: 520, margin: "80px auto 0", ...panel, padding: 40, textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", color: TEXT, marginBottom: 8 }}>
              Verification not found
            </div>
            <div style={{ color: TEXT_DIM, fontSize: 14, marginBottom: 24, lineHeight: 1.7 }}>
              We couldn't locate this report. It may have been removed or the link is invalid.
            </div>
            <Link
              to="/verify-company"
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

  if (data.status === "PENDING" || data.status === "PROCESSING") {
    return (
      <AppLayout>
        <div style={pageBg}>
          <div style={{ maxWidth: 520, margin: "80px auto 0", ...panel, padding: 48, textAlign: "center" }}>
            <div
              style={{
                width: 56,
                height: 56,
                margin: "0 auto 20px",
                borderRadius: "50%",
                border: "3px solid rgba(163,255,18,0.15)",
                borderTopColor: NEON,
                animation: "spin 0.9s linear infinite",
                boxShadow: `0 0 30px ${NEON_SOFT}`,
              }}
            />
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", color: TEXT, marginBottom: 8 }}>
              Verifying company details
            </div>
            <div style={{ color: TEXT_DIM, fontSize: 14, lineHeight: 1.7 }}>
              Extracting details and running domain/email checks…
            </div>
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </AppLayout>
    );
  }

  const { extracted = {}, checks = [], aiAssessment = {} } = data;

  return (
    <AppLayout>
      <div style={pageBg}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <Link
            to="/verify-company"
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
            <ChevronLeft size={14} /> Back to Verify
          </Link>

          {/* ── Trust Score Hero ─────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
            style={{ ...panel, padding: 40, marginBottom: 32 }}
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
              Company Verification
            </div>

            <div style={{ display: "flex", gap: 40, alignItems: "center", flexWrap: "wrap" }}>
              <TrustGauge score={data.trustScore ?? 0} />

              <div style={{ flex: 1, minWidth: 260 }}>
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
                  {extracted.companyName || "Unknown Company"}
                </p>
                <p style={{ marginTop: 8, fontSize: 14, color: TEXT_DIM, lineHeight: 1.6 }}>
                  {trustLabel(data.trustScore ?? 0)}
                </p>

                <div style={{ marginTop: 22, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                  {extracted.roleTitle && (
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
                      {extracted.roleTitle}
                    </span>
                  )}
                  <span style={{ fontSize: 12, color: TEXT_DIM }}>
                    {new Date(data.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* ── Verification Checklist ───────────────────────────────── */}
          {checks.length > 0 && (
            <section style={{ marginBottom: 32 }}>
              <SectionLabel icon={ShieldCheck} label="Verification Checklist" count={checks.length} />
              <div style={{ ...panel, padding: 24 }}>
                <VerificationChecklist checks={checks} />
              </div>
            </section>
          )}

          {/* ── Extracted Details ────────────────────────────────────── */}
          <section style={{ marginBottom: 32 }}>
            <SectionLabel icon={Building2} label="Extracted Details" />
            <div style={{ ...panel, padding: 24 }}>
              <DetailRow label="Company Name" value={extracted.companyName} />
              <DetailRow label="Website" value={extracted.website} source={extracted.websiteSource} />
              <DetailRow label="Email" value={extracted.email} />
              <DetailRow label="Phone" value={extracted.phone} />
              <DetailRow label="Recruiter" value={extracted.recruiterName} />
              <DetailRow label="LinkedIn" value={extracted.linkedinUrl} source={extracted.linkedinSource} isLast />
            </div>
          </section>

          {/* ── AI Assessment ────────────────────────────────────────── */}
          {(aiAssessment.summary || aiAssessment.redFlags?.length > 0) && (
            <section style={{ marginBottom: 32 }}>
              <SectionLabel icon={Sparkles} label="AI Assessment" />
              <div style={{ ...panel, padding: 24 }}>
                {aiAssessment.summary && (
                  <p style={{ fontSize: 14, lineHeight: 1.7, color: TEXT_BODY, margin: 0 }}>
                    {aiAssessment.summary}
                  </p>
                )}
                {aiAssessment.redFlags?.length > 0 && (
                  <ul
                    style={{
                      listStyle: "none",
                      margin: 0,
                      padding: 0,
                      marginTop: aiAssessment.summary ? 18 : 0,
                      display: "grid",
                      gap: 12,
                    }}
                  >
                    {aiAssessment.redFlags.map((flag, i) => (
                      <li key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <AlertTriangle size={14} color={RED} style={{ marginTop: 2, flexShrink: 0 }} />
                        <span style={{ fontSize: 13.5, lineHeight: 1.7, color: TEXT_BODY }}>{flag}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          )}

          <div style={{ height: 24 }} />
        </div>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </AppLayout>
  );
}