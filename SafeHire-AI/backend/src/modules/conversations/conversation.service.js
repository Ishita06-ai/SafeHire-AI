"use strict";

const conversationRepository = require("./conversation.repository");
const aiAnalysisService = require("../../services/aiAnalysis.service");
const cloudinaryService = require("../../services/cloudinary.service");
const authRepository = require("../auth/auth.repository");
const ApiError = require("../../utils/ApiError");
const logger = require("../../utils/logger");

class ConversationService {

  // ─── Create and analyze a conversation ──────────────────────────────────────
  // Called by controller after file upload middleware runs
  // req.file = the uploaded file buffer (from multer memory storage)
  async createAndAnalyze(userId, file, platform) {

    // ── Validate file ──────────────────────────────────────────────────────
    if (!file) throw ApiError.badRequest("Screenshot file is required");

    const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw ApiError.badRequest("Only JPEG, PNG, WEBP and GIF images are allowed");
    }

    // Max 10MB
    if (file.size > 10 * 1024 * 1024) {
      throw ApiError.badRequest("File size must be under 10MB");
    }

    // ── Step 1: Upload to Cloudinary ───────────────────────────────────────
    // Upload BEFORE creating DB record — if upload fails, nothing to clean up
    logger.info("Uploading screenshot to Cloudinary", { userId, platform });

    const uploaded = await cloudinaryService.uploadBuffer(file.buffer, {
      folder: `safehire/conversations/${userId}`, // Organized by user
      allowedFormats: ["jpg", "jpeg", "png", "webp", "gif"],
      // Auto-optimize image quality for web viewing
      transformation: [{ quality: "auto", fetch_format: "auto" }],
    });

    // ── Step 2: Create DB record with PENDING status ───────────────────────
    // We create the record immediately so:
    // - User gets an analysisId right away
    // - Frontend can start polling status
    // - If AI crashes, record still exists with FAILED status
    const conversation = await conversationRepository.create({
      user: userId,
      platform,
      fileUrl: uploaded.url,
      filePublicId: uploaded.publicId,
      status: "PENDING",
    });

    logger.info("Conversation record created", { conversationId: conversation._id });

    // ── Step 3: Run AI analysis ────────────────────────────────────────────
    // WHY NOT async/background job here?
    // For MVP — we run it synchronously and the frontend polls.
    // For scale — move this to a job queue (Bull/BullMQ) so the HTTP request
    // returns immediately and a worker processes the job separately.
    try {
      // Update status to PROCESSING
      await conversationRepository.updateStatus(conversation._id, "PROCESSING");

      // Run the full OCR → Claude pipeline
      const analysisResult = await aiAnalysisService.analyzeConversation(
        file.buffer,  // Pass original buffer — not the Cloudinary URL (saves bandwidth)
        platform
      );

      // ── Step 4: Save results to DB ───────────────────────────────────────
      const updatedConversation = await conversationRepository.saveAnalysisResult(
        conversation._id,
        {
          status: "COMPLETED",
          extractedText: analysisResult.extractedText,
          riskLevel: analysisResult.riskLevel,
          riskScore: analysisResult.riskScore,
          indicators: analysisResult.indicators,
          explanation: analysisResult.explanation,
          recommendations: analysisResult.recommendations,
          processingTimeMs: analysisResult.processingTimeMs,
        }
      );

      // ── Step 5: Increment user's analysis count ──────────────────────────
      // Denormalized counter — avoids COUNT query on every dashboard load
      await authRepository.incrementAnalysisCount(userId);

      logger.info("Analysis saved successfully", {
        conversationId: conversation._id,
        riskLevel: analysisResult.riskLevel,
      });

      return updatedConversation;

    } catch (err) {
      // AI failed — mark record as FAILED so user sees retry option
      // Don't delete Cloudinary file — user might retry
      await conversationRepository.updateStatus(
        conversation._id,
        "FAILED",
        err.message
      );

      logger.error("Analysis failed, marked as FAILED", {
        conversationId: conversation._id,
        error: err.message,
      });

      throw ApiError.internal("Analysis failed. Please try again.");
    }
  }

  // ─── Get all conversations for a user (paginated) ───────────────────────────
  async getUserConversations(userId, query) {
    const {
      page = 1,
      limit = 10,
      riskLevel,    // Filter by risk level
      platform,     // Filter by platform
      status,       // Filter by status
      sortBy = "createdAt",
      sortOrder = "desc",
    } = query;

    // Convert to numbers — query params come as strings
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit))); // Cap at 50 per page

    // Build filter object — only include filters that were provided
    const filters = {};
    if (riskLevel) filters.riskLevel = riskLevel.toUpperCase();
    if (platform) filters.platform = platform.toUpperCase();
    if (status) filters.status = status.toUpperCase();

    const result = await conversationRepository.findByUser(
      userId,
      filters,
      { page: pageNum, limit: limitNum, sortBy, sortOrder }
    );

    // Build pagination metadata for frontend
    const pagination = {
      total: result.total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(result.total / limitNum),
      hasNextPage: pageNum < Math.ceil(result.total / limitNum),
      hasPrevPage: pageNum > 1,
    };

    return { conversations: result.data, pagination };
  }

  // ─── Get single conversation by ID ──────────────────────────────────────────
  async getConversationById(conversationId, userId) {
    const conversation = await conversationRepository.findById(conversationId);

    if (!conversation) {
      throw ApiError.notFound("Analysis not found");
    }

    // Security check: users can only view their own analyses
    // Admins bypass this (checked in controller via role)
    if (conversation.user.toString() !== userId.toString()) {
      throw ApiError.forbidden("You do not have access to this analysis");
    }

    return conversation;
  }

  // ─── Delete a conversation ───────────────────────────────────────────────────
  async deleteConversation(conversationId, userId) {
    const conversation = await conversationRepository.findById(conversationId);

    if (!conversation) throw ApiError.notFound("Analysis not found");

    if (conversation.user.toString() !== userId.toString()) {
      throw ApiError.forbidden("You cannot delete this analysis");
    }

    // Soft delete in DB — keeps record for admin threat intelligence
    await conversationRepository.softDelete(conversationId);

    // Delete file from Cloudinary — user's file, respect their privacy
    if (conversation.filePublicId) {
      await cloudinaryService.deleteFile(conversation.filePublicId);
    }

    logger.info("Conversation soft deleted", { conversationId, userId });
  }

  // ─── Get dashboard stats for a user ─────────────────────────────────────────
  async getUserStats(userId) {
    return conversationRepository.getUserStats(userId);
  }
}

module.exports = new ConversationService();