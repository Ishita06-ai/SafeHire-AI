/**
 * modules/auth/auth.controller.js — HTTP layer for auth
 *
 * RULES FOR THIS FILE:
 * ✅ Extract data from req (body, cookies, params)
 * ✅ Call service methods
 * ✅ Set cookies
 * ✅ Send responses using ApiResponse
 * ❌ No business logic
 * ❌ No DB queries
 * ❌ No token generation (that's the service's job)
 */

"use strict";

const authService = require("./auth.service");
const ApiResponse = require("../../utils/ApiResponse");
const asyncWrapper = require("../../middlewares/asyncWrapper");

// ─── Cookie config ────────────────────────────────────────────────────────────
// Centralized cookie options — same config used for set and clear
// httpOnly: true  → JS cannot read this cookie (XSS protection)
// secure: true    → required when sameSite is "none" in modern browsers
// sameSite: "none" → required for cross-origin cookie requests from localhost dev
const isProduction = process.env.NODE_ENV === "production";
const REFRESH_TOKEN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: isProduction ? "strict" : "none",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  path: "/api/v1/auth",             // Cookie only sent to auth routes — not every request
};

// ─── Register ─────────────────────────────────────────────────────────────────
// POST /api/v1/auth/register
const register = asyncWrapper(async (req, res) => {
  const { fullName, email, password, college, phone } = req.body;

  const { user, accessToken, refreshToken } = await authService.register({
    fullName,
    email,
    password,
    college,
    phone,
  });

  // Set refresh token as httpOnly cookie — invisible to JavaScript
  res.cookie("refreshToken", refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);

  return ApiResponse.created(res, "Account created successfully", {
    user,
    accessToken, // Access token goes in response body — frontend stores in memory
  });
});

// ─── Login ────────────────────────────────────────────────────────────────────
// POST /api/v1/auth/login
const login = asyncWrapper(async (req, res) => {
  const { email, password } = req.body;

  const { user, accessToken, refreshToken } = await authService.login(
    email,
    password
  );

  res.cookie("refreshToken", refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);

  return ApiResponse.ok(res, "Login successful", {
    user,
    accessToken,
  });
});

// ─── Refresh Access Token ──────────────────────────────────────────────────────
// POST /api/v1/auth/refresh
// Called automatically by frontend when access token expires (every 15 min)
// The refresh token comes from the httpOnly cookie — req.cookies.refreshToken
const refreshToken = asyncWrapper(async (req, res) => {
  // Cookie-parser makes cookies available on req.cookies
  const incomingRefreshToken = req.cookies?.refreshToken;

  const { accessToken, refreshToken: newRefreshToken } =
    await authService.refreshAccessToken(incomingRefreshToken);

  // Rotate: set the new refresh token cookie, old one is now dead in DB
  res.cookie("refreshToken", newRefreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);

  return ApiResponse.ok(res, "Token refreshed", { accessToken });
});

// ─── Logout ───────────────────────────────────────────────────────────────────
// POST /api/v1/auth/logout
// Protected route — user must be logged in to log out
// req.user is set by authenticate middleware
const logout = asyncWrapper(async (req, res) => {
  await authService.logout(req.user.id);

  // Clear the cookie by setting maxAge to 0
  // Just deleting the cookie client-side isn't enough — we also cleared
  // the token from DB in the service, so it's invalidated server-side too
  res.clearCookie("refreshToken", {
    ...REFRESH_TOKEN_COOKIE_OPTIONS,
    maxAge: 0,
  });

  return ApiResponse.ok(res, "Logged out successfully");
});

// ─── Forgot Password ──────────────────────────────────────────────────────────
// POST /api/v1/auth/forgot-password
const forgotPassword = asyncWrapper(async (req, res) => {
  const { email } = req.body;

  const result = await authService.forgotPassword(email);

  // In development — return the token directly so you can test without email setup
  // In production — service would send an email, we just return the message
  if (process.env.NODE_ENV === "development") {
    return ApiResponse.ok(res, result.message, {
      resetToken: result.resetToken, // Only exposed in dev — remove in production
    });
  }

  return ApiResponse.ok(res, result.message);
});

// ─── Reset Password ───────────────────────────────────────────────────────────
// PATCH /api/v1/auth/reset-password/:token
// :token comes from the URL (email link: /reset-password/abc123...)
const resetPassword = asyncWrapper(async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  await authService.resetPassword(token, password);

  return ApiResponse.ok(res, "Password reset successful. Please log in.");
});

// ─── Get Current User ─────────────────────────────────────────────────────────
// GET /api/v1/auth/me
// Protected route — returns the currently logged-in user's profile
// req.user is populated by authenticate middleware — no DB call needed here
const getMe = asyncWrapper(async (req, res) => {
  return ApiResponse.ok(res, "User profile fetched", req.user);
});

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
  getMe,
};