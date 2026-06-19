/**
 * services/domainVerification.service.js
 *
 * Pure technical checks for the Company Verification Agent — no AI, no
 * external API keys. Everything here is something the backend can confirm
 * for itself: does the domain resolve, does it serve a page over HTTPS,
 * does it have mail servers configured, does the email's domain match the
 * company's website.
 *
 * HONESTY NOTE ON LinkedIn:
 * There is no LinkedIn API key configured in this project, and LinkedIn
 * actively blocks scraping. So we never go *searching* LinkedIn for a
 * company — we only check the *exact* LinkedIn URL the user (or Gemini's
 * extraction) provided, and even then a 403/999/429 is treated as
 * "couldn't confirm" rather than "fake," since that's LinkedIn's bot
 * defenses, not evidence the profile doesn't exist.
 *
 * REQUIRES Node 18+ (uses the built-in global `fetch` and `AbortController`
 * — no extra HTTP dependency was added to package.json for this).
 */

"use strict";

const dns = require("dns").promises;
const logger = require("../utils/logger");

const REQUEST_TIMEOUT_MS = 6000;

// Common free/personal email providers — a recruiter using one of these
// instead of a company domain is a classic scam signal.
const FREE_EMAIL_PROVIDERS = new Set([
  "gmail.com",
  "yahoo.com",
  "yahoo.in",
  "outlook.com",
  "hotmail.com",
  "rediffmail.com",
  "protonmail.com",
  "icloud.com",
  "aol.com",
  "live.com",
  "gmx.com",
  "yandex.com",
  "mail.com",
]);

// Status codes that mean "a bot wall blocked us," not "this page is fake"
const BOT_BLOCKED_STATUS_CODES = new Set([403, 429, 999]);

class DomainVerificationService {
  // "https://www.abc.com/careers?x=1" → "abc.com"
  normalizeDomain(input) {
    if (!input) return null;
    let value = String(input).trim().toLowerCase();
    value = value.replace(/^https?:\/\//, "").replace(/^www\./, "");
    value = value.split("/")[0].split("?")[0].split(":")[0];
    return value || null;
  }

  extractDomainFromEmail(email) {
    if (!email || !email.includes("@")) return null;
    return email.split("@")[1].trim().toLowerCase();
  }

  // Returns true/false, or null if we can't tell (no email given)
  isFreeEmailProvider(email) {
    const domain = this.extractDomainFromEmail(email);
    if (!domain) return null;
    return FREE_EMAIL_PROVIDERS.has(domain);
  }

  // DNS resolution + a live HTTP(S) request to the domain's homepage.
  //
  // IMPORTANT: many legitimate corporate sites sit behind bot protection
  // (Cloudflare, Akamai, etc.) that blocks plain server-side fetches with
  // a 403/503 or just times out — that is NOT evidence the site is fake,
  // it's evidence of a firewall. So:
  //   - DNS resolving at all is treated as a positive signal on its own.
  //   - A successful HTTP response (any status < 500) confirms reachable.
  //   - A bot-block-shaped failure (timeout, abort, or 403/503 on every
  //     scheme) is reported as reachable: null (UNKNOWN) rather than a
  //     hard fail, so the trust score doesn't unfairly punish well-known
  //     companies whose WAFs reject scripted requests.
  async checkWebsite(rawDomain) {
    const domain = this.normalizeDomain(rawDomain);
    if (!domain) return { applicable: false };

    let dnsResolved = false;
    try {
      await dns.lookup(domain);
      dnsResolved = true;
    } catch (err) {
      return { applicable: true, reachable: false, secure: false, domain };
    }

    const BROWSER_HEADERS = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    };

    let blockedByWaf = false;

    for (const scheme of ["https", "http"]) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        const res = await fetch(`${scheme}://${domain}`, {
          method: "GET",
          redirect: "follow",
          signal: controller.signal,
          headers: BROWSER_HEADERS,
        });
        clearTimeout(timeout);

        if (res.status < 500) {
          return { applicable: true, reachable: true, secure: scheme === "https", statusCode: res.status, domain };
        }
        // 5xx or a bot-challenge status — note it, but try the other scheme first
        blockedByWaf = true;
      } catch (err) {
        // Network error, timeout, or TLS issue — could be down, could be a
        // firewall silently dropping non-browser traffic. Keep trying.
        blockedByWaf = true;
      }
    }

    // DNS resolved but we couldn't get a confirmed response on either
    // scheme — most likely a firewall, not a fake/nonexistent site.
    if (dnsResolved && blockedByWaf) {
      return { applicable: true, reachable: null, secure: null, domain, blockedByWaf: true };
    }

    return { applicable: true, reachable: false, secure: false, domain };
  }

  async checkMxRecords(rawDomain) {
    const domain = this.normalizeDomain(rawDomain);
    if (!domain) return { applicable: false };
    try {
      const records = await dns.resolveMx(domain);
      return { applicable: true, hasMx: records.length > 0 };
    } catch (err) {
      return { applicable: true, hasMx: false };
    }
  }

  // Best-effort reachability check for a LinkedIn URL that was *given* to us.
  // reachable: true (200), false (404-ish), or null (blocked/inconclusive)
  async checkLinkedinUrl(url) {
    if (!url) return { applicable: false };
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      const res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0 (SafeHireAI-Verifier/1.0)" },
      });
      clearTimeout(timeout);

      if (BOT_BLOCKED_STATUS_CODES.has(res.status)) {
        return { applicable: true, reachable: null };
      }
      return { applicable: true, reachable: res.status === 200 };
    } catch (err) {
      logger.warn("LinkedIn URL check failed", { url, error: err.message });
      return { applicable: true, reachable: null };
    }
  }
}

module.exports = new DomainVerificationService();