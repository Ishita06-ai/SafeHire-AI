/**
 * modules/auth/auth.routes.js — Auth route definitions
 *
 * WHY THIS EXISTS:
 * Maps HTTP method + URL to the right controller function.
 * Also applies request validation before the controller runs.
 *
 * VALIDATION LAYER:
 * We validate request body HERE using express-validator.
 * If validation fails → return 400 immediately, controller never runs.
 * This keeps controllers clean — they trust that req.body is valid.
 *
 * ROUTE NAMING CONVENTION (REST):
 * POST   /auth/register         → create account
 * POST   /auth/login            → create session
 * POST   /auth/refresh          → refresh access token
 * POST   /auth/logout           → destroy session
 * POST   /auth/forgot-password  → request reset link
 * PATCH  /auth/reset-password/:token → apply new password
 * GET    /auth/me               → get current user (protected)
 */

"use strict";

const { Router } = require("express");
const { body, validationResult } = require("express-validator");
const authController = require("./auth.controller");
const authenticate = require("../../middlewares/authenticate");
const ApiError = require("../../utils/ApiError");

const router = Router();

// ─── Validation middleware factory ────────────────────────────────────────────
// Reusable function that runs after express-validator checks.
// If any check failed, it collects all errors and throws ApiError immediately.
// Controller only runs if ALL validations pass.
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Map errors to { field, message } shape matching our ApiError.errors format
    const formattedErrors = errors.array().map((err) => ({
      field: err.path,
      message: err.msg,
    }));
    throw ApiError.badRequest("Validation failed", formattedErrors);
  }
  next();
};

// ─── Validation rule sets ─────────────────────────────────────────────────────
// Arrays of express-validator checks for each route.
// Each check validates one field — chain methods describe the rules.

const registerValidation = [
  body("fullName")
    .trim()
    .notEmpty().withMessage("Full name is required")
    .isLength({ min: 2, max: 50 }).withMessage("Name must be 2-50 characters"),

  body("email")
    .trim()
    .notEmpty().withMessage("Email is required")
    .isEmail().withMessage("Enter a valid email")
    .normalizeEmail(), // Lowercase + remove dots from Gmail addresses

  body("password")
    .notEmpty().withMessage("Password is required")
    .isLength({ min: 8 }).withMessage("Password must be at least 8 characters")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage("Password must contain uppercase, lowercase and a number"),

  body("college")
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage("College name too long"),

  body("phone")
    .optional()
    .trim()
    .matches(/^[+]?[0-9]{10,15}$/).withMessage("Enter a valid phone number"),
];

const loginValidation = [
  body("email")
    .trim()
    .notEmpty().withMessage("Email is required")
    .isEmail().withMessage("Enter a valid email")
    .normalizeEmail(),

  body("password")
    .notEmpty().withMessage("Password is required"),
];

const forgotPasswordValidation = [
  body("email")
    .trim()
    .notEmpty().withMessage("Email is required")
    .isEmail().withMessage("Enter a valid email")
    .normalizeEmail(),
];

const resetPasswordValidation = [
  body("password")
    .notEmpty().withMessage("New password is required")
    .isLength({ min: 8 }).withMessage("Password must be at least 8 characters")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage("Password must contain uppercase, lowercase and a number"),
];

// ─── Routes ───────────────────────────────────────────────────────────────────
// Pattern: [validationRules], validate, controller
// Validation runs first — if it fails, controller never executes

// Public routes — no authentication needed
router.post("/register",        registerValidation,        validate, authController.register);
router.post("/login",           loginValidation,           validate, authController.login);
router.post("/refresh",                                              authController.refreshToken);
router.post("/forgot-password", forgotPasswordValidation,  validate, authController.forgotPassword);
router.patch("/reset-password/:token", resetPasswordValidation, validate, authController.resetPassword);

// Protected routes — authenticate middleware verifies JWT first
router.post("/logout", authenticate, authController.logout);
router.get("/me",      authenticate, authController.getMe);

module.exports = router;