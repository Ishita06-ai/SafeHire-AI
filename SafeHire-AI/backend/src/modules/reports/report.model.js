/**
 * modules/reports/report.model.js
 *
 * TWO collections work together here:
 *
 * 1. Report      — one document per user submission
 *                  "User X reported phone Y with description Z"
 *
 * 2. ThreatEntity — one document per unique threat (phone/email/company)
 *                  Aggregated from all reports about the same entity
 *                  "Phone Y has been reported 14 times, verified: true"
 *
 * WHY TWO COLLECTIONS:
 * Report = raw user input (audit trail, spam prevention)
 * ThreatEntity = processed threat intelligence (what users search)
 * Separating them lets you moderate reports without touching the threat index.
 */

"use strict";

const mongoose = require("mongoose");

// ─── Report Schema ────────────────────────────────────────────────────────────
const reportSchema = new mongoose.Schema(
  {
    // Who submitted this report
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // What type of entity is being reported
    entityType: {
      type: String,
      enum: ["PHONE", "EMAIL", "COMPANY", "WEBSITE", "RECRUITER"],
      required: [true, "Entity type is required"],
    },

    // The actual value being reported
    // e.g. "+919876543210", "fraud@fakejobs.com", "FakeTech Pvt Ltd"
    entityValue: {
      type: String,
      required: [true, "Entity value is required"],
      trim: true,
      maxlength: 500,
    },

    // What kind of scam this was
    scamType: {
      type: String,
      enum: [
        "FAKE_JOB_OFFER",
        "ADVANCE_FEE_FRAUD",
        "IDENTITY_THEFT",
        "PHISHING",
        "FAKE_INTERNSHIP",
        "FAKE_SCHOLARSHIP",
        "IMPERSONATION",
        "OTHER",
      ],
      required: true,
    },

    // User's description of what happened
    description: {
      type: String,
      required: [true, "Description is required"],
      minlength: [20, "Please provide at least 20 characters"],
      maxlength: [2000, "Description too long"],
    },

    // Optional evidence — screenshot URL from Cloudinary
    evidenceUrl: {
      type: String,
      default: null,
    },

    // Admin moderation status
    // PENDING → under review, APPROVED → visible, REJECTED → hidden
    moderationStatus: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
      index: true,
    },

    moderationNote: {
      type: String,
      default: null,
    },

    // Reference to the ThreatEntity this report contributed to
    threatEntity: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ThreatEntity",
      default: null,
    },
  },
  { timestamps: true }
);

// Prevent duplicate reports — one user can't report the same entity twice
// Compound unique index on reporter + entity value
reportSchema.index(
  { reportedBy: 1, entityValue: 1 },
  { unique: true, partialFilterExpression: { moderationStatus: { $ne: "REJECTED" } } }
);
reportSchema.index({ entityType: 1, entityValue: 1 });
reportSchema.index({ createdAt: -1 });

// ─── ThreatEntity Schema ──────────────────────────────────────────────────────
const threatEntitySchema = new mongoose.Schema(
  {
    entityType: {
      type: String,
      enum: ["PHONE", "EMAIL", "COMPANY", "WEBSITE", "RECRUITER"],
      required: true,
    },

    // Normalized value — lowercase email, digits-only phone
    // Normalization ensures "+91 98765 43210" and "9876543210" are the same entity
    entityValue: {
      type: String,
      required: true,
      trim: true,
      unique: true,   // One ThreatEntity per unique value
    },

    // Denormalized count — incremented with $inc on every new report
    // Avoids COUNT query on every search
    reportCount: {
      type: Number,
      default: 1,
      index: true,    // Sort by most reported
    },

    // Auto-verified when reportCount reaches threshold (default: 3)
    isVerified: {
      type: Boolean,
      default: false,
      index: true,
    },

    // Most common scam type reported for this entity
    primaryScamType: {
      type: String,
      enum: [
        "FAKE_JOB_OFFER", "ADVANCE_FEE_FRAUD", "IDENTITY_THEFT",
        "PHISHING", "FAKE_INTERNSHIP", "FAKE_SCHOLARSHIP", "IMPERSONATION", "OTHER",
      ],
    },

    // Severity calculated from reportCount + scamType
    severityLevel: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      default: "LOW",
    },

    // Short community-generated summary (from most upvoted description)
    summary: {
      type: String,
      maxlength: 500,
    },

    // Upvotes from community confirming this threat is real
    upvotes: {
      type: Number,
      default: 0,
    },

    // Array of userIds who upvoted — prevents duplicate upvotes
    upvotedBy: {
      type: [mongoose.Schema.Types.ObjectId],
      default: [],
      select: false,   // Don't return this large array in normal queries
    },

    // Admin can manually verify or flag as false positive
    adminVerified: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

threatEntitySchema.index({ entityType: 1, entityValue: 1 });
threatEntitySchema.index({ reportCount: -1 });
threatEntitySchema.index({ isVerified: 1, severityLevel: 1 });

// Text search index — lets users search "TCS fraud" and find matching entities
threatEntitySchema.index(
  { entityValue: "text", summary: "text" },
  { weights: { entityValue: 10, summary: 5 } } // entityValue matches rank higher
);

const Report = mongoose.model("Report", reportSchema);
const ThreatEntity = mongoose.model("ThreatEntity", threatEntitySchema);

module.exports = { Report, ThreatEntity };