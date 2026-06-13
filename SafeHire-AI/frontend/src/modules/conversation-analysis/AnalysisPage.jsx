import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, X, Shield, Image, Sparkles, FileImage, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";
import { AppLayout } from "../../components/layouts/AppLayout";
import { Button } from "../../components/ui/Button";
import { analysisApi } from "../../services/api/analysis.api";
import { PLATFORMS } from "../../constants";
import { cn } from "../../utils/cn";

/* ---------- Design tokens (match Dashboard redesign) ---------- */
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

const FONT_STACK =
  '"Inter","SF Pro Display","General Sans","Satoshi",ui-sans-serif,system-ui,-apple-system,sans-serif';

/* ---------- Reusable Panel ---------- */
function Panel({ children, style, className }) {
  return (
    <div
      className={className}
      style={{
        background: SURFACE,
        border: `1px solid ${NEON_LINE}`,
        borderRadius: 24,
        backdropFilter: "blur(20px)",
        boxShadow:
          "0 8px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.03)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export default function AnalysisPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [platform, setPlatform] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const { mutate: analyze, isPending } = useMutation({
    mutationFn: (formData) => analysisApi.analyzeConversation(formData),
    onSuccess: ({ data }) => {
      toast.success("Analysis complete!");
      navigate(`/analysis/${data.data._id}`);
    },
    onError: (err) => {
      toast.error(
        err.response?.data?.message || "Analysis failed. Please try again."
      );
    },
  });

  const handleFileSelect = (selectedFile) => {
    if (!selectedFile) return;
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error("File too large. Max 10MB.");
      return;
    }
    setFile(selectedFile);
    const url = URL.createObjectURL(selectedFile);
    setPreview(url);
    toast.success(`File selected: ${selectedFile.name}`);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFileSelect(dropped);
  };

  const removeFile = () => {
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = () => {
    if (!file) {
      toast.error("Please select a screenshot first");
      return;
    }
    if (!platform) {
      toast.error("Please select the platform first");
      return;
    }
    const formData = new FormData();
    formData.append("screenshot", file);
    formData.append("platform", platform);
    analyze(formData);
  };

  const canSubmit = !!file && !!platform && !isPending;

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
              AI Scam Detection
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
              Analyze Conversation
            </h1>
            <p
              style={{
                marginTop: 14,
                fontSize: 16,
                lineHeight: 1.7,
                color: TEXT_DIM,
                fontWeight: 400,
                maxWidth: 560,
              }}
            >
              Upload a screenshot to detect scam indicators using AI. We run OCR
              plus risk analysis in seconds.
            </p>
          </motion.div>

          {/* Platform selector */}
          <Panel style={{ padding: 28, marginBottom: 24 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 18,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: TEXT_DIM,
                    marginBottom: 6,
                  }}
                >
                  Step 01
                </div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    letterSpacing: "-0.02em",
                    color: TEXT,
                  }}
                >
                  Which platform is this from?
                </div>
              </div>
              {platform && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 12px",
                    borderRadius: 999,
                    background: "rgba(163,255,18,0.10)",
                    border: `1px solid ${NEON_LINE_HOVER}`,
                    color: NEON,
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  <CheckCircle2 size={12} />
                  {platform}
                </span>
              )}
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {PLATFORMS.map(({ value, label }) => {
                const active = platform === value;
                return (
                  <button
                    key={value}
                    onClick={() => {
                      setPlatform(value);
                      toast.success(`Platform: ${label}`);
                    }}
                    style={{
                      backgroundColor: active
                        ? "rgba(163,255,18,0.10)"
                        : "rgba(255,255,255,0.02)",
                      borderColor: active ? NEON_LINE_HOVER : BORDER_SOFT,
                      color: active ? NEON : TEXT_BODY,
                      padding: "10px 16px",
                      borderRadius: 999,
                      border: "1px solid",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 500,
                      letterSpacing: "-0.01em",
                      transition: "all 0.3s cubic-bezier(.4,0,.2,1)",
                      fontFamily: FONT_STACK,
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </Panel>

          {/* File upload */}
          <Panel style={{ padding: 28, marginBottom: 24 }}>
            <div style={{ marginBottom: 18 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: TEXT_DIM,
                  marginBottom: 6,
                }}
              >
                Step 02
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  color: TEXT,
                }}
              >
                Upload screenshot
              </div>
            </div>

            <AnimatePresence mode="wait">
              {!file ? (
                <motion.div
                  key="drop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: `1.5px dashed ${
                      isDragging ? NEON : "rgba(255,255,255,0.12)"
                    }`,
                    borderRadius: 20,
                    padding: "56px 24px",
                    textAlign: "center",
                    cursor: "pointer",
                    background: isDragging
                      ? "rgba(163,255,18,0.06)"
                      : "rgba(255,255,255,0.02)",
                    transition: "all 0.3s cubic-bezier(.4,0,.2,1)",
                  }}
                >
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 999,
                      margin: "0 auto 16px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "rgba(163,255,18,0.10)",
                      border: `1px solid ${NEON_LINE}`,
                      boxShadow: `0 0 30px ${NEON_SOFT}`,
                    }}
                  >
                    <Upload size={22} color={NEON} />
                  </div>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 600,
                      letterSpacing: "-0.02em",
                      color: TEXT,
                      marginBottom: 6,
                    }}
                  >
                    Drop screenshot here
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: TEXT_DIM,
                      marginBottom: 14,
                    }}
                  >
                    or click to browse
                  </div>
                  <div
                    style={{
                      display: "inline-block",
                      fontSize: 11,
                      color: TEXT_DIM,
                      padding: "4px 10px",
                      borderRadius: 999,
                      border: `1px solid ${BORDER_SOFT}`,
                    }}
                  >
                    JPEG · PNG · WEBP · up to 10MB
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const selected = e.target.files?.[0];
                      if (selected) handleFileSelect(selected);
                    }}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="file"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  style={{
                    background: SURFACE_2,
                    border: `1px solid ${NEON_LINE}`,
                    borderRadius: 20,
                    padding: 16,
                    display: "flex",
                    gap: 16,
                    alignItems: "center",
                  }}
                >
                  {preview && (
                    <img
                      src={preview}
                      alt="preview"
                      style={{
                        width: 88,
                        height: 88,
                        objectFit: "cover",
                        borderRadius: 14,
                        border: `1px solid ${BORDER_SOFT}`,
                      }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 4,
                      }}
                    >
                      <FileImage size={14} color={NEON} />
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: TEXT,
                          letterSpacing: "-0.01em",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {file.name}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: TEXT_DIM }}>
                      {(file.size / 1024 / 1024).toFixed(2)} MB · ready to
                      analyze
                    </div>
                  </div>
                  <button
                    onClick={removeFile}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.04)",
                      border: `1px solid ${BORDER_SOFT}`,
                      color: TEXT_BODY,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "all 0.3s cubic-bezier(.4,0,.2,1)",
                    }}
                    aria-label="Remove file"
                  >
                    <X size={16} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </Panel>

          {/* Status indicators */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 20,
              padding: "0 4px",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                fontWeight: 500,
                color: platform ? NEON : TEXT_DIM,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: platform ? NEON : "rgba(255,255,255,0.2)",
                  boxShadow: platform ? `0 0 8px ${NEON_SOFT}` : "none",
                }}
              />
              {platform ? `Platform: ${platform}` : "Select platform"}
            </span>
            <span style={{ color: "rgba(255,255,255,0.15)" }}>•</span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                fontWeight: 500,
                color: file ? NEON : TEXT_DIM,
                maxWidth: "100%",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: file ? NEON : "rgba(255,255,255,0.2)",
                  boxShadow: file ? `0 0 8px ${NEON_SOFT}` : "none",
                }}
              />
              {file ? `File: ${file.name}` : "Select file"}
            </span>
          </div>

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
              background: canSubmit
                ? NEON
                : "rgba(255,255,255,0.06)",
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
                Analyzing with AI...
              </>
            ) : (
              <>
                <Shield size={16} />
                Analyze Screenshot
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
              Running OCR + AI analysis · this takes 10–20 seconds
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
