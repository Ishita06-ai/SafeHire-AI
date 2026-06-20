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
  Users,
  ThumbsUp,
  ThumbsDown,
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
    score > 85 ? NEON : score > 70 ? "#FFD24A" : score > 50 ? "#FF9F45" : score > 30 ? "#FF7A45" : RED;
  const glow =
    score > 85
      ? NEON_SOFT
      : score > 70
      ? "rgba(255,210,74,0.35)"
      : score > 50
      ? "rgba(255,159,69,0.35)"
      : score > 30
      ? "rgba(255,122,69,0.35)"
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
  if (score <= 30) return "High Risk";
  if (score <= 50) return "Suspicious";
  if (score <= 70) return "Needs Verification";
  if (score <= 85) return "Likely Legitimate";
  return "Strong Evidence";
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

  const { extracted = {}, checks = [], aiAssessment = {}, communityReputation } = data;

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
                <div style={{ marginTop: 10, display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: TEXT_DIM }}>
                    {data.trustScore ?? 0}/100
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: TEXT }}>
                    {data.classification?.label || trustLabel(data.trustScore ?? 0)}
                  </span>
                  {data.recommendation?.confidence && (
                    <span style={{ fontSize: 12, color: TEXT_DIM }}>
                      · Confidence: {data.recommendation.confidence}
                    </span>
                  )}
                </div>
                {data.recommendation?.reason && (
                  <p style={{ marginTop: 8, fontSize: 13.5, color: TEXT_DIM, lineHeight: 1.7, maxWidth: 480 }}>
                    {data.recommendation.reason}
                  </p>
                )}

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

          {/* ── Recommendation ───────────────────────────────────────── */}
          {data.recommendation && (
            <section style={{ marginBottom: 32 }}>
              <SectionLabel icon={ShieldCheck} label="Recommendation" />
              <div style={{ ...panel, padding: 24 }}>
                {data.recommendation.positives?.length > 0 && (
                  <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
                    {data.recommendation.positives.map((item, i) => (
                      <li key={`pos-${i}`} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <span style={{ color: NEON, fontSize: 14, lineHeight: 1.6, flexShrink: 0 }}>✓</span>
                        <span style={{ fontSize: 13.5, lineHeight: 1.7, color: TEXT_BODY }}>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {data.recommendation.concerns?.length > 0 && (
                  <ul
                    style={{
                      listStyle: "none",
                      margin: 0,
                      padding: 0,
                      marginTop: data.recommendation.positives?.length ? 14 : 0,
                      display: "grid",
                      gap: 10,
                    }}
                  >
                    {data.recommendation.concerns.map((item, i) => (
                      <li key={`con-${i}`} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <span style={{ color: "#FFB23F", fontSize: 14, lineHeight: 1.6, flexShrink: 0 }}>⚠</span>
                        <span style={{ fontSize: 13.5, lineHeight: 1.7, color: TEXT_BODY }}>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {data.recommendation.riskLevel && (
                  <div
                    style={{
                      marginTop: 20,
                      paddingTop: 16,
                      borderTop: `1px solid ${DIVIDER}`,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span style={{ fontSize: 12.5, color: TEXT_DIM, fontWeight: 600 }}>Risk Level:</span>
                    <span style={{ fontSize: 13.5, color: TEXT, fontWeight: 700 }}>
                      {data.recommendation.riskLevel}
                    </span>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ── Community Reputation ─────────────────────────────────── */}
          {communityReputation && communityReputation.discussionsFound > 0 && (
            <section style={{ marginBottom: 32 }}>
              <SectionLabel icon={Users} label="Community Reputation" />
              <div style={{ ...panel, padding: 24 }}>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 10px",
                    borderRadius: 999,
                    background: "rgba(201,166,255,0.12)",
                    border: "1px solid rgba(201,166,255,0.3)",
                    color: "#C9A6FF",
                    fontSize: 10.5,
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    marginBottom: 16,
                  }}
                >
                  🤖 AI Summary of Public Discussions
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                    gap: 16,
                    marginBottom: 18,
                  }}
                >
                  <p style={{ fontSize: 14, lineHeight: 1.7, color: TEXT_BODY, margin: 0, flex: 1, minWidth: 220 }}>
                    {communityReputation.summary}
                  </p>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: TEXT_DIM,
                      }}
                    >
                      Found {communityReputation.discussionsFound} discussions
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 24, marginBottom: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <ThumbsUp size={14} color={NEON} />
                    <span style={{ fontSize: 13, color: TEXT_BODY }}>
                      {communityReputation.positiveMentions} positive
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <ThumbsDown size={14} color={RED} />
                    <span style={{ fontSize: 13, color: TEXT_BODY }}>
                      {communityReputation.negativeMentions} negative
                    </span>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                  {communityReputation.commonPositives?.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: NEON, marginBottom: 10 }}>
                        Common Positives
                      </div>
                      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
                        {communityReputation.commonPositives.map((item, i) => (
                          <li key={i} style={{ fontSize: 13, lineHeight: 1.6, color: TEXT_BODY }}>
                            ✓ {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {communityReputation.commonNegatives?.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#FF9F45", marginBottom: 10 }}>
                        Common Concerns
                      </div>
                      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
                        {communityReputation.commonNegatives.map((item, i) => (
                          <li key={i} style={{ fontSize: 13, lineHeight: 1.6, color: TEXT_BODY }}>
                            ⚠ {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {communityReputation.scamSpecificFlags?.length > 0 && (
                  <div style={{ marginTop: 20, paddingTop: 20, borderTop: `1px solid ${DIVIDER}` }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: RED, marginBottom: 10 }}>
                      Scam-Pattern Reports
                    </div>
                    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
                      {communityReputation.scamSpecificFlags.map((flag, i) => (
                        <li key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                          <AlertTriangle size={14} color={RED} style={{ marginTop: 2, flexShrink: 0 }} />
                          <span style={{ fontSize: 13, lineHeight: 1.6, color: TEXT_BODY }}>{flag}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div style={{ marginTop: 20, fontSize: 11, color: TEXT_DIM, fontStyle: "italic" }}>
                  Generated from public discussions and reviews. May not represent all employee
                  experiences. A supporting signal only — official verification checks above carry
                  more weight in the Trust Score.
                </div>
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