/**
 * modules/conversations/conversation.model.js
 *
 * WHY THIS FILE EXISTS:
 * Stores every AI conversation analysis result permanently.
 * Used for: user history dashboard, admin analytics, avoiding re-analysis cost.
 *
 * DESIGN DECISIONS:
 * - indicators as structured array → queryable, highlightable in UI
 * - fileUrl stored → user can re-view the original screenshot
 * - processingStatus field → AI analysis is async, UI polls for completion
 * - soft delete → user can "delete" from their view but admin retains for safety intel
 */

"use strict";

const mongoose = require("mongoose");

// ─── Sub-schema: Individual scam indicator ────────────────────────────────────
// Each indicator = one suspicious thing found in the conversation.
// Stored as array so UI can highlight each phrase individually.
const indicatorSchema = new mongoose.Schema(
  {
    // Category of the scam signal detected
    type: {
      type: String,
      enum: [
        "PAYMENT_REQUEST",       // "Pay ₹500 registration fee"
        "URGENCY_PRESSURE",      // "Apply within 2 hours or lose the offer"
        "PERSONAL_DATA_REQUEST", // "Send your Aadhaar and bank details"
        "IMPERSONATION",         // Fake company name or recruiter identity
        "SUSPICIOUS_LINK",       // Unverified or shortened URLs
        "GROOMING_BEHAVIOR",     // Building fake emotional trust
        "GRAMMAR_ANOMALY",       // Poor grammar inconsistent with claimed company
        "UNREALISTIC_OFFER",     // "₹5 LPA for freshers, work from home, no experience"
        "CONFIDENTIALITY_DEMAND",// "Don't tell your parents about this opportunity"
        "FAKE_CREDENTIAL",       // Fake employee ID, fake offer letter attached
      ],
      required: true,
    },

    // The exact phrase from the conversation that triggered this indicator
    // Used by frontend to highlight suspicious text in the screenshot
    phrase: {
      type: String,
      required: true,
      maxlength: 500,
    },

    // How confident the AI is about this indicator (0.0 to 1.0)
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      required: true,
    },

    // Plain English explanation of why this phrase is suspicious
    explanation: {
      type: String,
      required: true,
      maxlength: 1000,
    },
  },
  { _id: false } // Don't create _id for each indicator — saves space, not needed
);

// ─── Main schema ──────────────────────────────────────────────────────────────
const conversationSchema = new mongoose.Schema(
  {
    // ── Ownership ──────────────────────────────────────────────────────────
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true, // We query by user frequently — index speeds this up
    },

    // ── Source of the conversation ─────────────────────────────────────────
    platform: {
      type: String,
      enum: ["WHATSAPP", "TELEGRAM", "INSTAGRAM", "LINKEDIN", "EMAIL", "OTHER"],
      required: [true, "Platform is required"],
    },

    // ── Uploaded file info ─────────────────────────────────────────────────
    fileUrl: {
      type: String,       // Cloudinary URL of the uploaded screenshot
      required: true,
    },

    filePublicId: {
      type: String,       // Cloudinary public_id — needed to delete the file later
      required: true,
    },

    // ── OCR extracted text ─────────────────────────────────────────────────
    // Raw text extracted from the screenshot before AI analysis.
    // Stored so we don't re-run expensive OCR if re-analysis is needed.
    extractedText: {
      type: String,
      maxlength: 50000,   // ~50KB max — enough for any chat screenshot
    },

    // ── AI Analysis Results ────────────────────────────────────────────────
    riskLevel: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      default: null,       // null until AI finishes processing
    },

    // 0-100 score. Thresholds: LOW <30, MEDIUM 30-59, HIGH 60-84, CRITICAL 85+
    riskScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },

    // Array of structured scam indicators found
    indicators: {
      type: [indicatorSchema],
      default: [],
    },

    // Plain English summary of why this is risky (shown to user)
    explanation: {
      type: String,
      maxlength: 2000,
    },

    // Actionable steps for the student
    recommendations: {
      type: [String],
      default: [],
    },

    // ── Processing Status ──────────────────────────────────────────────────
    // AI analysis is async — can take 5-15 seconds.
    // Frontend polls this status until it's "COMPLETED".
    // PENDING   → just uploaded, queued for analysis
    // PROCESSING → OCR + AI running
    // COMPLETED  → results ready
    // FAILED     → something went wrong, user can retry
    status: {
      type: String,
      enum: ["PENDING", "PROCESSING", "COMPLETED", "FAILED"],
      default: "PENDING",
    },

    // If status is FAILED, store why so we can debug
    failureReason: {
      type: String,
      default: null,
    },

    // How long the full analysis took in milliseconds
    // Useful for monitoring AI performance over time
    processingTimeMs: {
      type: Number,
      default: null,
    },

    // ── Soft Delete ────────────────────────────────────────────────────────
    // User "deletes" from their dashboard but admin keeps the record
    // for threat intelligence and pattern analysis
    deletedAt: {
      type: Date,
      default: null,
    },
  },

  {
    timestamps: true, // createdAt, updatedAt auto-managed
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
// Compound index: most common query pattern is "get all analyses for user X,
// sorted by newest first, only non-deleted"
conversationSchema.index({ user: 1, createdAt: -1 });
conversationSchema.index({ user: 1, deletedAt: 1 });

// For admin analytics: "how many HIGH/CRITICAL analyses this week?"
conversationSchema.index({ riskLevel: 1, createdAt: -1 });

// For status polling: "find all PENDING analyses to process"
conversationSchema.index({ status: 1 });

// For platform analytics: "which platform has most scams?"
conversationSchema.index({ platform: 1, riskLevel: 1 });

const Conversation = mongoose.model("Conversation", conversationSchema);
module.exports = Conversation;