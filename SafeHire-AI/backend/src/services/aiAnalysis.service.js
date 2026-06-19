/**
 * services/aiAnalysis.service.js — Core AI analysis pipeline
 * Uses Google Gemini API (free tier) instead of Anthropic Claude
 */

"use strict";

const { GoogleGenerativeAI } = require("@google/generative-ai");
const Tesseract = require("tesseract.js");
const sharp = require("sharp");
const logger = require("../utils/logger");
const ApiError = require("../utils/ApiError");

// ─── Initialize Gemini client ─────────────────────────────────────────────────
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ─── Constants ────────────────────────────────────────────────────────────────
const MODEL = "gemini-2.5-flash";// Free tier, fast and capable
const OCR_LANGUAGES = "eng+hin";

class AIAnalysisService {

  async analyzeConversation(imageBuffer, platform) {
    const startTime = Date.now();
    try {
      logger.info("Starting OCR extraction", { platform });
      const extractedText = await this._extractTextFromImage(imageBuffer);

      if (!extractedText || extractedText.trim().length < 10) {
        throw ApiError.badRequest(
          "Could not extract readable text from image. Please upload a clearer screenshot."
        );
      }

      const preprocessed = this._preprocessText(extractedText);

      logger.info("Sending to Gemini for analysis", { textLength: preprocessed.text.length });
      const analysisResult = await this._analyzeWithGemini(preprocessed, platform, "conversation");

      const processingTimeMs = Date.now() - startTime;
      logger.info("Analysis complete", { riskLevel: analysisResult.riskLevel, processingTimeMs });

      return { extractedText, ...analysisResult, processingTimeMs };

    } catch (err) {
      if (err instanceof ApiError) throw err;
      logger.error("AI analysis failed", { error: err.message });
      throw ApiError.internal("AI analysis failed. Please try again.");
    }
  }

  async analyzeDocument(extractedText, documentType) {
    const startTime = Date.now();
    const preprocessed = this._preprocessText(extractedText);
    const analysisResult = await this._analyzeWithGemini(preprocessed, documentType, "document");
    return { ...analysisResult, processingTimeMs: Date.now() - startTime };
  }

  async analyzeTranscript(transcript) {
    const startTime = Date.now();
    const preprocessed = this._preprocessText(transcript);
    const analysisResult = await this._analyzeWithGemini(preprocessed, "PHONE_CALL", "voice");
    return { ...analysisResult, processingTimeMs: Date.now() - startTime };
  }

  // ─── Company Verification Agent — extraction step ──────────────────────────
  // Pulls out company identifying details from pasted offer text/screenshots.
  // The backend (domainVerification.service.js) does the actual verifying —
  // this just reads what's there. Gemini is explicitly told never to invent
  // a website/email/phone that isn't in the text.
  async extractCompanyEntities(rawText) {
    const model = genAI.getGenerativeModel({ model: MODEL });
    const cleanedText = this._preprocessText(rawText).text;

    const prompt = `You are SafeHire AI's Company Verification Agent. A student has pasted information about a job or internship opportunity. Extract the company's identifying details and assess how internally consistent the information sounds.

CRITICAL RULE: Only extract a field if it is EXPLICITLY present in the text. Never guess, infer, or invent a website, email, or phone number that isn't actually written there. If a field is absent, return null for it.

=== TEXT TO ANALYZE ===
${cleanedText}

Respond with ONLY a valid JSON object, no markdown, no explanation:
{
  "companyName": "<company name exactly as written, or null>",
  "website": "<website domain/URL exactly as written, or null>",
  "email": "<recruiter or company email exactly as written, or null>",
  "phone": "<phone number exactly as written, or null>",
  "recruiterName": "<recruiter's name if mentioned, or null>",
  "linkedinUrl": "<LinkedIn profile or company page URL if mentioned, or null>",
  "roleTitle": "<job/internship title if mentioned, or null>",
  "consistencyScore": <integer 0-100, how internally consistent and professional these details sound for a real company>,
  "consistencyNotes": "<1-2 sentence plain-English explanation of that score>",
  "textRedFlags": ["<any scam-style red flag phrases found in the text itself>"]
}`;

    const result = await model.generateContent(prompt);
    const extraction = this._parseCompanyExtraction(result.response.text());
    extraction.websiteSource = extraction.website ? "DOCUMENT" : null;
    extraction.linkedinSource = extraction.linkedinUrl ? "DOCUMENT" : null;

    // The text itself didn't give us a website/LinkedIn — if we at least
    // have a company name, try a real web search to find the official one.
    // This is best-effort: if it fails or comes back low-confidence, we
    // just leave the field null rather than guess.
    if (extraction.companyName && (!extraction.website || !extraction.linkedinUrl)) {
      try {
        const lookup = await this._lookupCompanyOnline(extraction);
        if (!extraction.website && lookup.website) {
          extraction.website = lookup.website;
          extraction.websiteSource = "WEB_SEARCH";
        }
        if (!extraction.linkedinUrl && lookup.linkedinUrl) {
          extraction.linkedinUrl = lookup.linkedinUrl;
          extraction.linkedinSource = "WEB_SEARCH";
        }
      } catch (err) {
        logger.warn("Company web-search lookup failed, continuing without it", {
          company: extraction.companyName,
          error: err.message,
        });
      }
    }

    return extraction;
  }

