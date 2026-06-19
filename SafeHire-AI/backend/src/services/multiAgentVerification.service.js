/**
 * services/multiAgentVerification.service.js
 *
 * Multi-Agent AI Scam Detection System
 * ─────────────────────────────────────
 * Four distinct Gemini prompts, each with a narrow job, chained into one
 * pipeline. Each "agent" only sees what it needs and returns structured
 * JSON; a final aggregator combines their outputs into one report.
 *
 * HONESTY NOTE: these are four sequential prompts to the same Gemini model,
 * not four autonomous processes running independently — there's no
 * orchestration framework (LangGraph, CrewAI, etc.) underneath. That's a
 * completely normal and legitimate way to describe a "multi-agent
 * architecture": each agent has a single responsibility, a defined input/
 * output contract, and is independently swappable/testable, which is the
 * part that actually matters for resume purposes. The 4 calls run mostly
 * in parallel (Agent 1 must run first since 2-4 depend on its output).
 *
 * PIPELINE:
 *   Agent 1 (Document Analyzer) → extracts structured facts from raw text
 *   Agent 2 (Risk Analyzer)     → scam indicators, runs off raw text directly
 *   Agent 3 (Company Verifier)  → judges legitimacy of Agent 1's extracted facts
 *   Agent 4 (Safety Advisor)    → recommendations, synthesizes Agents 1-3
 *   Aggregator                  → combines all 4 into one Final Report + Trust Score
 */

"use strict";

const { GoogleGenerativeAI } = require("@google/generative-ai");
const logger = require("../utils/logger");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MODEL = "gemini-2.5-flash";

// ─── Shared helper: call Gemini, strip markdown fences, parse JSON ──────────
async function callAgent(agentName, prompt) {
  const model = genAI.getGenerativeModel({ model: MODEL });
  const result = await model.generateContent(prompt);
  const raw = result.response.text();

  try {
    const cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    return JSON.parse(cleaned);
  } catch (err) {
    logger.error(`${agentName} returned unparseable JSON`, { raw, error: err.message });
    throw new Error(`${agentName} failed to produce valid output`);
  }
}

// Same as callAgent, but with Google Search grounding enabled — the model
// can issue real web searches before answering. Only used where we actually
// need to look something up (finding a company's real website), since
// grounding costs extra quota/billing on the Gemini API and is slower.
async function callAgentWithSearch(agentName, prompt) {
  const model = genAI.getGenerativeModel({
    model: MODEL,
    tools: [{ googleSearch: {} }],
  });
  const result = await model.generateContent(prompt);
  const raw = result.response.text();
  const groundingMetadata = result.response.candidates?.[0]?.groundingMetadata || null;

  try {
    const cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    const parsed = JSON.parse(cleaned);
    // Track whether anything was actually backed by a real search, so the
    // verifier downstream can tell "found via search" apart from "found in
    // the original document" — they deserve different confidence levels.
    parsed._groundedBySearch = !!groundingMetadata?.webSearchQueries?.length;
    return parsed;
  } catch (err) {
    logger.error(`${agentName} returned unparseable JSON`, { raw, error: err.message });
    throw new Error(`${agentName} failed to produce valid output`);
  }
}

