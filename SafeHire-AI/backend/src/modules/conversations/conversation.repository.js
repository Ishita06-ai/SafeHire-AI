/**
 * modules/conversations/conversation.repository.js
 *
 * WHY THIS FILE EXISTS:
 * All MongoDB queries for conversations in one place.
 * Service layer never writes Mongoose syntax — only calls these methods.
 *
 * KEY CONCEPTS HERE:
 * - Pagination with skip/limit
 * - Dynamic filter building
 * - MongoDB aggregation pipeline for stats
 * - Soft delete filtering on every query
 */

"use strict";

const Conversation = require("./conversation.model");

class ConversationRepository {

  // Create a new conversation record (status: PENDING initially)
  async create(data) {
    const conversation = new Conversation(data);
    return conversation.save();
  }

  // Find a single conversation by ID (excluding soft-deleted)
  async findById(id) {
    return Conversation.findOne({ _id: id, deletedAt: null });
  }

  // Update status field — called as analysis progresses
  // PENDING → PROCESSING → COMPLETED or FAILED
  async updateStatus(id, status, failureReason = null) {
    const update = { status };
    if (failureReason) update.failureReason = failureReason;
    return Conversation.findByIdAndUpdate(id, update, { new: true });
  }

  // Save full AI analysis results — called when AI pipeline completes
  async saveAnalysisResult(id, resultData) {
    return Conversation.findByIdAndUpdate(
      id,
      { $set: resultData },  // $set updates only specified fields, leaves others untouched
      { new: true }          // Return the updated document
    );
  }

  // ─── Paginated list for user dashboard ──────────────────────────────────────
  // Returns { data: [...], total: number }
  // total is needed by frontend to calculate totalPages
  async findByUser(userId, filters = {}, pagination = {}) {
    const { page = 1, limit = 10, sortBy = "createdAt", sortOrder = "desc" } = pagination;

    // Build query — always exclude soft-deleted records
    const query = {
      user: userId,
      deletedAt: null,
      ...filters,  // Spread any additional filters (riskLevel, platform, status)
    };

    const sortDirection = sortOrder === "desc" ? -1 : 1;
    const skip = (page - 1) * limit; // Page 1 → skip 0, Page 2 → skip 10, etc.

    // Run both queries in PARALLEL using Promise.all
    // WHY PARALLEL: count and find are independent — no need to wait for one before the other
    // Sequential: 200ms + 200ms = 400ms total
    // Parallel:   max(200ms, 200ms) = 200ms total — twice as fast
    const [data, total] = await Promise.all([
      Conversation.find(query)
        .sort({ [sortBy]: sortDirection })  // Dynamic sort field
        .skip(skip)
        .limit(limit)
        .select("-extractedText") // Exclude large text field from list view — only in detail view
        .lean(),                  // Plain JS objects — faster for read-only operations

      Conversation.countDocuments(query),   // Total count for pagination
    ]);

    return { data, total };
  }

  // Soft delete — sets deletedAt instead of removing document
  async softDelete(id) {
    return Conversation.findByIdAndUpdate(id, { deletedAt: new Date() });
  }

  // ─── Aggregation pipeline for user dashboard stats ───────────────────────────
  // Returns: { total, byRiskLevel: {...}, byPlatform: {...}, avgRiskScore }
  //
  // WHY AGGREGATION instead of multiple queries:
  // One DB round trip vs 4 separate queries.
  // MongoDB processes everything server-side — less data transferred.
  async getUserStats(userId) {
    const mongoose = require("mongoose");

    const result = await Conversation.aggregate([

      // ── Stage 1: Filter ──────────────────────────────────────────────────
      // $match = filter documents (like SQL WHERE)
      // Only this user's completed, non-deleted analyses
      {
        $match: {
          user: new mongoose.Types.ObjectId(userId),
          status: "COMPLETED",
          deletedAt: null,
        },
      },

      // ── Stage 2: Group and count ─────────────────────────────────────────
      // $facet runs multiple aggregation pipelines simultaneously
      // Each named pipeline produces its own result array
      // Think of it as running 4 queries at once on the already-filtered set
      {
        $facet: {

          // Total count of all completed analyses
          totalCount: [{ $count: "count" }],

          // Count grouped by riskLevel
          // e.g. { LOW: 5, MEDIUM: 3, HIGH: 2, CRITICAL: 1 }
          byRiskLevel: [
            {
              $group: {
                _id: "$riskLevel",       // Group by this field
                count: { $sum: 1 },      // Count documents in each group
              },
            },
          ],

          // Count grouped by platform
          // e.g. { WHATSAPP: 6, LINKEDIN: 4, EMAIL: 1 }
          byPlatform: [
            {
              $group: {
                _id: "$platform",
                count: { $sum: 1 },
              },
            },
          ],

          // Average risk score across all analyses
          avgRiskScore: [
            {
              $group: {
                _id: null,                           // null = group ALL documents together
                avg: { $avg: "$riskScore" },
                max: { $max: "$riskScore" },         // Highest risk score ever
              },
            },
          ],

          // Most recent 3 analyses for "recent activity" widget
          recentAnalyses: [
            { $sort: { createdAt: -1 } },
            { $limit: 3 },
            { $project: { riskLevel: 1, platform: 1, createdAt: 1, riskScore: 1 } },
          ],
        },
      },
    ]);

    // ── Transform aggregation output into clean shape ──────────────────────
    // $facet returns arrays — we need to flatten them into a usable object
    const raw = result[0];

    // Convert byRiskLevel array [{ _id: "HIGH", count: 2 }]
    // into object { HIGH: 2, LOW: 5 } for easier frontend consumption
    const byRiskLevel = {};
    (raw.byRiskLevel || []).forEach(({ _id, count }) => {
      if (_id) byRiskLevel[_id] = count;
    });

    const byPlatform = {};
    (raw.byPlatform || []).forEach(({ _id, count }) => {
      if (_id) byPlatform[_id] = count;
    });

    return {
      total: raw.totalCount[0]?.count || 0,
      byRiskLevel,
      byPlatform,
      avgRiskScore: Math.round(raw.avgRiskScore[0]?.avg || 0),
      maxRiskScore: raw.avgRiskScore[0]?.max || 0,
      recentAnalyses: raw.recentAnalyses || [],
    };
  }

  // ─── Admin: get all analyses across all users (paginated) ────────────────────
  async findAll(filters = {}, pagination = {}) {
    const { page = 1, limit = 20, sortBy = "createdAt", sortOrder = "desc" } = pagination;

    const query = { deletedAt: null, ...filters };
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      Conversation.find(query)
        .sort({ [sortBy]: sortOrder === "desc" ? -1 : 1 })
        .skip(skip)
        .limit(limit)
        .populate("user", "fullName email college") // Join user data
        .select("-extractedText")
        .lean(),
      Conversation.countDocuments(query),
    ]);

    return { data, total };
  }
}

module.exports = new ConversationRepository();