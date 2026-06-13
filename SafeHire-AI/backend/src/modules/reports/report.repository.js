/**
 * modules/reports/report.repository.js — DB queries for reports
 */
"use strict";

const { Report, ThreatEntity } = require("./report.model");

const VERIFICATION_THRESHOLD = 3; // Auto-verify after this many reports

class ReportRepository {

  // Create a new report
  async createReport(data) {
    const report = new Report(data);
    return report.save();
  }

  // Find existing ThreatEntity by value (normalized)
  async findThreatByValue(entityValue) {
    return ThreatEntity.findOne({ entityValue: entityValue.toLowerCase().trim() });
  }

  // Create new ThreatEntity
  async createThreatEntity(data) {
    const entity = new ThreatEntity({
      ...data,
      entityValue: data.entityValue.toLowerCase().trim(),
    });
    return entity.save();
  }

  // Increment report count + auto-verify if threshold reached
  // $inc is atomic — safe for concurrent requests
  async incrementReportCount(threatEntityId, scamType) {
    const updated = await ThreatEntity.findByIdAndUpdate(
      threatEntityId,
      {
        $inc: { reportCount: 1 },
        primaryScamType: scamType,
      },
      { new: true }
    );

    // Auto-verify if threshold reached
    if (updated.reportCount >= VERIFICATION_THRESHOLD && !updated.isVerified) {
      await ThreatEntity.findByIdAndUpdate(threatEntityId, {
        isVerified: true,
        severityLevel: this._calculateSeverity(updated.reportCount),
      });
    }

    return updated;
  }

  // Toggle upvote — add if not upvoted, remove if already upvoted
  async toggleUpvote(threatEntityId, userId) {
    const entity = await ThreatEntity.findById(threatEntityId).select("+upvotedBy");

    const alreadyUpvoted = entity.upvotedBy.includes(userId);

    if (alreadyUpvoted) {
      // Remove upvote
      return ThreatEntity.findByIdAndUpdate(
        threatEntityId,
        { $pull: { upvotedBy: userId }, $inc: { upvotes: -1 } },
        { new: true }
      );
    } else {
      // Add upvote
      return ThreatEntity.findByIdAndUpdate(
        threatEntityId,
        { $addToSet: { upvotedBy: userId }, $inc: { upvotes: 1 } },
        { new: true }
      );
    }
  }

  // Search threats — uses MongoDB text index
  async searchThreats(query, filters = {}, pagination = {}) {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    // Build filter object
    const matchQuery = {};
    if (filters.entityType) matchQuery.entityType = filters.entityType;
    if (filters.isVerified !== undefined) matchQuery.isVerified = filters.isVerified;
    if (filters.severityLevel) matchQuery.severityLevel = filters.severityLevel;

    // Text search if query provided, otherwise return all sorted by reportCount
    if (query) {
      matchQuery.$text = { $search: query };
    }

    const [data, total] = await Promise.all([
      ThreatEntity.find(matchQuery)
        .sort(query ? { score: { $meta: "textScore" } } : { reportCount: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ThreatEntity.countDocuments(matchQuery),
    ]);

    return { data, total };
  }

  // Get all reports by a user
  async getUserReports(userId, pagination = {}) {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      Report.find({ reportedBy: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("threatEntity", "reportCount isVerified severityLevel")
        .lean(),
      Report.countDocuments({ reportedBy: userId }),
    ]);

    return { data, total };
  }

  // Admin: get pending reports for moderation
  async getPendingReports(pagination = {}) {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      Report.find({ moderationStatus: "PENDING" })
        .sort({ createdAt: 1 }) // Oldest first — review in order
        .skip(skip)
        .limit(limit)
        .populate("reportedBy", "fullName email college")
        .lean(),
      Report.countDocuments({ moderationStatus: "PENDING" }),
    ]);

    return { data, total };
  }

  // Admin: approve or reject a report
  async moderateReport(reportId, status, note) {
    return Report.findByIdAndUpdate(
      reportId,
      { moderationStatus: status, moderationNote: note },
      { new: true }
    );
  }

  _calculateSeverity(reportCount) {
    if (reportCount >= 20) return "CRITICAL";
    if (reportCount >= 10) return "HIGH";
    if (reportCount >= 5) return "MEDIUM";
    return "LOW";
  }
}

module.exports = new ReportRepository();