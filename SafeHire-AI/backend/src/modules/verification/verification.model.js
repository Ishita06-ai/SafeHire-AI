/**
 * modules/verification/verification.model.js
 *
 * WHY THIS FILE EXISTS:
 * Stores every Company Verification run permanently — same reasoning as
 * conversation.model.js: user history, avoid re-running Gemini + DNS checks
 * for the same submission, dashboard stats later.
 *
 * DESIGN:
 * - extracted   → exactly what Gemini pulled from the pasted text (or null
 *                 per-field — we never let the AI invent a website/email)
 * - checks      → one row per verification signal, each tagged VERIFIED
 *                 (a real DNS/HTTP/MX check) or AI_ASSESSED (Gemini's
 *                 qualitative judgment) so the UI never overstates what was
 *                 actually confirmed
 * - trustScore  → weighted roll-up of `checks`, 0-100
 */

"use strict";

const mongoose = require("mongoose");

// ─── Sub-schema: one verification signal ──────────────────────────────────────
const checkSchema = new mongoose.Schema(
  {
    id: { type: String, required: true }, // e.g. "WEBSITE_FOUND"
    label: { type: String, required: true }, // e.g. "Website Found"
    category: {
      type: String,
      enum: ["VERIFIED", "AI_ASSESSED"],
      required: true,
    },
    status: {
      type: String,
      enum: ["PASS", "FAIL", "UNKNOWN"],
      required: true,
    },
    weight: { type: Number, required: true },
    detail: { type: String, maxlength: 500 },
    // Only set for the AI_CONSISTENCY check — its raw 0-100 score
    score: { type: Number, min: 0, max: 100, default: null },
  },
  { _id: false }
);

// ─── Sub-schema: what Gemini extracted from the pasted text ──────────────────
const extractedSchema = new mongoose.Schema(
  {
    companyName: { type: String, default: null, maxlength: 200 },
    website: { type: String, default: null, maxlength: 300 },
    // Was the website found in the user's pasted text, or located via a
    // live web search because the text itself didn't mention one?
    websiteSource: { type: String, enum: ["DOCUMENT", "WEB_SEARCH", null], default: null },
    email: { type: String, default: null, maxlength: 200 },
    phone: { type: String, default: null, maxlength: 50 },
    recruiterName: { type: String, default: null, maxlength: 200 },
    linkedinUrl: { type: String, default: null, maxlength: 300 },
    linkedinSource: { type: String, enum: ["DOCUMENT", "WEB_SEARCH", null], default: null },
    roleTitle: { type: String, default: null, maxlength: 200 },
  },
  { _id: false }
);

const aiAssessmentSchema = new mongoose.Schema(
  {
    consistencyScore: { type: Number, min: 0, max: 100, default: null },
    summary: { type: String, default: "", maxlength: 1000 },
    redFlags: { type: [String], default: [] },
  },
  { _id: false }
);

const verificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Raw text the user pasted (offer text, or just a company name/snippet)
    inputText: {
      type: String,
      required: true,
      maxlength: 8000,
    },

    extracted: { type: extractedSchema, default: () => ({}) },
    checks: { type: [checkSchema], default: [] },

    // 0-100 weighted roll-up of `checks` — null until processing completes
    trustScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },

    aiAssessment: { type: aiAssessmentSchema, default: () => ({}) },

    // Same async lifecycle pattern as Conversation
    status: {
      type: String,
      enum: ["PENDING", "PROCESSING", "COMPLETED", "FAILED"],
      default: "PENDING",
    },
    failureReason: { type: String, default: null },
    processingTimeMs: { type: Number, default: null },

    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

verificationSchema.index({ user: 1, createdAt: -1 });
verificationSchema.index({ user: 1, deletedAt: 1 });
verificationSchema.index({ trustScore: 1 });

module.exports = mongoose.model("Verification", verificationSchema);