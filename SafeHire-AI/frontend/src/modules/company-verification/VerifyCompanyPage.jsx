import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { BadgeCheck, Sparkles, Building2 } from "lucide-react";
import toast from "react-hot-toast";
import { AppLayout } from "../../components/layouts/AppLayout";
import { verificationApi } from "../../services/api/verification.api";

/* ---------- Design tokens (match Analyze / Dashboard redesign) ---------- */
const NEON = "#A3FF12";
const NEON_SOFT = "rgba(163,255,18,0.25)";
const NEON_LINE = "rgba(163,255,18,0.12)";
const SURFACE = "rgba(15,15,15,0.95)";
const BG = "#050505";
const TEXT = "#FFFFFF";
const TEXT_DIM = "#9E9E9E";
const BORDER_SOFT = "rgba(255,255,255,0.08)";

const FONT_STACK =
  '"Inter","SF Pro Display","General Sans","Satoshi",ui-sans-serif,system-ui,-apple-system,sans-serif';

function Panel({ children, style }) {
  return (
    <div
      style={{
        background: SURFACE,
        border: `1px solid ${NEON_LINE}`,
        borderRadius: 24,
        backdropFilter: "blur(20px)",
        boxShadow: "0 8px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.03)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

const EXAMPLE_TEXT =
  "ABC Tech Solutions is hiring for a Software Engineering Intern role. Contact: hr@abctechsolutions.com, +91 98765 43210. Website: www.abctechsolutions.com";

export default function VerifyCompanyPage() {
  const navigate = useNavigate();
  const [text, setText] = useState("");

  const { mutate: verify, isPending } = useMutation({
    mutationFn: (inputText) => verificationApi.verifyCompany(inputText),
    onSuccess: ({ data }) => {
      toast.success("Verification complete!");
      navigate(`/verify-company/${data.data._id}`);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Verification failed. Please try again.");
    },
  });

  const handleSubmit = () => {
    if (text.trim().length < 3) {
      toast.error("Paste the offer text or company details first");
      return;
    }
    verify(text.trim());
  };

  const canSubmit = text.trim().length >= 3 && !isPending;

  return (
    <AppLayout>
      <div
        style={{
          minHeight: "100%",
          background: `radial-gradient(1200px 600px at 80% -10%, rgba(163,255,18,0.08), transparent 60%),
                       radial-gradient(900px 500px at -10% 20%, rgba(163,255,18,0.05), transparent 55%),
                       ${BG}`,
          color: TEXT,
          fontFamily: FONT_STACK,
          padding: "48px 24px 96px",
        }}
      >
        <div style={{ maxWidth: 880, margin: "0 auto" }}>
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            style={{ marginBottom: 48 }}
          >
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
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: "-0.01em",
                marginBottom: 20,
              }}
            >
              <Sparkles size={12} />
              Company Verification Agent
            </div>

            <h1
              style={{
                fontSize: "clamp(2.25rem, 4vw, 3.25rem)",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                lineHeight: 1,
                margin: 0,
                color: TEXT,
              }}
            >
              Verify a Company
            </h1>
            <p
              style={{
                marginTop: 14,
                fontSize: 16,
                lineHeight: 1.7,
                color: TEXT_DIM,
                fontWeight: 400,
                maxWidth: 620,
              }}
            >
              Paste the offer message, or just the company name, website and
              recruiter email. We extract the details with AI, then run real
              checks against them — domain lookup, email matching, and more.
            </p>
          </motion.div>

          {/* Text input */}
          <Panel style={{ padding: 28, marginBottom: 24 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 16,
              }}
            >
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
                <Building2 size={14} color={NEON} />
              </div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: TEXT_DIM,
                }}
              >
                Offer text or company details
              </div>
            </div>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={EXAMPLE_TEXT}
              rows={8}
              style={{
                width: "100%",
                resize: "vertical",
                background: "rgba(255,255,255,0.02)",
                border: `1px solid ${BORDER_SOFT}`,
                borderRadius: 16,
                padding: "16px 18px",
                fontFamily: FONT_STACK,
                fontSize: 14.5,
                lineHeight: 1.7,
                color: TEXT,
                outline: "none",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(163,255,18,0.35)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = BORDER_SOFT)}
            />

            <div
              style={{
                marginTop: 10,
                fontSize: 12,
                color: TEXT_DIM,
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span>The more detail you paste, the more we can verify.</span>
              <span>{text.length} / 8000</span>
            </div>
          </Panel>

          {/* Submit button */}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              width: "100%",
              padding: "18px 24px",
              borderRadius: 999,
              border: "none",
              cursor: canSubmit ? "pointer" : "not-allowed",
              background: canSubmit ? NEON : "rgba(255,255,255,0.06)",
              color: canSubmit ? "#050505" : TEXT_DIM,
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: "-0.01em",
              fontFamily: FONT_STACK,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              boxShadow: canSubmit
                ? `0 10px 40px ${NEON_SOFT}, 0 0 0 1px rgba(163,255,18,0.4) inset`
                : "none",
              transition: "all 0.3s cubic-bezier(.4,0,.2,1)",
            }}
          >
            {isPending ? (
              <>
                <span
                  style={{
                    width: 16,
                    height: 16,
                    border: "2px solid rgba(5,5,5,0.25)",
                    borderTopColor: "#050505",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                  }}
                />
                Extracting + verifying...
              </>
            ) : (
              <>
                <BadgeCheck size={16} />
                Verify Company
              </>
            )}
          </button>

          {isPending && (
            <div
              style={{
                marginTop: 16,
                textAlign: "center",
                fontSize: 12,
                color: TEXT_DIM,
                letterSpacing: "-0.01em",
              }}
            >
              Running AI extraction + domain/email checks · this takes a few seconds
            </div>
          )}
        </div>

        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </AppLayout>
  );
}