// ─── Agent 1: Document Analyzer ──────────────────────────────────────────────
// Job: read the raw offer text, pull out every concrete fact. No judgment,
// no scoring — just "what does this document actually say."
//
// If the document itself doesn't mention a website/LinkedIn but DOES name
// a company, this agent makes a second, search-grounded call to look up
// the company's real official website. That found URL is tagged
// `websiteSource: "WEB_SEARCH"` (vs "DOCUMENT") so downstream agents and
// the UI never present a looked-up guess as if the user had provided it.
async function runDocumentAnalyzer(rawText) {
  const prompt = `You are the Document Analyzer agent in a scam-detection pipeline. Your only job is to extract facts — never judge or score them.

CRITICAL RULE: Only extract a field if it is explicitly present in the text. Never invent or guess. Use null for anything missing.

=== DOCUMENT ===
${rawText}

Respond with ONLY valid JSON, no markdown:
{
  "companyName": "<exact name or null>",
  "website": "<exact url/domain or null>",
  "email": "<exact email or null>",
  "phone": "<exact phone or null>",
  "recruiterName": "<exact name or null>",
  "linkedinUrl": "<exact url or null>",
  "roleTitle": "<exact job title or null>",
  "compensation": "<exact pay/stipend mentioned or null>",
  "requestedActions": ["<any action the document asks the reader to take, e.g. 'pay a fee', 'share bank details'>"]
}`;
  const extracted = await callAgent("Document Analyzer", prompt);
  extracted.websiteSource = extracted.website ? "DOCUMENT" : null;
  extracted.linkedinSource = extracted.linkedinUrl ? "DOCUMENT" : null;

  // Nothing to look up without a company name, or nothing missing to look up
  if (!extracted.companyName || (extracted.website && extracted.linkedinUrl)) {
    return extracted;
  }

  try {
    const lookupPrompt = `Search the web to find the OFFICIAL website and LinkedIn company page for this company. Only return a result if you are confident it's the correct, real company — do not guess or return an unrelated company with a similar name.

Company name: "${extracted.companyName}"
${extracted.roleTitle ? `Role mentioned: "${extracted.roleTitle}"` : ""}
${extracted.email ? `Email domain mentioned: "${extracted.email.split("@")[1] || ""}"` : ""}

Respond with ONLY valid JSON, no markdown:
{
  "website": "<official website domain, or null if not confidently found>",
  "linkedinUrl": "<LinkedIn company page URL, or null if not confidently found>",
  "confidence": "<HIGH | MEDIUM | LOW>"
}`;
    const lookup = await callAgentWithSearch("Company Lookup", lookupPrompt);

    if (!extracted.website && lookup.website && lookup.confidence !== "LOW") {
      extracted.website = lookup.website;
      extracted.websiteSource = "WEB_SEARCH";
    }
    if (!extracted.linkedinUrl && lookup.linkedinUrl && lookup.confidence !== "LOW") {
      extracted.linkedinUrl = lookup.linkedinUrl;
      extracted.linkedinSource = "WEB_SEARCH";
    }
  } catch (err) {
    // Search-grounded lookup is best-effort — if it fails, we simply fall
    // back to whatever the document itself gave us. Never block the pipeline.
    logger.warn("Company web-search lookup failed, continuing without it", {
      company: extracted.companyName,
      error: err.message,
    });
  }

  return extracted;
}

// ─── Agent 2: Risk Analyzer ──────────────────────────────────────────────────
// Job: read the raw text directly (independent of Agent 1) and flag scam
// patterns — urgency, fee requests, vague role, unrealistic pay, etc.
async function runRiskAnalyzer(rawText) {
  const prompt = `You are the Risk Analyzer agent in a scam-detection pipeline. Your only job is to identify scam indicators in the text. Do not extract company facts — that is a different agent's job.

=== DOCUMENT ===
${rawText}

Respond with ONLY valid JSON, no markdown:
{
  "riskLevel": "<LOW | MEDIUM | HIGH>",
  "riskScore": <integer 0-100, higher = more risky>,
  "indicators": ["<specific scam-pattern phrases found, e.g. 'requests upfront payment', 'urgency/pressure language', 'unrealistic pay for stated role'>"],
  "explanation": "<2-3 sentence plain-English summary of why this risk level was assigned>"
}`;
  return callAgent("Risk Analyzer", prompt);
}

// ─── Agent 3: Company Verifier ───────────────────────────────────────────────
// Job: judge legitimacy of the EXTRACTED facts (from Agent 1), not the raw
// text. This is the only agent that depends on another agent's output.
async function runCompanyVerifier(extractedFacts) {
  const prompt = `You are the Company Verifier agent in a scam-detection pipeline. You receive structured facts already extracted from a document — judge how legitimate this company information looks. You are not re-reading the original document.

=== EXTRACTED FACTS ===
${JSON.stringify(extractedFacts, null, 2)}

NOTE: if a field has source "WEB_SEARCH", it means the document itself did NOT provide that detail — it was found via a live web lookup for the company name. Treat WEB_SEARCH-sourced details as lower confidence than DOCUMENT-sourced ones in your concerns, and say so if relevant (e.g. "the offer text itself gave no website — this was found via search").

Consider: does the email domain look like it matches a real company (vs. a free provider)? Is there a verifiable website? Is there enough information to verify this company at all?

Respond with ONLY valid JSON, no markdown:
{
  "verificationStatus": "<VERIFIED | PARTIALLY_VERIFIED | UNVERIFIED>",
  "legitimacyScore": <integer 0-100>,
  "concerns": ["<specific concerns about the company info, if any>"],
  "summary": "<1-2 sentence summary>"
}`;
  return callAgent("Company Verifier", prompt);
}

