/**
 * modules/auth/auth.repository.js — Database access layer for Users
 *
 * RULE: This is the ONLY file that writes Mongoose/MongoDB queries for users.
 * Services call these methods. They never write User.findOne() themselves.
 *
 * WHY: If you change your DB or ORM, only this file changes.
 */

"use strict";

const User = require("./auth.model");

class AuthRepository {

  // Find a user by email — used in login and duplicate check
  // select("+password") overrides the select:false on password field
  async findByEmail(email, includePassword = false) {
    const query = User.findOne({ email, deletedAt: null });
    if (includePassword) query.select("+password");
    return query.lean(); // .lean() returns plain JS object, not Mongoose document — faster for reads
  }

  // Find by ID — used in authenticate middleware to load current user
  async findById(id) {
    return User.findOne({ _id: id, deletedAt: null, isActive: true }).lean();
  }

  // Create a new user — used in register
  async create(userData) {
    const user = new User(userData);
    return user.save(); // Returns full Mongoose document (not lean) — we need instance methods
  }

  // Save refresh token hash against user — used after login
  async saveRefreshToken(userId, hashedToken) {
    return User.findByIdAndUpdate(
      userId,
      { refreshToken: hashedToken, lastLoginAt: new Date() },
      { new: true }    // Return the updated document
    );
  }

  // Find by refresh token hash — used in token refresh endpoint
  async findByRefreshToken(hashedToken) {
    return User.findOne({ refreshToken: hashedToken, deletedAt: null })
      .select("+refreshToken")
      .lean();
  }

  // Clear refresh token on logout
  async clearRefreshToken(userId) {
    return User.findByIdAndUpdate(userId, { refreshToken: null });
  }

  // Save password reset token + expiry — used in forgot password
  async savePasswordResetToken(userId, hashedToken, expires) {
    return User.findByIdAndUpdate(userId, {
      passwordResetToken: hashedToken,
      passwordResetExpires: expires,
    });
  }

  // Find user by reset token — used in reset password
  async findByResetToken(hashedToken) {
    return User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }, // Token must not be expired
      deletedAt: null,
    }).select("+password +passwordResetToken +passwordResetExpires");
  }

  // Update password after reset
  async updatePassword(userId, hashedPassword) {
    return User.findByIdAndUpdate(userId, {
      password: hashedPassword,
      passwordResetToken: undefined,   // Clear the reset token — used once only
      passwordResetExpires: undefined,
    });
  }

  // Increment analysis count — called after every successful analysis
  async incrementAnalysisCount(userId) {
    return User.findByIdAndUpdate(userId, { $inc: { totalAnalyses: 1 } });
  }
}

module.exports = new AuthRepository(); // Export singleton instance