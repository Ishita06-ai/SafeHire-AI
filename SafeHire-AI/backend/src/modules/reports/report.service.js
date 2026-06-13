/**
 * modules/reports/report.service.js — Report business logic
 */
"use strict";

const reportRepository = require("./report.repository");
const ApiError = require("../../utils/ApiError");
const logger = require("../../utils/logger");

class ReportService {

  // ─── Submit a new report ─────────────────────────────────────────────────────
  async submitReport(userId, reportData) {
    const { entityType, entityValue, scamType, description, evidenceUrl } = reportData;

    // Normalize the value for consistent matching
    const normalizedValue = entityValue.toLowerCase().trim();

    // Check: has this user already reported this entity?
    // The unique compound index on (reportedBy + entityValue) would also catch this,
    // but checking here gives a better error message
    const existingReports = await reportRepository.getUserReports(userId, { limit: 100 });
    const alreadyReported = existingReports.data.some(
      (r) => r.entityValue?.toLowerCase() === normalizedValue
    );

    if (alreadyReported) {
      throw ApiError.conflict("You have already reported this entity");
    }

    // Find or create the ThreatEntity for this value
    let threatEntity = await reportRepository.findThreatByValue(normalizedValue);

    if (!threatEntity) {
      // First report for this entity — create ThreatEntity
      threatEntity = await reportRepository.createThreatEntity({
        entityType,
        entityValue: normalizedValue,
        primaryScamType: scamType,
        summary: description.substring(0, 200), // Use first report as initial summary
      });
      logger.info("New ThreatEntity created", { entityValue: normalizedValue });
    } else {
      // Entity already exists — increment its report count
      await reportRepository.incrementReportCount(threatEntity._id, scamType);
      logger.info("ThreatEntity report count incremented", {
        entityValue: normalizedValue,
        newCount: threatEntity.reportCount + 1,
      });
    }

    // Create the Report document (individual submission)
    const report = await reportRepository.createReport({
      reportedBy: userId,
      entityType,
      entityValue: normalizedValue,
      scamType,
      description,
      evidenceUrl,
      threatEntity: threatEntity._id,
      // Auto-approve if user has good standing (can add trust score logic later)
      // For MVP: all reports start as PENDING for admin review
      moderationStatus: "PENDING",
    });

    logger.info("Report submitted", { reportId: report._id, userId });

    return report;
  }

  // ─── Search threat database ──────────────────────────────────────────────────
  async searchThreats(searchQuery, filters, pagination) {
    const result = await reportRepository.searchThreats(searchQuery, filters, pagination);

    const paginationMeta = {
      total: result.total,
      page: pagination.page || 1,
      limit: pagination.limit || 20,
      totalPages: Math.ceil(result.total / (pagination.limit || 20)),
    };

    return { threats: result.data, pagination: paginationMeta };
  }

  // ─── Upvote a threat entity ──────────────────────────────────────────────────
  async toggleUpvote(threatEntityId, userId) {
    const updated = await reportRepository.toggleUpvote(threatEntityId, userId);
    if (!updated) throw ApiError.notFound("Threat not found");
    return updated;
  }

  // ─── Get user's own reports ──────────────────────────────────────────────────
  async getMyReports(userId, query) {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;

    const result = await reportRepository.getUserReports(userId, { page, limit });

    return {
      reports: result.data,
      pagination: {
        total: result.total,
        page,
        limit,
        totalPages: Math.ceil(result.total / limit),
      },
    };
  }

  // ─── Admin: moderate a report ────────────────────────────────────────────────
  async moderateReport(reportId, status, note, adminId) {
    const report = await reportRepository.moderateReport(reportId, status, note);
    if (!report) throw ApiError.notFound("Report not found");

    logger.info("Report moderated", { reportId, status, adminId });
    return report;
  }

  // ─── Admin: get pending reports ──────────────────────────────────────────────
  async getPendingReports(query) {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 20;

    const result = await reportRepository.getPendingReports({ page, limit });

    return {
      reports: result.data,
      pagination: {
        total: result.total,
        page,
        limit,
        totalPages: Math.ceil(result.total / limit),
      },
    };
  }
}

module.exports = new ReportService();