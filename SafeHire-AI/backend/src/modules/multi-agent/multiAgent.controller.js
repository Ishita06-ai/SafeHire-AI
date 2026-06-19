/**
 * modules/multi-agent/multiAgent.controller.js
 */

"use strict";

const multiAgentService = require("../../services/multiAgentVerification.service");
const ApiResponse = require("../../utils/ApiResponse");
const asyncWrapper = require("../../middlewares/asyncWrapper");

const analyze = asyncWrapper(async (req, res) => {
  const { text } = req.body;
  const report = await multiAgentService.analyze(text);
  return ApiResponse.ok(res, "Multi-agent analysis complete", report);
});

module.exports = { analyze };