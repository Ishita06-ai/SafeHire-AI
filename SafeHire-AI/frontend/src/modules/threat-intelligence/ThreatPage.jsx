/**
 * modules/threat-intelligence/ThreatPage.jsx
 * Search and browse the community threat database
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Search, Shield, ThumbsUp, AlertTriangle, CheckCircle, Sparkles } from "lucide-react";
import { AppLayout } from "../../components/layouts/AppLayout";
import { Input } from "../../components/ui/Input";
import { RiskBadge } from "../../components/ui/RiskBadge";
import { CardSkeleton } from "../../components/ui/Skeleton";
import { reportsApi } from "../../services/api/reports.api";
import { QUERY_KEYS } from "../../constants";
import toast from "react-hot-toast";
import { cn } from "../../utils/cn";

// ─── Design tokens — premium fintech (Linear/Stripe/Brex/Mercury) ────────────
const tokens = {
  bg:           "#050505",
  bgSoft:       "#080808",
  surface:      "rgba(15,15,15,0.95)",
  surfaceSolid: "#0B0B0B",
  surfaceHover: "#101010",
  border:       "rgba(163,255,18,0.12)",
  borderBright: "rgba(163,255,18,0.35)",
  borderSoft:   "rgba(255,255,255,0.06)",
  neon:         "#A3FF12",
  neonBright:   "#B6FF2A",
  neonSoft:     "#C4FF47",
  neonDim:      "rgba(163,255,18,0.08)",
  neonGlow:     "0 0 40px rgba(163,255,18,0.25)",
  red:          "#f87171",
  redDim:       "rgba(248,113,113,0.08)",
  amber:        "#fbbf24",
  green:        "#4ade80",
  textPrimary:  "#FFFFFF",
  textBody:     "#D0D0D0",
  textMuted:    "#8A8A8A",
};

// Full-page atmospheric background — radial green glow + dot grid
const pageBg = {
  minHeight: "100vh",
  background: tokens.bg,
  backgroundImage: `
    radial-gradient(ellipse 60% 40% at 50% -5%, rgba(163,255,18,0.10) 0%, transparent 60%),
    radial-gradient(ellipse 40% 30% at 100% 20%, rgba(163,255,18,0.05) 0%, transparent 60%),
    radial-gradient(circle, rgba(163,255,18,0.04) 1px, transparent 1px)
  `,
  backgroundSize: "100% 100%, 100% 100%, 32px 32px",
  position: "relative",
};

// Premium glass card — used everywhere
const glassCard = {
  background: tokens.surface,
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: `1px solid ${tokens.border}`,
  borderRadius: "24px",
  boxShadow: `
    0 0 0 1px rgba(163,255,18,0.05),
    0 10px 40px rgba(0,0,0,0.5)
  `,
  position: "relative",
  overflow: "hidden",
};

const SEVERITY_TO_RISK = {
  LOW: "LOW", MEDIUM: "MEDIUM", HIGH: "HIGH", CRITICAL: "CRITICAL",
};

function ThreatCard({ threat, onUpvote }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      whileHover={{ y: -8 }}
      style={{
        ...glassCard,
        padding: 24,
        display: "flex",
        gap: 20,
        alignItems: "flex-start",
        cursor: "pointer",
        transition: "border-color 0.25s, box-shadow 0.25s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = tokens.borderBright;
        e.currentTarget.style.boxShadow = `
          0 0 0 1px rgba(163,255,18,0.08),
          0 0 40px rgba(163,255,18,0.15),
          0 10px 40px rgba(0,0,0,0.5)
        `;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = tokens.border;
        e.currentTarget.style.boxShadow = `
          0 0 0 1px rgba(163,255,18,0.05),
          0 10px 40px rgba(0,0,0,0.5)
        `;
      }}
    >
      {/* Corner neon glow */}
      <div
        style={{
          position: "absolute",
          top: -40, right: -40,
          width: 160, height: 160,
          background: "radial-gradient(circle, rgba(163,255,18,0.10), transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ flex: 1, minWidth: 0, position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <RiskBadge level={SEVERITY_TO_RISK[threat.severity] || "MEDIUM"} />
          <span
            style={{
              fontSize: 11,
              padding: "4px 10px",
              borderRadius: 999,
              background: tokens.surfaceHover,
              border: `1px solid ${tokens.borderSoft}`,
              color: tokens.textBody,
              fontWeight: 500,
              letterSpacing: "0.02em",
            }}
          >
            {threat.entityType}
          </span>
          {threat.isVerified && (
            <span
              style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                fontSize: 11, padding: "4px 10px", borderRadius: 999,
                background: tokens.neonDim,
                border: `1px solid ${tokens.borderBright}`,
                color: tokens.neon,
                fontWeight: 600,
              }}
            >
              <CheckCircle size={11} /> Verified
            </span>
          )}
        </div>

        {/* Reported value */}
        <div
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: tokens.textPrimary,
            marginBottom: 8,
            letterSpacing: "-0.02em",
            wordBreak: "break-word",
          }}
        >
          {threat.entityValue}
        </div>

        {threat.summary && (
          <p style={{ fontSize: 14, color: tokens.textBody, lineHeight: 1.6, margin: "0 0 14px" }}>
            {threat.summary}
          </p>
        )}

        <div
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            fontSize: 12, color: tokens.textMuted, fontWeight: 500,
          }}
        >
          <AlertTriangle size={12} />
          {threat.reportCount} reports
        </div>
      </div>

      {/* Upvote */}
      <button
        onClick={(e) => { e.stopPropagation(); onUpvote(threat._id); }}
        style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
          padding: "12px 14px", borderRadius: 14,
          background: tokens.surfaceHover,
          border: `1px solid ${tokens.border}`,
          color: tokens.textBody, cursor: "pointer", flexShrink: 0,
          transition: "all 0.2s", minWidth: 56,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = tokens.neonDim;
          e.currentTarget.style.color = tokens.neon;
          e.currentTarget.style.borderColor = tokens.borderBright;
          e.currentTarget.style.boxShadow = "0 0 20px rgba(163,255,18,0.2)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = tokens.surfaceHover;
          e.currentTarget.style.color = tokens.textBody;
          e.currentTarget.style.borderColor = tokens.border;
          e.currentTarget.style.boxShadow = "none";
        }}
      >
        <ThumbsUp size={16} />
        <span style={{ fontSize: 13, fontWeight: 700 }}>{threat.upvotes}</span>
      </button>
    </motion.div>
  );
}

