/**
 * modules/verification/verification.controller.js
 * Same thin-controller pattern as conversation.controller.js
 */

"use strict";

const verificationService = require("./verification.service");
const ApiResponse = require("../../utils/ApiResponse");
const asyncWrapper = require("../../middlewares/asyncWrapper");

// ─── POST /api/v1/verification ───────────────────────────────────────────────
const verifyCompany = asyncWrapper(async (req, res) => {
  const { text } = req.body;
  const result = await verificationService.verifyCompany(req.user._id, text);
  return ApiResponse.created(res, "Verification complete", result);
});

// ─── GET /api/v1/verification ────────────────────────────────────────────────
const getMyVerifications = asyncWrapper(async (req, res) => {
  const { verifications, pagination } = await verificationService.getUserVerifications(
    req.user._id,
    req.query
  );
  return ApiResponse.ok(res, "Verifications fetched", verifications, pagination);
});

// ─── GET /api/v1/verification/:id ────────────────────────────────────────────
const getVerificationById = asyncWrapper(async (req, res) => {
  const record = await verificationService.getVerificationById(req.params.id, req.user._id);
  return ApiResponse.ok(res, "Verification fetched", record);
});

// ─── DELETE /api/v1/verification/:id ─────────────────────────────────────────
const deleteVerification = asyncWrapper(async (req, res) => {
  await verificationService.deleteVerification(req.params.id, req.user._id);
  return ApiResponse.ok(res, "Verification deleted successfully");
});

module.exports = {
  verifyCompany,
  getMyVerifications,
  getVerificationById,
  deleteVerification,
};