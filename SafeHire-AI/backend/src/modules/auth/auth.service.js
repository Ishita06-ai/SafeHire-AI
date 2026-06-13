/**
 * modules/auth/auth.service.js — Auth business logic
 *
 * RULES FOR THIS FILE:
 * ✅ Call repository methods for DB access
 * ✅ Throw ApiError for business rule violations
 * ✅ Generate and verify tokens
 * ✅ Hash tokens before storing
 * ❌ Never touch req or res
 * ❌ Never write Mongoose queries directly
 * ❌ Never send HTTP responses
 */

"use strict";

const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const authRepository = require("./auth.repository");
const ApiError = require("../../utils/ApiError");
const logger = require("../../utils/logger");

class AuthService {

  // ─── Register ───────────────────────────────────────────────────────────────
  // Business rules:
  // 1. Email must not already exist
  // 2. Create user (password hashing handled by model pre-save hook)
  // 3. Generate both tokens
  // 4. Store hashed refresh token in DB
  async register(userData) {
    const { fullName, email, password, college, phone } = userData;

    // Rule 1: Check duplicate email
    const existingUser = await authRepository.findByEmail(email);
    if (existingUser) {
      throw ApiError.conflict("An account with this email already exists");
    }

    // Rule 2: Create user
    // Password hashing happens automatically in the pre-save hook
    const user = await authRepository.create({
      fullName,
      email,
      password,
      college,
      phone,
    });

    // Rule 3: Generate tokens
    // We need the full Mongoose document (not lean) to call instance methods
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    // Rule 4: Hash refresh token before storing
    // We never store the raw token — only its SHA-256 hash
    const hashedRefreshToken = this._hashToken(refreshToken);
    await authRepository.saveRefreshToken(user._id, hashedRefreshToken);

    logger.info("New user registered", { userId: user._id, email: user.email });

    // Return tokens + user data (password excluded by toJSON transform)
    return {
      user,
      accessToken,
      refreshToken, // Raw token — goes into httpOnly cookie in controller
    };
  }

  // ─── Login ──────────────────────────────────────────────────────────────────
  // Business rules:
  // 1. User must exist with this email
  // 2. Account must be active
  // 3. Password must match
  // 4. Issue new tokens
  async login(email, password) {

    // Rule 1 + 2: Find user — includePassword:true overrides select:false
    const user = await authRepository.findByEmail(email, true);
    if (!user) {
      // IMPORTANT: same error message for "user not found" and "wrong password"
      // If you say "user not found" — attacker learns which emails are registered
      // This is called "username enumeration" — a security vulnerability
      throw ApiError.unauthorized("Invalid email or password");
    }

    if (!user.isActive) {
      throw ApiError.forbidden("Your account has been deactivated. Contact support.");
    }

    // Rule 3: Compare password
    // We need a full Mongoose document for instance methods, but findByEmail
    // returns lean(). So we use bcrypt directly here.
    const bcrypt = require("bcryptjs");
    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      throw ApiError.unauthorized("Invalid email or password"); // Same message — no enumeration
    }

    // Rule 4: Generate tokens
    // Re-create Mongoose document to access instance methods
    const User = require("./auth.model");
    const userDoc = await User.findById(user._id);

    const accessToken = userDoc.generateAccessToken();
    const refreshToken = userDoc.generateRefreshToken();

    // Store hashed refresh token + update lastLoginAt
    const hashedRefreshToken = this._hashToken(refreshToken);
    await authRepository.saveRefreshToken(user._id, hashedRefreshToken);

    logger.info("User logged in", { userId: user._id });

