/**
 * utils/ApiError.js — Custom error class for all API errors
 *
 * USAGE:
 * throw ApiError.notFound("User not found")
 * throw ApiError.badRequest("Validation failed", [{ field: "email", message: "Invalid" }])
 * throw ApiError.unauthorized()
 */

"use strict";

class ApiError extends Error {
  constructor(statusCode, message, errors = [], stack = "") {
    super(message);
    this.statusCode = statusCode;
    this.message    = message;
    this.success    = false;
    this.errors     = errors;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  // ─── Static factory methods (inside class) ────────────────────────────────
  // WHY STATIC: Called on the class itself, not an instance
  // ApiError.notFound() — no need to write "new ApiError(404, ...)" everywhere

  static badRequest(message = "Bad request", errors = []) {
    return new ApiError(400, message, errors);
  }

  static unauthorized(message = "Unauthorized") {
    return new ApiError(401, message);
  }

  static forbidden(message = "Access denied") {
    return new ApiError(403, message);
  }

  static notFound(message = "Resource not found") {
    return new ApiError(404, message);
  }

  static conflict(message = "Conflict") {
    return new ApiError(409, message);
  }

  static tooManyRequests(message = "Too many requests") {
    return new ApiError(429, message);
  }

  static internal(message = "Internal server error") {
    return new ApiError(500, message);
  }
}

module.exports = ApiError;