export default function ThreatPage() {
  const [search, setSearch] = useState("");
  const [entityType, setEntityType] = useState("");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: [...QUERY_KEYS.THREATS, search, entityType],
    queryFn: () => reportsApi.searchThreats({
      q: search || undefined,
      entityType: entityType || undefined,
    }).then((r) => r.data.data),
    enabled: true,
  });

  const { mutate: upvote } = useMutation({
    mutationFn: (id) => reportsApi.upvoteThreat(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.THREATS });
      toast.success("Upvoted!");
    },
  });

  const filters = ["", "PHONE", "EMAIL", "COMPANY", "WEBSITE"];

  return (
    <AppLayout>
      <div style={pageBg}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 32px 96px" }}>
          {/* ─── Hero header ─────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            style={{ marginBottom: 40 }}
          >
            <div
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "6px 14px", borderRadius: 999,
                background: tokens.neonDim,
                border: `1px solid ${tokens.borderBright}`,
                color: tokens.neon,
                fontSize: 12, fontWeight: 600, letterSpacing: "0.04em",
                marginBottom: 20,
                boxShadow: tokens.neonGlow,
              }}
            >
              <Sparkles size={12} />
              LIVE THREAT FEED
            </div>

            <h1
              style={{
                fontSize: "clamp(2.5rem, 5vw, 4rem)",
                fontWeight: 800,
                lineHeight: 1,
                letterSpacing: "-0.04em",
                color: tokens.textPrimary,
                margin: "0 0 16px",
              }}
            >
              Threat{" "}
              <span
                style={{
                  background: `linear-gradient(135deg, ${tokens.neon}, ${tokens.neonSoft})`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Intelligence
              </span>
            </h1>
            <p style={{ fontSize: 17, color: tokens.textBody, maxWidth: 640, lineHeight: 1.6, margin: 0 }}>
              Community-reported scam numbers, emails, and companies — verified, scored, and crowd-ranked.
            </p>
          </motion.div>

          {/* ─── Search + filter panel ───────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            style={{ ...glassCard, padding: 24, marginBottom: 32 }}
          >
            {/* Neon top edge */}
            <div
              style={{
                position: "absolute", top: 0, left: 24, right: 24, height: 1,
                background: `linear-gradient(90deg, transparent, ${tokens.neon}, transparent)`,
                opacity: 0.6,
              }}
            />

            <div style={{ position: "relative" }}>
              <Search
                size={18}
                style={{
                  position: "absolute", left: 16, top: "50%",
                  transform: "translateY(-50%)", color: tokens.textMuted,
                  pointerEvents: "none",
                }}
              />
              <Input
                placeholder="Search phone, email, company, or website…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: "100%",
                  padding: "14px 16px 14px 46px",
                  background: tokens.surfaceSolid,
                  border: `1px solid ${tokens.border}`,
                  borderRadius: 14,
                  color: tokens.textPrimary,
                  fontSize: 15,
                  outline: "none",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
              {filters.map((f) => {
                const active = entityType === f;
                return (
                  <button
                    key={f || "all"}
                    onClick={() => setEntityType(f)}
                    style={{
                      fontSize: 12,
                      padding: "8px 16px",
                      borderRadius: 999,
                      border: `1px solid ${active ? tokens.borderBright : tokens.borderSoft}`,
                      background: active ? tokens.neonDim : "transparent",
                      color: active ? tokens.neon : tokens.textBody,
                      cursor: "pointer",
                      transition: "all 0.2s",
                      fontWeight: active ? 700 : 500,
                      letterSpacing: "0.02em",
                      boxShadow: active ? "0 0 16px rgba(163,255,18,0.18)" : "none",
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        e.currentTarget.style.color = tokens.textPrimary;
                        e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        e.currentTarget.style.color = tokens.textBody;
                        e.currentTarget.style.borderColor = tokens.borderSoft;
                      }
                    }}
                  >
                    {f || "All Types"}
                  </button>
                );
              })}
            </div>
          </motion.div>

          {/* ─── Results ─────────────────────────────────────────────── */}
          {isLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {[...Array(5)].map((_, i) => <CardSkeleton key={i} />)}
            </div>
          ) : data?.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {data.map((threat) => (
                <ThreatCard key={threat._id} threat={threat} onUpvote={upvote} />
              ))}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                ...glassCard,
                padding: "72px 32px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: 64, height: 64, borderRadius: 20,
                  background: tokens.neonDim,
                  border: `1px solid ${tokens.borderBright}`,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 20,
                  boxShadow: tokens.neonGlow,
                }}
              >
                <Shield size={28} color={tokens.neon} />
              </div>
              <p style={{ fontSize: 16, color: tokens.textBody, margin: 0 }}>
                {search ? `No threats found for "${search}"` : "No threats reported yet"}
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
