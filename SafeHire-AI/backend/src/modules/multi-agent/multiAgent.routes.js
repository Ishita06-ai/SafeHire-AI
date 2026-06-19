/**
 * modules/multi-agent/multiAgent.routes.js
 */

"use strict";

const { Router } = require("express");
const { body, validationResult } = require("express-validator");
const multiAgentController = require("./multiAgent.controller");
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
    .withMessage("Please paste the offer text")
    .isLength({ min: 3, max: 8000 })
    .withMessage("Text must be between 3 and 8000 characters"),
];

// POST — run the full 4-agent pipeline on pasted offer text
router.post("/", authenticate, textValidation, validate, multiAgentController.analyze);

module.exports = router;