  // Search-grounded lookup — only called when the document itself didn't
  // provide a website/LinkedIn. Uses Gemini's Google Search tool so the
  // result is backed by a real, current search rather than the model's
  // training data (which can be stale or simply wrong about a small company).
  async _lookupCompanyOnline(extraction) {
    const groundedModel = genAI.getGenerativeModel({
      model: MODEL,
      tools: [{ googleSearch: {} }],
    });

    const prompt = `Search the web to find the OFFICIAL website and LinkedIn company page for this company. Only return a result if you are confident it's the correct, real company — do not guess or return an unrelated company with a similar name.

Company name: "${extraction.companyName}"
${extraction.roleTitle ? `Role mentioned: "${extraction.roleTitle}"` : ""}
${extraction.email ? `Email domain mentioned: "${extraction.email.split("@")[1] || ""}"` : ""}

Respond with ONLY valid JSON, no markdown:
{
  "website": "<official website domain, or null if not confidently found>",
  "linkedinUrl": "<LinkedIn company page URL, or null if not confidently found>",
  "confidence": "<HIGH | MEDIUM | LOW>"
}`;

    const result = await groundedModel.generateContent(prompt);
    const raw = result.response.text();
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(cleaned);

    if (parsed.confidence === "LOW") {
      return { website: null, linkedinUrl: null };
    }
    return { website: parsed.website || null, linkedinUrl: parsed.linkedinUrl || null };
  }

  _parseCompanyExtraction(rawText) {
    try {
      const cleaned = rawText
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      const parsed = JSON.parse(cleaned);

      return {
        companyName: parsed.companyName || null,
        website: parsed.website || null,
        email: parsed.email || null,
        phone: parsed.phone || null,
        recruiterName: parsed.recruiterName || null,
        linkedinUrl: parsed.linkedinUrl || null,
        roleTitle: parsed.roleTitle || null,
        consistencyScore:
          typeof parsed.consistencyScore === "number"
            ? Math.min(100, Math.max(0, parsed.consistencyScore))
            : null,
        consistencyNotes: parsed.consistencyNotes || "",
        textRedFlags: Array.isArray(parsed.textRedFlags) ? parsed.textRedFlags : [],
      };
    } catch (err) {
      logger.error("Failed to parse company extraction response", { rawText, error: err.message });
      return {
        companyName: null,
        website: null,
        email: null,
        phone: null,
        recruiterName: null,
        linkedinUrl: null,
        roleTitle: null,
        consistencyScore: null,
        consistencyNotes: "Could not fully parse the AI response — please review the extracted details manually.",
        textRedFlags: [],
      };
    }
  }

  async _extractTextFromImage(imageBuffer) {
    const processedBuffer = await sharp(imageBuffer)
      .grayscale()
      .normalize()
      .resize(1500, null, { withoutEnlargement: true })
      .toBuffer();

    const { data: { text } } = await Tesseract.recognize(processedBuffer, OCR_LANGUAGES, {
      tessedit_pageseg_mode: "6",
      preserve_interword_spaces: "1",
    });

    return text;
  }

