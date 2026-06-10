/**
 * modules/auth/auth.model.js — User schema and model
 *
 * WHY THIS FILE EXISTS:
 * Defines the shape of a User document in MongoDB and attaches
 * password hashing, comparison, and token generation directly to the model.
 *
 * KEY CONCEPTS:
 * 1. Pre-save hook    → auto-hash password before every save
 * 2. Instance methods → functions available on every user document
 * 3. select: false    → password never returned in queries by default
 * 4. Indexes          → fast lookups by email and role
 */

"use strict";

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto"); // Built-in Node.js module — no install needed

// ─── Schema Definition ────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema(
  {
    // ── Basic Info ────────────────────────────────────────────────────────────
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,                    // removes leading/trailing whitespace
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [50, "Name cannot exceed 50 characters"],
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,                  // Creates a unique index in MongoDB
      lowercase: true,               // Always store emails in lowercase
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please provide a valid email",
      ],
    },

    // ── Password ──────────────────────────────────────────────────────────────
    // select: false means password is NEVER returned in queries by default.
    // You must explicitly ask for it: User.findOne().select("+password")
    // This prevents accidentally leaking hashed passwords in API responses.
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
      select: false,
    },

    // ── Role-Based Access Control (RBAC) ─────────────────────────────────────
    // Determines what the user can do. Checked by authorize middleware.
    // "student" = normal user, "admin" = full access
    role: {
      type: String,
      enum: {
        values: ["student", "admin"],
        message: "Role must be student or admin",
      },
      default: "student",
    },

    // ── Profile ───────────────────────────────────────────────────────────────
    avatar: {
      type: String,                  // Cloudinary URL
      default: null,
    },

    college: {
      type: String,
      trim: true,
      maxlength: [100, "College name too long"],
    },

    phone: {
      type: String,
      trim: true,
      match: [/^[+]?[0-9]{10,15}$/, "Invalid phone number"],
    },

    // ── Account Status ────────────────────────────────────────────────────────
    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: Boolean,
      default: true,                 // Admins can deactivate accounts without deleting
    },

    // ── Refresh Token ─────────────────────────────────────────────────────────
    // We store a HASH of the refresh token (not the token itself).
    // If the DB is breached, attackers get hashes — useless without the originals.
    // select: false — never returned in queries
    refreshToken: {
      type: String,
      select: false,
    },

    // ── Password Reset ────────────────────────────────────────────────────────
    // Stores a hashed reset token + expiry for the "forgot password" flow.
    // Again, we store the HASH not the raw token.
    passwordResetToken: {
      type: String,
      select: false,
    },

    passwordResetExpires: {
      type: Date,
      select: false,
    },

    // ── Soft Delete ───────────────────────────────────────────────────────────
    // Instead of deleting users, we set deletedAt.
    // This preserves their analysis history and audit trail.
    // Queries should always filter: { deletedAt: null }
    deletedAt: {
      type: Date,
      default: null,
    },

    // ── Stats (denormalized for performance) ──────────────────────────────────
    // Instead of counting analyses every time, we increment this counter.
    // Denormalization = storing derived data to avoid expensive COUNT queries.
    totalAnalyses: {
      type: Number,
      default: 0,
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },
  },

  {
    // timestamps: true automatically adds createdAt and updatedAt fields
    // Mongoose manages these — you never set them manually
    timestamps: true,

    // toJSON transform — runs every time a user document is converted to JSON
    // (e.g. when sent in an API response via res.json())
    // We use this to remove sensitive fields from responses automatically
    toJSON: {
      transform(doc, ret) {
        delete ret.password;
        delete ret.refreshToken;
        delete ret.passwordResetToken;
        delete ret.passwordResetExpires;
        delete ret.__v;         // Mongoose version key — not useful to clients
        return ret;
      },
    },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
// WHY INDEXES:
// Without an index, MongoDB scans EVERY document to find matches (full collection scan).
// An index is like a book's table of contents — jumps directly to the right page.
//
// email is already indexed (unique: true creates an index automatically)
// We add these for common query patterns in our app:

userSchema.index({ role: 1 });                    // Admin: filter users by role
userSchema.index({ isActive: 1, deletedAt: 1 });  // Filter active, non-deleted users
userSchema.index({ createdAt: -1 });              // Sort by newest first

// ─── Pre-save Hook: Password Hashing ──────────────────────────────────────────
// Runs automatically before EVERY .save() call.
// The `isModified("password")` check is critical:
// Without it, every time you update ANY field (e.g. lastLoginAt), the password
// gets re-hashed — and the existing hash gets hashed again, breaking login.
userSchema.pre("save", async function (next) {
  // `this` = the user document being saved
  // Only hash if password field was actually changed
  if (!this.isModified("password")) return next();

  // bcrypt salt rounds = 12
  // Salt rounds = how many times the hashing algorithm runs.
  // Higher = more secure but slower. 12 is the production standard.
  // 10 rounds ≈ 65ms, 12 rounds ≈ 250ms — slow enough to defeat brute force
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ─── Instance Methods ─────────────────────────────────────────────────────────
// Methods available on every user document instance.
// e.g. const user = await User.findOne({ email })
//      user.comparePassword("plaintext")  ← calls this method

// Compare a plain-text password against the stored hash
// Used in login flow
userSchema.methods.comparePassword = async function (candidatePassword) {
  // bcrypt.compare handles the salt extraction and re-hashing internally
  return bcrypt.compare(candidatePassword, this.password);
};

// Generate a short-lived JWT access token
// Signed with ACCESS secret — different from refresh secret
// Payload contains only what's needed for authorization checks
userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      id: this._id,
      email: this.email,
      role: this.role,
    },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m" }
  );
};

// Generate a long-lived JWT refresh token
// Signed with a DIFFERENT secret from access token
// Why different secret? If access secret is compromised, refresh tokens stay safe
userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    { id: this._id },             // Minimal payload — just the ID
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d" }
  );
};

// Generate a secure random token for password reset emails
// Uses crypto (built-in) to generate truly random bytes
// We store the HASH in DB, send the RAW token in the email link
userSchema.methods.generatePasswordResetToken = function () {
  // Generate 32 random bytes → convert to hex string
  const resetToken = crypto.randomBytes(32).toString("hex");

  // Hash it before storing — if DB is breached, raw tokens are safe
  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  // Token expires in 10 minutes
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  // Return the RAW token — this goes in the email link
  return resetToken;
};

const User = mongoose.model("User", userSchema);
module.exports = User;