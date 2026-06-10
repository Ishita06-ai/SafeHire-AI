/**
 * middlewares/authenticate.js — JWT verification middleware
 *
 * WHY THIS EXISTS:
 * Protected routes need to know WHO is making the request.
 * This middleware verifies the access token, loads the user from DB,
 * and attaches them to req.user so controllers can use it.
 *
 * HOW IT WORKS:
 * 1. Extract Bearer token from Authorization header
 * 2. Verify JWT signature + expiry
 * 3. Load user from DB (confirms account still exists and is active)
 * 4. Attach user to req.user → pass to next middleware/controller
 *
 * USAGE:
 * router.get("/me", authenticate, getMe)
 * Any route with `authenticate` in the chain is protected.
 */

"use strict";

const jwt = require("jsonwebtoken");
const ApiError = require("../utils/ApiError");
const asyncWrapper = require("./asyncWrapper");
const authRepository = require("../modules/auth/auth.repository");

const authenticate = asyncWrapper(async (req, res, next) => {

  // ── Step 1: Extract token ──────────────────────────────────────────────────
  // Convention: access token sent in Authorization header as "Bearer <token>"
  // e.g. Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw ApiError.unauthorized("Access token required");
  }

  const token = authHeader.split(" ")[1]; // Get the part after "Bearer "

  // ── Step 2: Verify JWT ─────────────────────────────────────────────────────
  // jwt.verify throws if:
  // - Signature is invalid (token was tampered with)
  // - Token has expired (exp claim is in the past)
  // The errorHandler catches these and returns 401 automatically
  const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
  // decoded = { id: "...", email: "...", role: "...", iat: ..., exp: ... }

  // ── Step 3: Load user from DB ──────────────────────────────────────────────
  // WHY check DB if token is valid?
  // The token could be valid but the account might have been:
  // - Deactivated by admin
  // - Soft deleted
  // - Had password changed (should invalidate old tokens)
  // Checking DB catches all these cases.
  const user = await authRepository.findById(decoded.id);

  if (!user) {
    throw ApiError.unauthorized("User no longer exists");
  }

  if (!user.isActive) {
    throw ApiError.forbidden("Account has been deactivated");
  }

  // ── Step 4: Attach to request ──────────────────────────────────────────────
  // Now any controller or middleware AFTER this can access req.user
  // e.g. req.user.id, req.user.role, req.user.email
  req.user = user;
  next();
});

module.exports = authenticate;