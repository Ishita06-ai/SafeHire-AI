/**
 * middlewares/authorize.js — Role-Based Access Control (RBAC)
 *
 * WHY THIS EXISTS:
 * Some routes should only be accessible by admins.
 * This middleware checks req.user.role AFTER authenticate has run.
 *
 * USAGE:
 * router.get("/admin/users", authenticate, authorize("admin"), getUsers)
 * router.get("/dashboard",   authenticate, authorize("student", "admin"), getDashboard)
 *
 * authorize() returns a middleware function — this is called a "middleware factory"
 * It's a function that RETURNS a function. This lets you pass roles as arguments.
 */

"use strict";

const ApiError = require("../utils/ApiError");

// authorize is a factory — call it with allowed roles, get a middleware back
// e.g. authorize("admin") → returns a middleware that only lets admins through
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    // authenticate must run before authorize — req.user must exist
    if (!req.user) {
      throw ApiError.unauthorized("Authentication required");
    }

    // Check if the user's role is in the allowed roles list
    if (!allowedRoles.includes(req.user.role)) {
      throw ApiError.forbidden(
        `Role '${req.user.role}' is not allowed to access this resource`
      );
    }

    next();
  };
};

module.exports = authorize;