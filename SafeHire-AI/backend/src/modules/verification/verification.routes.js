/**
 * modules/verification/verification.routes.js
 * Same validation + middleware chain pattern as conversation.routes.js
 */

"use strict";

const { Router } = require("express");
const { body, param, validationResult } = require("express-validator");
const verificationController = require("./verification.controller");
const authenticate = require("../../middlewares/authenticate");
const ApiError = require("../../utils/ApiError");

const router = Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formatted = errors.array().map((e) => ({ field: e.path, message: e.msg }));
    throw ApiError.badRequest("Validation failed", formatted);
  }
  next();
};

const textValidation = [
  body("text")
    .trim()
    .notEmpty()
    .withMessage("Please paste the offer text or company details")
    .isLength({ min: 3, max: 8000 })
    .withMessage("Text must be between 3 and 8000 characters"),
];

const mongoIdValidation = [param("id").isMongoId().withMessage("Invalid verification ID format")];

// POST — extract + verify company details from pasted text
router.post("/", authenticate, textValidation, validate, verificationController.verifyCompany);

// GET — list all verifications for the logged-in user (paginated)
router.get("/", authenticate, verificationController.getMyVerifications);

// GET — single verification by ID
router.get(
  "/:id",
  authenticate,
  mongoIdValidation,
  validate,
  verificationController.getVerificationById
);

// DELETE — soft delete
router.delete(
  "/:id",
  authenticate,
  mongoIdValidation,
  validate,
  verificationController.deleteVerification
);

module.exports = router;