// ─── Agent 4: Safety Advisor ─────────────────────────────────────────────────
// Job: synthesize Agents 1-3's findings into actionable advice for the
// student. Does not re-analyze raw text or re-score anything.
async function runSafetyAdvisor({ extractedFacts, riskAnalysis, verification }) {
  const prompt = `You are the Safety Advisor agent in a scam-detection pipeline, the final agent before the report is shown to a student. You receive the findings of three other agents and must turn them into clear, actionable safety guidance. Do not re-score risk or re-verify the company — just advise.

=== DOCUMENT FACTS (from Document Analyzer) ===
${JSON.stringify(extractedFacts, null, 2)}

=== RISK FINDINGS (from Risk Analyzer) ===
${JSON.stringify(riskAnalysis, null, 2)}

=== VERIFICATION FINDINGS (from Company Verifier) ===
${JSON.stringify(verification, null, 2)}

Respond with ONLY valid JSON, no markdown:
{
  "recommendations": ["<specific, actionable advice, e.g. 'Avoid paying any fees', 'Verify the recruiter's profile independently'>"],
  "overallGuidance": "<1-2 sentence plain-English bottom line for the student>"
}`;
  return callAgent("Safety Advisor", prompt);
}

// ─── Aggregator: weighted Trust Score + final report shape ──────────────────
function buildFinalReport({ extractedFacts, riskAnalysis, verification, advisory }) {
  // Trust Score blends: inverse of risk (60% weight) + legitimacy (40% weight)
  const riskComponent = (100 - riskAnalysis.riskScore) * 0.6;
  const legitimacyComponent = verification.legitimacyScore * 0.4;
  const trustScore = Math.round(riskComponent + legitimacyComponent);

  return {
    documentAnalysis: {
      company: extractedFacts.companyName || "Unknown",
      roleTitle: extractedFacts.roleTitle,
      extractedFacts,
    },
    riskAnalysis: {
      level: riskAnalysis.riskLevel,
      score: riskAnalysis.riskScore,
      indicators: riskAnalysis.indicators,
      explanation: riskAnalysis.explanation,
    },
    verification: {
      status: verification.verificationStatus,
      legitimacyScore: verification.legitimacyScore,
      concerns: verification.concerns,
      summary: verification.summary,
    },
    recommendations: advisory.recommendations,
    overallGuidance: advisory.overallGuidance,
    finalTrustScore: trustScore,
  };
}

// ─── Pipeline orchestrator ────────────────────────────────────────────────────
class MultiAgentVerificationService {
  async analyze(rawText) {
    const startTime = Date.now();

    // Agent 1 and Agent 2 both only need the raw text — run in parallel
    const [extractedFacts, riskAnalysis] = await Promise.all([
      runDocumentAnalyzer(rawText),
      runRiskAnalyzer(rawText),
    ]);

    // Agent 3 depends on Agent 1's output — must run after
    const verification = await runCompanyVerifier(extractedFacts);

    // Agent 4 depends on all three previous agents — runs last
    const advisory = await runSafetyAdvisor({ extractedFacts, riskAnalysis, verification });

    const report = buildFinalReport({ extractedFacts, riskAnalysis, verification, advisory });
    const processingTimeMs = Date.now() - startTime;

    logger.info("Multi-agent analysis complete", {
      trustScore: report.finalTrustScore,
      processingTimeMs,
    });

    return { ...report, processingTimeMs };
  }
}

module.exports = new MultiAgentVerificationService();