  _preprocessText(rawText) {
    const cleaned = rawText
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]+/g, " ")
      .trim();

    return {
      text: cleaned,
      entities: {
        urls: this._extractURLs(cleaned),
        phoneNumbers: this._extractPhoneNumbers(cleaned),
        moneyMentions: this._extractMoneyMentions(cleaned),
        emails: this._extractEmails(cleaned),
      },
    };
  }

  async _analyzeWithGemini(preprocessed, platform, analysisType) {
    const model = genAI.getGenerativeModel({ model: MODEL });

    const prompt = `You are SafeHire AI, an expert scam detection system specializing in recruitment fraud targeting students in India.

Analyze this ${analysisType} from ${platform} for recruitment scam indicators.

=== EXTRACTED ENTITIES ===
URLs found: ${preprocessed.entities.urls.length > 0 ? preprocessed.entities.urls.join(", ") : "None"}
Phone numbers: ${preprocessed.entities.phoneNumbers.length > 0 ? preprocessed.entities.phoneNumbers.join(", ") : "None"}
Money mentions: ${preprocessed.entities.moneyMentions.length > 0 ? preprocessed.entities.moneyMentions.join(", ") : "None"}
Emails: ${preprocessed.entities.emails.length > 0 ? preprocessed.entities.emails.join(", ") : "None"}

=== CONTENT TO ANALYZE ===
${preprocessed.text}

=== SCAM INDICATOR TYPES ===
- PAYMENT_REQUEST: Any request for money, fees, deposits, or purchases
- URGENCY_PRESSURE: Artificial time pressure to prevent verification
- PERSONAL_DATA_REQUEST: Requests for Aadhaar, PAN, bank details, passwords
- IMPERSONATION: Fake company names, fake employee identities
- SUSPICIOUS_LINK: Unverified URLs, shortened links, lookalike domains
- GROOMING_BEHAVIOR: Excessive flattery, building false trust, personal questions
- GRAMMAR_ANOMALY: Poor grammar inconsistent with claimed professional organization
- UNREALISTIC_OFFER: Salary/benefits too good to be true for the profile
- CONFIDENTIALITY_DEMAND: Asking to keep offer secret from family/friends
- FAKE_CREDENTIAL: Fake employee IDs, forged documents, unverifiable claims

=== RISK SCORING ===
- LOW (0-29): No significant scam indicators
- MEDIUM (30-59): Some suspicious elements, needs verification
- HIGH (60-84): Multiple scam patterns, high probability of fraud
- CRITICAL (85-100): Definite scam, immediate action required

Respond with ONLY a valid JSON object, no markdown, no explanation:
{
  "riskLevel": "LOW | MEDIUM | HIGH | CRITICAL",
  "riskScore": <integer 0-100>,
  "indicators": [
    {
      "type": "<indicator type>",
      "phrase": "<exact phrase from content>",
      "confidence": <float 0.0-1.0>,
      "explanation": "<plain English explanation for a student>"
    }
  ],
  "explanation": "<2-3 sentence overall assessment in simple language>",
  "recommendations": ["<action 1>", "<action 2>"],
  "legitimacySignals": ["<any legitimate signals found>"]
}`;

    const result = await model.generateContent(prompt);
    const rawText = result.response.text();
    return this._parseGeminiResponse(rawText);
  }

  _parseGeminiResponse(rawText) {
    try {
      const cleaned = rawText
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      const parsed = JSON.parse(cleaned);

      if (!parsed.riskLevel || parsed.riskScore === undefined) {
        throw new Error("Missing required fields in Gemini response");
      }

      return {
        riskLevel: parsed.riskLevel,
        riskScore: Math.min(100, Math.max(0, parsed.riskScore)),
        indicators: parsed.indicators || [],
        explanation: parsed.explanation || "Analysis complete.",
        recommendations: parsed.recommendations || [],
        legitimacySignals: parsed.legitimacySignals || [],
      };

    } catch (err) {
      logger.error("Failed to parse Gemini response", { rawText, error: err.message });
      return {
        riskLevel: "MEDIUM",
        riskScore: 50,
        indicators: [],
        explanation: "Analysis completed but results could not be fully parsed. Please review manually.",
        recommendations: ["Verify this opportunity through official channels before proceeding."],
        legitimacySignals: [],
      };
    }
  }

  _extractURLs(text) {
    const urlRegex = /https?:\/\/[^\s]+|www\.[^\s]+/gi;
    return [...new Set(text.match(urlRegex) || [])];
  }

  _extractPhoneNumbers(text) {
    const phoneRegex = /(?:\+91|0)?[6-9]\d{9}/g;
    return [...new Set(text.match(phoneRegex) || [])];
  }

  _extractMoneyMentions(text) {
    const moneyRegex = /(?:₹|Rs\.?|INR|USD|\$)\s?\d+(?:,\d+)*(?:\.\d+)?|\d+\s?(?:lakh|lakhs|LPA|k|K)/gi;
    return [...new Set(text.match(moneyRegex) || [])];
  }

  _extractEmails(text) {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    return [...new Set(text.match(emailRegex) || [])];
  }
}

module.exports = new AIAnalysisService();