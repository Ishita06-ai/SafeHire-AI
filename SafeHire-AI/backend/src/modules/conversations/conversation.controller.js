/**
 * modules/conversations/conversation.controller.js
 *
 * RESPONSIBILITIES (only these, nothing more):
 * - Extract data from req (body, params, query, file)
 * - Call conversation service
 * - Send response with ApiResponse
 *
 * req.file  → set by uploadScreenshot middleware (Multer)
 * req.user  → set by authenticate middleware (JWT)
 */

"use strict";

const conversationService = require("./conversation.service");
const ApiResponse = require("../../utils/ApiResponse");
const asyncWrapper = require("../../middlewares/asyncWrapper");

// ─── POST /api/v1/analysis/conversation ──────────────────────────────────────
// Upload screenshot + trigger AI analysis
const analyzeConversation = asyncWrapper(async (req, res) => {
  const { platform } = req.body;

  // req.file populated by Multer uploadScreenshot middleware
  // req.user populated by authenticate middleware
  const result = await conversationService.createAndAnalyze(
    req.user._id,
    req.file,
    platform
  );

  return ApiResponse.created(res, "Analysis complete", result);
});

// ─── GET /api/v1/analysis/conversation ───────────────────────────────────────
// List all analyses for the logged-in user (paginated + filtered)
const getMyConversations = asyncWrapper(async (req, res) => {
  // req.query = { page, limit, riskLevel, platform, status, sortBy, sortOrder }
  const { conversations, pagination } = await conversationService.getUserConversations(
    req.user._id,
    req.query
  );

  return ApiResponse.ok(res, "Analyses fetched", conversations, pagination);
});

// ─── GET /api/v1/analysis/conversation/:id ────────────────────────────────────
// Get single analysis with full details (including indicators + extracted text)
const getConversationById = asyncWrapper(async (req, res) => {
  const conversation = await conversationService.getConversationById(
    req.params.id,
    req.user._id
  );

  return ApiResponse.ok(res, "Analysis fetched", conversation);
});

// ─── DELETE /api/v1/analysis/conversation/:id ─────────────────────────────────
// Soft delete — removes from user's view, deletes Cloudinary file
const deleteConversation = asyncWrapper(async (req, res) => {
  await conversationService.deleteConversation(req.params.id, req.user._id);
  return ApiResponse.ok(res, "Analysis deleted successfully");
});

// ─── GET /api/v1/analysis/stats ───────────────────────────────────────────────
// Dashboard stats — total, by risk level, by platform, avg score
const getMyStats = asyncWrapper(async (req, res) => {
  const stats = await conversationService.getUserStats(req.user._id);
  return ApiResponse.ok(res, "Stats fetched", stats);
});

module.exports = {
  analyzeConversation,
  getMyConversations,
  getConversationById,
  deleteConversation,
  getMyStats,
};