/**
 * modules/reports/report.routes.js
 */
"use strict";

const { Router } = require("express");
const { body, query, param, validationResult } = require("express-validator");
const asyncWrapper = require("../../middlewares/asyncWrapper");
const authenticate = require("../../middlewares/authenticate");
const authorize = require("../../middlewares/authorize");
const reportService = require("./report.service");
const ApiResponse = require("../../utils/ApiResponse");
const ApiError = require("../../utils/ApiError");

const router = Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw ApiError.badRequest("Validation failed",
      errors.array().map((e) => ({ field: e.path, message: e.msg }))
    );
  }
  next();
};

// POST /api/v1/reports — submit a report
router.post(
  "/",
  authenticate,
  [
    body("entityType").isIn(["PHONE","EMAIL","COMPANY","WEBSITE","RECRUITER"])
      .withMessage("Invalid entity type"),
    body("entityValue").trim().notEmpty().withMessage("Entity value required"),
    body("scamType").isIn([
      "FAKE_JOB_OFFER","ADVANCE_FEE_FRAUD","IDENTITY_THEFT",
      "PHISHING","FAKE_INTERNSHIP","FAKE_SCHOLARSHIP","IMPERSONATION","OTHER",
    ]).withMessage("Invalid scam type"),
    body("description").trim().isLength({ min: 20 })
      .withMessage("Description must be at least 20 characters"),
  ],
  validate,
  asyncWrapper(async (req, res) => {
    const report = await reportService.submitReport(req.user._id, req.body);
    return ApiResponse.created(res, "Report submitted for review", report);
  })
);

// GET /api/v1/reports/threats — search threat database (public)
router.get(
  "/threats",
  asyncWrapper(async (req, res) => {
    const { q, entityType, isVerified, severityLevel, page = 1, limit = 20 } = req.query;
    const filters = {};
    if (entityType) filters.entityType = entityType;
    if (isVerified !== undefined) filters.isVerified = isVerified === "true";
    if (severityLevel) filters.severityLevel = severityLevel;

    const result = await reportService.searchThreats(q, filters, {
      page: parseInt(page),
      limit: parseInt(limit),
    });
    return ApiResponse.ok(res, "Threats fetched", result.threats, result.pagination);
  })
);

// POST /api/v1/reports/threats/:id/upvote — upvote a threat
router.post(
  "/threats/:id/upvote",
  authenticate,
  asyncWrapper(async (req, res) => {
    const updated = await reportService.toggleUpvote(req.params.id, req.user._id);
    return ApiResponse.ok(res, "Upvote toggled", { upvotes: updated.upvotes });
  })
);

// GET /api/v1/reports/my — get current user's reports
router.get("/my", authenticate, asyncWrapper(async (req, res) => {
  const result = await reportService.getMyReports(req.user._id, req.query);
  return ApiResponse.ok(res, "Reports fetched", result.reports, result.pagination);
}));

// Admin routes
router.get(
  "/admin/pending",
  authenticate,
  authorize("admin"),
  asyncWrapper(async (req, res) => {
    const result = await reportService.getPendingReports(req.query);
    return ApiResponse.ok(res, "Pending reports", result.reports, result.pagination);
  })
);

router.patch(
  "/admin/:id/moderate",
  authenticate,
  authorize("admin"),
  [
    body("status").isIn(["APPROVED", "REJECTED"]).withMessage("Status must be APPROVED or REJECTED"),
    body("note").optional().trim(),
  ],
  validate,
  asyncWrapper(async (req, res) => {
    const report = await reportService.moderateReport(
      req.params.id, req.body.status, req.body.note, req.user._id
    );
    return ApiResponse.ok(res, "Report moderated", report);
  })
);

module.exports = router;