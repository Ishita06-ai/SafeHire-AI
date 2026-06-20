/**
 * modules/verification/verification.service.js — Company Verification Agent
 *
 * PIPELINE:
 * 1. Gemini extracts company name / website / email / phone / LinkedIn from
 *    the pasted text (aiAnalysis.service.js — never invents missing fields)
 * 2. The backend independently verifies what was found — real DNS lookups,
 *    HTTP reachability, MX records, email-domain matching
 *    (domainVerification.service.js — no AI, no API key required)
 * 3. Results are combined into a checklist + a single weighted Trust Score
 *
 * Every check is tagged VERIFIED (a real technical check) or AI_ASSESSED
 * (Gemini's qualitative judgment) so the UI is never misleading about what
 * was actually confirmed vs. estimated.
 */

"use strict";

const verificationRepository = require("./verification.repository");
const aiAnalysisService = require("../../services/aiAnalysis.service");
const domainVerificationService = require("../../services/domainVerification.service");
const communityReputationService = require("../../services/communityReputation.service");
const ApiError = require("../../utils/ApiError");
const logger = require("../../utils/logger");

// Weights sum to 100 when every check is applicable. Checks that don't apply
// (e.g. no LinkedIn URL given) are excluded from both sides of the ratio —
// see _computeTrustScore — so a missing field doesn't unfairly tank the score.
//
// COMMUNITY_REPUTATION is deliberately weighted lower than the deterministic
// technical checks (website/MX/email-domain) combined. A few negative
// reviews don't make a company a scam, and a fake domain + free-email
// recruiter + upfront payment request are far stronger signals than online
// sentiment — so community opinion supports the score, it doesn't drive it.
const WEIGHTS = {
  WEBSITE_FOUND: 22,
  WEBSITE_SECURE: 8,
  DOMAIN_HAS_MX: 8,
  EMAIL_DOMAIN_MATCH: 17,
  EMAIL_NOT_FREE_PROVIDER: 13,
  LINKEDIN_REACHABLE: 8,
  AI_CONSISTENCY: 9,
  COMMUNITY_REPUTATION: 15,
};

class VerificationService {
  // ─── Run a full verification ────────────────────────────────────────────
  async verifyCompany(userId, inputText) {
    if (!inputText || inputText.trim().length < 3) {
      throw ApiError.badRequest("Please paste the offer text or company details to verify.");
    }

    const record = await verificationRepository.create({
      user: userId,
      inputText: inputText.trim(),
      status: "PENDING",
    });

    try {
      await verificationRepository.updateStatus(record._id, "PROCESSING");
      const startTime = Date.now();

      const extraction = await aiAnalysisService.extractCompanyEntities(inputText);

      const domainToCheck =
        domainVerificationService.normalizeDomain(extraction.website) ||
        domainVerificationService.extractDomainFromEmail(extraction.email);

      const [websiteCheck, mxCheck, linkedinCheck, communityReputation] = await Promise.all([
        domainVerificationService.checkWebsite(domainToCheck),
        domainVerificationService.checkMxRecords(domainToCheck),
        domainVerificationService.checkLinkedinUrl(extraction.linkedinUrl),
        communityReputationService.analyze(extraction.companyName, extraction.roleTitle),
      ]);

      const checks = this._buildChecks({
        extraction,
        websiteCheck,
        mxCheck,
        linkedinCheck,
        domainToCheck,
        communityReputation,
      });
      const trustScore = this._computeTrustScore(checks);

      const updated = await verificationRepository.saveResult(record._id, {
        status: "COMPLETED",
        extracted: {
          companyName: extraction.companyName,
          website: extraction.website,
          websiteSource: extraction.websiteSource || null,
          email: extraction.email,
          phone: extraction.phone,
          recruiterName: extraction.recruiterName,
          linkedinUrl: extraction.linkedinUrl,
          linkedinSource: extraction.linkedinSource || null,
          roleTitle: extraction.roleTitle,
        },
        checks,
        trustScore,
        communityReputation: communityReputation || undefined,
        aiAssessment: {
          consistencyScore: extraction.consistencyScore,
          summary: extraction.consistencyNotes,
          redFlags: extraction.textRedFlags,
        },
        processingTimeMs: Date.now() - startTime,
      });

      logger.info("Company verification complete", { verificationId: record._id, trustScore });
      return updated;
    } catch (err) {
      await verificationRepository.updateStatus(record._id, "FAILED", err.message);
      if (err instanceof ApiError) throw err;
      logger.error("Company verification failed", { error: err.message });
      throw ApiError.internal("Verification failed. Please try again.");
    }
  }

