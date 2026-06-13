/**
 * middlewares/errorHandler.js — Global error handler
 *
 * WHY THIS EXISTS:
 * This is the single place in the entire app that converts errors into
 * HTTP responses. No controller or service ever calls res.status() for errors.
 * They just throw — this middleware catches everything.
 *
 * HOW EXPRESS ERROR HANDLERS WORK:
 * A normal middleware has 3 params: (req, res, next)
 * An error handler has 4 params: (err, req, res, next)
 * Express knows it's an error handler BECAUSE it has exactly 4 params.
 * It only runs when next(err) is called or asyncWrapper catches a throw.
 *
 * MUST be registered LAST in app.js — after all routes.
 * Express processes middleware in order. If it's registered before routes,
 * errors from routes won't reach it.
 */

"use strict";

const ApiError = require("../utils/ApiError");
const logger = require("../utils/logger");

/**
 * Global error handler middleware
 * Handles all error types and normalizes them into a consistent response shape
 */
const errorHandler = (err, req, res, next) => {
  // Log every error with context — critical for debugging production issues
  logger.error(`[${req.method}] ${req.path} — ${err.message}`, {
    statusCode: err.statusCode,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    userId: req.user?.id,     // If authenticated, log which user hit the error
    ip: req.ip,
  });

  // ── Case 1: Our own ApiError — already has statusCode and message ──────────
  // This is the happy path — we threw this intentionally with a clear message
 if (err && err.statusCode && err.success === false) {
    return res.status(err.statusCode).json({
      success: false,
      statusCode: err.statusCode,
      message: err.message,
      errors: err.errors,       // Validation error details if any
    });
  }

  // ── Case 2: Mongoose Validation Error ─────────────────────────────────────
  // Happens when you try to save a document that fails schema validation
  // e.g. saving a User without required `email` field
  if (err.name === "ValidationError") {
    const errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: "Validation failed",
      errors,
    });
  }

  // ── Case 3: Mongoose Duplicate Key Error ──────────────────────────────────
  // Happens when you try to insert a document with a duplicate unique field
  // e.g. registering with an email that already exists
  // MongoDB error code 11000 = duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0]; // e.g. "email"
    return res.status(409).json({
      success: false,
      statusCode: 409,
      message: `${field} already exists`,
      errors: [{ field, message: `This ${field} is already registered` }],
    });
  }

  // ── Case 4: Mongoose CastError ────────────────────────────────────────────
  // Happens when an invalid MongoDB ObjectId is passed in a URL param
  // e.g. GET /api/v1/users/not-a-valid-id
  if (err.name === "CastError") {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: `Invalid ${err.path}: ${err.value}`,
      errors: [],
    });
  }

  // ── Case 5: JWT Errors ────────────────────────────────────────────────────
  // JsonWebTokenError = token is malformed or signature is invalid
  // TokenExpiredError = token was valid but has expired
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      success: false,
      statusCode: 401,
      message: "Invalid token. Please log in again.",
      errors: [],
    });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      success: false,
      statusCode: 401,
      message: "Token expired. Please log in again.",
      errors: [],
    });
  }

  // ── Case 6: Multer file upload errors ─────────────────────────────────────
  // Multer is the file upload middleware — it throws specific errors
  // when files are too large or wrong type
  if (err.name === "MulterError") {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "File too large. Maximum size allowed is 10MB."
        : "File upload error.";
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message,
      errors: [],
    });
  }

  // ── Case 7: Unknown / Unexpected errors ───────────────────────────────────
  // Something crashed that we didn't anticipate.
  // NEVER expose the real error message in production — it could leak
  // implementation details (file paths, DB structure, library versions).
  // In development, show the real message to help debugging.
  const statusCode = err.statusCode || 500;
  const message =
    process.env.NODE_ENV === "production"
      ? "Something went wrong. Please try again later."
      : err.message;

  return res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    errors: [],
    // Only include stack trace in development
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

// ─── 404 Handler ──────────────────────────────────────────────────────────────
// If a request reaches here, no route matched it.
// Registered in app.js AFTER all routes but BEFORE errorHandler.
const notFoundHandler = (req, res, next) => {
  const err = ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`);
  next(err); // Pass to errorHandler above
};

module.exports = { errorHandler, notFoundHandler };