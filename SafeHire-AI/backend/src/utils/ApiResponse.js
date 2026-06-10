/**
 * utils/ApiResponse.js — Standardized success response class
 *
 * WHY THIS EXISTS:
 * Every successful API response should have the same shape.
 * Instead of every controller calling res.json() with its own structure,
 * they all use this class — guaranteeing a consistent envelope.
 *
 * RESPONSE ENVELOPE PATTERN:
 * Every response (success or error) is wrapped in a consistent outer shape.
 * The frontend always knows: check `success`, read `message`, get data from `data`.
 *
 * SUCCESS shape:
 * {
 *   success: true,
 *   statusCode: 200,
 *   message: "Login successful",
 *   data: { user: {...}, token: "..." }
 * }
 *
 * With pagination:
 * {
 *   success: true,
 *   statusCode: 200,
 *   message: "Reports fetched",
 *   data: [...],
 *   pagination: { total: 100, page: 2, limit: 10, totalPages: 10 }
 * }
 */

"use strict";

class ApiResponse {
  /**
   * @param {number} statusCode  - HTTP status code (200, 201, 204...)
   * @param {string} message     - Human-readable success message
   * @param {*}      data        - The actual payload (object, array, null)
   * @param {object} pagination  - Optional pagination metadata
   */
  constructor(statusCode, message, data = null, pagination = null) {
    this.success = statusCode < 400; // true for 2xx/3xx, false for 4xx/5xx
    this.statusCode = statusCode;
    this.message = message;

    // Only include `data` key if there's actual data to send
    // Avoids sending `"data": null` on responses like logout
    if (data !== null && data !== undefined) {
      this.data = data;
    }

    // Only include pagination if provided
    // Pagination shape: { total, page, limit, totalPages, hasNextPage, hasPrevPage }
    if (pagination) {
      this.pagination = pagination;
    }
  }

  // ─── Send the response ──────────────────────────────────────────────────────
  // Usage in a controller:
  //   return new ApiResponse(200, "User fetched", user).send(res);
  send(res) {
    return res.status(this.statusCode).json(this);
  }
}

// ─── Static factory methods ───────────────────────────────────────────────────
// Pre-built responses for the most common cases.
// Keeps controller code clean and readable.

ApiResponse.ok = (res, message, data, pagination) =>
  new ApiResponse(200, message, data, pagination).send(res);

ApiResponse.created = (res, message, data) =>
  new ApiResponse(201, message, data).send(res);

ApiResponse.noContent = (res, message = "Deleted successfully") =>
  new ApiResponse(204, message).send(res);

module.exports = ApiResponse;