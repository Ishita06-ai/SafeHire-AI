/**
 * services/communityReputation.service.js — Community Reputation Analysis
 *
 * WHAT THIS IS:
 * One Gemini call, with Google Search grounding enabled, that looks up
 * public discussion of a company (Reddit, Quora, Glassdoor, LinkedIn, news)
 * and returns a SUMMARY — never raw scraped text. We never store or display
 * actual review/post content; Gemini paraphrases everything into themes and
 * counts. This matters both for copyright/ToS reasons (most of these sites
 * restrict scraping/republishing) and because a student doesn't want to
 * read 40 raw Reddit comments inside the app.
 *
 * WHERE THIS SITS IN THE TRUST SCORE — AND WHY ITS WEIGHT IS LOW:
 * A few negative reviews ("slow stipend") don't make a company a scam, and
 * a company with no online chatter isn't suspicious either — most small or
 * new companies just don't have a community footprint yet. So this is
 * deliberately a SUPPORTING signal, weighted lower than the deterministic
 * checks (real website, MX records, email-domain match) in
 * verification.service.js. It should nudge the score, not drive it.
 */

"use strict";

const { GoogleGenerativeAI } = require("@google/generative-ai");
const logger = require("../utils/logger");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MODEL = "gemini-2.5-flash";

class CommunityReputationService {
  // Returns null if there's nothing to search for, or a result with
  // discussionsFound: 0 if the search genuinely turns up nothing — both are
  // valid, common outcomes and are NOT treated as red flags by themselves.
  async analyze(companyName, roleTitle = null) {
    if (!companyName || companyName.trim().length < 2) return null;

    try {
      const model = genAI.getGenerativeModel({
        model: MODEL,
        tools: [{ googleSearch: {} }],
      });

      const prompt = `Search the web for public discussion of this company from job-seekers and employees — Reddit, Quora, Glassdoor, LinkedIn posts/comments, and any scam-report or review sites. You are looking for genuine first-hand sentiment about working there or being hired there, NOT general company marketing/news.

Company: "${companyName}"
${roleTitle ? `Context: a candidate was offered a "${roleTitle}" role there.` : ""}

CRITICAL RULES:
- Summarize and paraphrase only. Never quote review text directly.
- Do not invent discussions that don't exist — if you find little or nothing, say so honestly with a low discussionsFound count.
- Distinguish "no discussions found" (common for small/new/local companies — NOT itself a red flag) from "discussions found and they are negative" (an actual concern).
- Pay special attention to scam-specific complaints: unpaid work, fee requests, fake offer letters, ghosting after interviews — these matter more than generic gripes like "slow email replies."

Respond with ONLY valid JSON, no markdown:
{
  "discussionsFound": <approximate integer count of distinct discussions/reviews/posts found>,
  "positiveMentions": <approximate integer count of positive mentions among those>,
  "negativeMentions": <approximate integer count of negative mentions among those>,
  "commonPositives": ["<short paraphrased theme, e.g. 'Good learning opportunities'>"],
  "commonNegatives": ["<short paraphrased theme, e.g. 'Delayed stipend payments'>"],
  "scamSpecificFlags": ["<only genuine scam-pattern complaints found, e.g. 'Multiple reports of unpaid internships'>"],
  "trustSignal": "<HIGH | MEDIUM | LOW | INSUFFICIENT_DATA>",
  "communityScore": <integer 0-100, or null if discussionsFound is 0>,
  "summary": "<2-3 sentence plain-English summary of overall sentiment>"
}`;

      const result = await model.generateContent(prompt);
      const raw = result.response.text();
      const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
      const parsed = JSON.parse(cleaned);

      return {
        discussionsFound: parsed.discussionsFound ?? 0,
        positiveMentions: parsed.positiveMentions ?? 0,
        negativeMentions: parsed.negativeMentions ?? 0,
        commonPositives: Array.isArray(parsed.commonPositives) ? parsed.commonPositives : [],
        commonNegatives: Array.isArray(parsed.commonNegatives) ? parsed.commonNegatives : [],
        scamSpecificFlags: Array.isArray(parsed.scamSpecificFlags) ? parsed.scamSpecificFlags : [],
        trustSignal: parsed.trustSignal || "INSUFFICIENT_DATA",
        communityScore: typeof parsed.communityScore === "number" ? parsed.communityScore : null,
        summary: parsed.summary || "",
      };
    } catch (err) {
      // Best-effort feature — never let a search/parse failure break the
      // overall verification. Just report "no data" and move on.
      logger.warn("Community reputation lookup failed, continuing without it", {
        company: companyName,
        error: err.message,
      });
      return null;
    }
  }
}

module.exports = new CommunityReputationService();