  // ─── Turn raw check results into the checklist the UI renders ──────────────
  _buildChecks({ extraction, websiteCheck, mxCheck, linkedinCheck, domainToCheck, communityReputation }) {
    const checks = [];

    if (!domainToCheck) {
      checks.push({
        id: "WEBSITE_FOUND",
        label: "Website Found",
        category: "VERIFIED",
        status: "FAIL",
        weight: WEIGHTS.WEBSITE_FOUND,
        detail: "No website or email domain was found anywhere in the provided text, and a web search for the company name found nothing confidently matching either.",
      });
    } else {
      const sourceNote =
        extraction.websiteSource === "WEB_SEARCH"
          ? " (not mentioned in your text — found via web search for the company name)"
          : "";

      let websiteStatus, websiteDetail;
      if (websiteCheck.reachable === true) {
        websiteStatus = "PASS";
        websiteDetail = `${domainToCheck} resolves and responded (HTTP ${websiteCheck.statusCode}).${sourceNote}`;
      } else if (websiteCheck.reachable === null) {
        // DNS resolved but the site blocked our request — common for
        // legitimate companies behind a firewall (Cloudflare, Akamai, etc).
        // This is inconclusive, not evidence of a fake site.
        websiteStatus = "UNKNOWN";
        websiteDetail = `${domainToCheck} resolves, but the site blocked our automated request (common for sites behind bot-protection). Please check it manually.${sourceNote}`;
      } else {
        websiteStatus = "FAIL";
        websiteDetail = `We could not find a working website at ${domainToCheck}. This doesn't necessarily mean the company is fake — but a real company's offer should have a verifiable website.${sourceNote}`;
      }

      checks.push({
        id: "WEBSITE_FOUND",
        label: "Website Found",
        category: "VERIFIED",
        status: websiteStatus,
        weight: WEIGHTS.WEBSITE_FOUND,
        detail: websiteDetail,
      });

      checks.push({
        id: "WEBSITE_SECURE",
        label: "Website Uses HTTPS",
        category: "VERIFIED",
        status: websiteCheck.reachable !== true ? "UNKNOWN" : websiteCheck.secure ? "PASS" : "FAIL",
        weight: WEIGHTS.WEBSITE_SECURE,
        detail:
          websiteCheck.reachable !== true
            ? "Could not check — the site was unreachable or blocked our request."
            : websiteCheck.secure
            ? "Site is served over a secure HTTPS connection."
            : "Site only responded over plain HTTP — no SSL certificate.",
      });

      checks.push({
        id: "DOMAIN_HAS_MX",
        label: "Domain Accepts Email (MX Records)",
        category: "VERIFIED",
        status: mxCheck.hasMx ? "PASS" : "FAIL",
        weight: WEIGHTS.DOMAIN_HAS_MX,
        detail: mxCheck.hasMx
          ? "Domain has mail servers configured — it's set up to receive email."
          : "No mail servers found for this domain.",
      });
    }

    if (extraction.email) {
      const isFree = domainVerificationService.isFreeEmailProvider(extraction.email);
      checks.push({
        id: "EMAIL_NOT_FREE_PROVIDER",
        label: "Official Company Email",
        category: "VERIFIED",
        status: isFree ? "FAIL" : "PASS",
        weight: WEIGHTS.EMAIL_NOT_FREE_PROVIDER,
        detail: isFree
          ? `${extraction.email} uses a free/personal email provider, not a company domain.`
          : `${extraction.email} uses a dedicated domain rather than a free provider.`,
      });

      if (extraction.website) {
        const emailDomain = domainVerificationService.extractDomainFromEmail(extraction.email);
        const websiteDomain = domainVerificationService.normalizeDomain(extraction.website);
        const matches =
          !!emailDomain &&
          !!websiteDomain &&
          (emailDomain === websiteDomain || emailDomain.endsWith(`.${websiteDomain}`));

        checks.push({
          id: "EMAIL_DOMAIN_MATCH",
          label: "Email Matches Company Domain",
          category: "VERIFIED",
          status: matches ? "PASS" : "FAIL",
          weight: WEIGHTS.EMAIL_DOMAIN_MATCH,
          detail: matches
            ? "The recruiter's email domain matches the company website."
            : `${extraction.email} does not match the domain ${extraction.website}.`,
        });
      }
    }

    if (extraction.linkedinUrl) {
      let status = "UNKNOWN";
      if (linkedinCheck.reachable === true) status = "PASS";
      else if (linkedinCheck.reachable === false) status = "FAIL";

      checks.push({
        id: "LINKEDIN_REACHABLE",
        label: "LinkedIn Profile Reachable",
        category: "VERIFIED",
        status,
        weight: WEIGHTS.LINKEDIN_REACHABLE,
        detail:
          status === "UNKNOWN"
            ? "LinkedIn blocks automated checks for this URL — please verify it manually."
            : status === "PASS"
            ? "The provided LinkedIn URL is reachable."
            : "The provided LinkedIn URL could not be found.",
      });
    }

    if (typeof extraction.consistencyScore === "number") {
      checks.push({
        id: "AI_CONSISTENCY",
        label: "AI Consistency Assessment",
        category: "AI_ASSESSED",
        status: extraction.consistencyScore >= 60 ? "PASS" : "FAIL",
        weight: WEIGHTS.AI_CONSISTENCY,
        detail:
          extraction.consistencyNotes ||
          "Gemini's qualitative read on how consistent and professional these details sound.",
        score: extraction.consistencyScore,
      });
    }

    // Community Reputation — a SUPPORTING signal, not a primary one. If we
    // genuinely found no discussions (common for small/new companies), or
    // the lookup failed, this is UNKNOWN — excluded from scoring entirely
    // rather than penalizing companies with no online footprint.
    if (communityReputation && communityReputation.discussionsFound > 0) {
      const status =
        communityReputation.trustSignal === "HIGH"
          ? "PASS"
          : communityReputation.trustSignal === "LOW"
          ? "FAIL"
          : "UNKNOWN"; // MEDIUM reads as neither a pass nor a fail signal

      checks.push({
        id: "COMMUNITY_REPUTATION",
        label: "Community Reputation",
        category: "AI_ASSESSED",
        status,
        weight: WEIGHTS.COMMUNITY_REPUTATION,
        detail:
          communityReputation.summary ||
          `Found ${communityReputation.discussionsFound} community discussions about this company.`,
        score: communityReputation.communityScore,
      });
    }

    return checks;
  }

