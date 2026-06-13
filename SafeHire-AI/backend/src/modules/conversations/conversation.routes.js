/**
 * modules/conversations/conversation.routes.js
 *
 * MIDDLEWARE CHAIN EXPLAINED:
 * Each route has a chain of middleware that runs left to right:
 *
 * authenticate      → verify JWT, load req.user
 * uploadScreenshot  → parse multipart/form-data, load req.file
 * validatePlatform  → check platform field is valid
 * controller        → business logic via service
 *
 * ORDER MATTERS:
 * authenticate must run before controller (needs req.user)
 * uploadScreenshot must run before controller (needs req.file)
 * validation must run after upload (needs req.body populated by multer)
 */

"use strict";

const { Router } = require("express");
const { body, param, validationResult } = require("express-validator");
const conversationController = require("./conversation.controller");
const authenticate = require("../../middlewares/authenticate");
const { uploadScreenshot } = require("../../middlewares/upload.middleware");
const ApiError = require("../../utils/ApiError");

const router = Router();

// ─── Inline validator ─────────────────────────────────────────────────────────
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formatted = errors.array().map((e) => ({ field: e.path, message: e.msg }));
    throw ApiError.badRequest("Validation failed", formatted);
  }
  next();
};

// ─── Validation rules ─────────────────────────────────────────────────────────
const platformValidation = [
  body("platform")
    .notEmpty().withMessage("Platform is required")
    .isIn(["WHATSAPP", "TELEGRAM", "INSTAGRAM", "LINKEDIN", "EMAIL", "OTHER"])
    .withMessage("Invalid platform. Must be WHATSAPP, TELEGRAM, INSTAGRAM, LINKEDIN, EMAIL or OTHER"),
];

const mongoIdValidation = [
  param("id")
    .isMongoId().withMessage("Invalid analysis ID format"),
];

// ─── Routes ───────────────────────────────────────────────────────────────────
// All routes require authentication — no anonymous analysis

// POST — upload screenshot and analyze
// Middleware chain: authenticate → uploadScreenshot → validate → controller
// WHY uploadScreenshot before validate:
// Multer populates req.body from multipart form — validation needs req.body ready
router.post(
  "/",
  authenticate,
  uploadScreenshot,   // Parses multipart, sets req.file + req.body
  platformValidation,
  validate,
  conversationController.analyzeConversation
);

// GET — list all analyses (paginated)
router.get("/", authenticate, conversationController.getMyConversations);

// GET — dashboard stats
router.get("/stats", authenticate, conversationController.getMyStats);

// GET — single analysis by ID
router.get(
  "/:id",
  authenticate,
  mongoIdValidation,
  validate,
  conversationController.getConversationById
);

// DELETE — soft delete analysis
router.delete(
  "/:id",
  authenticate,
  mongoIdValidation,
  validate,
  conversationController.deleteConversation
);

module.exports = router;