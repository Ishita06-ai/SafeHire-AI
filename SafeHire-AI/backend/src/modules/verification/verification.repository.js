/**
 * modules/verification/verification.repository.js — DB queries for verification runs
 * Mirrors conversation.repository.js conventions.
 */

"use strict";

const Verification = require("./verification.model");

class VerificationRepository {
  async create(data) {
    const record = new Verification(data);
    return record.save();
  }

  async findById(id) {
    return Verification.findOne({ _id: id, deletedAt: null });
  }

  async updateStatus(id, status, failureReason = null) {
    const update = { status };
    if (failureReason) update.failureReason = failureReason;
    return Verification.findByIdAndUpdate(id, update, { new: true });
  }

  async saveResult(id, resultData) {
    return Verification.findByIdAndUpdate(id, { $set: resultData }, { new: true });
  }

  async findByUser(userId, pagination = {}) {
    const { page = 1, limit = 10, sortBy = "createdAt", sortOrder = "desc" } = pagination;
    const sortDirection = sortOrder === "desc" ? -1 : 1;
    const skip = (page - 1) * limit;

    const query = { user: userId, deletedAt: null };

    const [data, total] = await Promise.all([
      Verification.find(query)
        .sort({ [sortBy]: sortDirection })
        .skip(skip)
        .limit(limit)
        .select("-inputText") // exclude large field from list view
        .lean(),
      Verification.countDocuments(query),
    ]);

    return { data, total };
  }

  async softDelete(id) {
    return Verification.findByIdAndUpdate(id, { deletedAt: new Date() });
  }
}

module.exports = new VerificationRepository();