  // ─── Weighted average over only the checks that applied ────────────────────
  // AI_CONSISTENCY and COMMUNITY_REPUTATION contribute proportionally to
  // their 0-100 score rather than a binary pass/fail, since both are
  // graded judgments, not yes/no facts.
  _computeTrustScore(checks) {
    let earned = 0;
    let possible = 0;
    const PROPORTIONAL_IDS = new Set(["AI_CONSISTENCY", "COMMUNITY_REPUTATION"]);

    for (const check of checks) {
      if (check.status === "UNKNOWN") continue;
      possible += check.weight;

      if (PROPORTIONAL_IDS.has(check.id) && typeof check.score === "number") {
        earned += check.weight * (check.score / 100);
      } else if (check.status === "PASS") {
        earned += check.weight;
      }
    }

    if (possible === 0) return 0;
    return Math.round((earned / possible) * 100);
  }

  // ─── List + detail + delete — same shape as conversation.service.js ────────
  async getUserVerifications(userId, query) {
    const { page = 1, limit = 10, sortBy = "createdAt", sortOrder = "desc" } = query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));

    const result = await verificationRepository.findByUser(userId, {
      page: pageNum,
      limit: limitNum,
      sortBy,
      sortOrder,
    });

    const pagination = {
      total: result.total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(result.total / limitNum),
      hasNextPage: pageNum < Math.ceil(result.total / limitNum),
      hasPrevPage: pageNum > 1,
    };

    return { verifications: result.data, pagination };
  }

  async getVerificationById(verificationId, userId) {
    const record = await verificationRepository.findById(verificationId);
    if (!record) throw ApiError.notFound("Verification not found");
    if (record.user.toString() !== userId.toString()) {
      throw ApiError.forbidden("You do not have access to this verification");
    }
    return record;
  }

  async deleteVerification(verificationId, userId) {
    const record = await verificationRepository.findById(verificationId);
    if (!record) throw ApiError.notFound("Verification not found");
    if (record.user.toString() !== userId.toString()) {
      throw ApiError.forbidden("You cannot delete this verification");
    }
    await verificationRepository.softDelete(verificationId);
  }
}

module.exports = new VerificationService();