    return {
      user: userDoc,
      accessToken,
      refreshToken,
    };
  }

  // ─── Refresh Access Token ───────────────────────────────────────────────────
  // Called when the access token expires (every 15 minutes).
  // Client sends the refresh token cookie → we issue a new access token.
  //
  // SECURITY — Refresh Token Rotation:
  // Every time a refresh token is used, we REPLACE it with a new one.
  // The old one is immediately invalidated.
  // If an attacker steals a refresh token and uses it AFTER the real user has,
  // the real user's next request will fail (their token was rotated away).
  // This signals a theft and you can lock the account.
  async refreshAccessToken(incomingRefreshToken) {
    if (!incomingRefreshToken) {
      throw ApiError.unauthorized("No refresh token provided");
    }

    // Step 1: Verify the JWT signature
    let decoded;
    try {
      decoded = jwt.verify(incomingRefreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      throw ApiError.unauthorized("Invalid or expired refresh token");
    }

    // Step 2: Hash the incoming token and check it exists in DB
    // This confirms the token was issued by us and hasn't been rotated away
    const hashedToken = this._hashToken(incomingRefreshToken);
    const user = await authRepository.findByRefreshToken(hashedToken);

    if (!user) {
      // Token was already rotated — possible token theft!
      // In production: trigger security alert, invalidate all sessions for this user
      logger.warn("Refresh token reuse detected — possible token theft", {
        userId: decoded.id,
      });
      throw ApiError.unauthorized("Refresh token has been revoked. Please log in again.");
    }

    // Step 3: Generate NEW tokens (rotation)
    const User = require("./auth.model");
    const userDoc = await User.findById(user._id);

    const newAccessToken = userDoc.generateAccessToken();
    const newRefreshToken = userDoc.generateRefreshToken();

    // Step 4: Replace old refresh token with new one in DB
    const newHashedToken = this._hashToken(newRefreshToken);
    await authRepository.saveRefreshToken(user._id, newHashedToken);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  // ─── Logout ─────────────────────────────────────────────────────────────────
  // Clears the refresh token from DB.
  // Even if the refresh token cookie is stolen after this, it won't work —
  // there's no matching hash in the DB anymore.
  async logout(userId) {
    await authRepository.clearRefreshToken(userId);
    logger.info("User logged out", { userId });
  }

  // ─── Forgot Password ────────────────────────────────────────────────────────
  // Generates a reset token and returns it.
  // Controller will send it via email (we'll add email service later).
  async forgotPassword(email) {
    const User = require("./auth.model");
    const user = await User.findOne({ email, deletedAt: null });

    // SECURITY: Don't reveal if email exists or not
    // Always return the same success message whether email is found or not
    if (!user) {
      // Return success anyway — attacker can't tell if email is registered
      return { message: "If this email exists, a reset link has been sent." };
    }

    // Generate reset token (raw) and store its hash in DB
    const resetToken = user.generatePasswordResetToken();
    await user.save({ validateBeforeSave: false }); // Skip validation — only updating reset fields

    logger.info("Password reset requested", { userId: user._id });

    // Return raw token — controller sends this in email
    return {
      resetToken,
      message: "If this email exists, a reset link has been sent.",
    };
  }

  // ─── Reset Password ─────────────────────────────────────────────────────────
  async resetPassword(rawToken, newPassword) {
    // Hash the incoming raw token to compare with stored hash
    const hashedToken = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    // Find user with matching token that hasn't expired
    const user = await authRepository.findByResetToken(hashedToken);
    if (!user) {
      throw ApiError.badRequest("Reset token is invalid or has expired");
    }

    // Update password — pre-save hook will hash it
    const User = require("./auth.model");
    const userDoc = await User.findById(user._id);
    userDoc.password = newPassword;
    userDoc.passwordResetToken = undefined;
    userDoc.passwordResetExpires = undefined;
    await userDoc.save();

    logger.info("Password reset successful", { userId: user._id });
  }

  // ─── Private: Hash a token ──────────────────────────────────────────────────
  // SHA-256 hash — fast and one-way.
  // Used for refresh tokens and reset tokens stored in DB.
  // We don't use bcrypt here because these tokens are already long random strings
  // (not user-chosen passwords), so they don't need the extra slowness of bcrypt.
  _hashToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
  }
}

module.exports = new AuthService();