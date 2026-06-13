/**
 * config/env.js — Environment variable validation
 *
 * WHY THIS FILE EXISTS:
 * Environment variables are just strings. Nothing stops someone from
 * deploying with a missing JWT_SECRET or a typo in MONGO_URI.
 * This file uses Zod to parse and validate every env var at startup.
 * If anything is wrong — crash immediately with a clear message.
 *
 * FAIL FAST PRINCIPLE: surface configuration problems before serving
 * a single request, not 3 hours into a production incident.
 */

"use strict";

const { z } = require("zod");

// ─── Define the schema for all environment variables ─────────────────────────
// z.object() defines what shape process.env should have.
// Each field says: what type it must be, and what the error message is.
const envSchema = z.object({

  // ── Server ──────────────────────────────────────────────────────────────
  NODE_ENV: z
    .enum(["development", "production", "test"], {
      errorMap: () => ({ message: "NODE_ENV must be development, production, or test" }),
    })
    .default("development"),

  PORT: z
    .string()
    .transform(Number)           // env vars are always strings — convert to number
    .pipe(z.number().min(1).max(65535))
    .default("5000"),

  // ── MongoDB ─────────────────────────────────────────────────────────────
  MONGO_URI: z
    .string({ required_error: "MONGO_URI is required" })
    .url({ message: "MONGO_URI must be a valid URL" }),

  // ── JWT ─────────────────────────────────────────────────────────────────
  // Min 32 chars enforces a strong secret — short secrets are brute-forceable
  JWT_ACCESS_SECRET: z
    .string({ required_error: "JWT_ACCESS_SECRET is required" })
    .min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),

  JWT_REFRESH_SECRET: z
    .string({ required_error: "JWT_REFRESH_SECRET is required" })
    .min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),

  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),   // Short-lived access token
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),   // Long-lived refresh token

  // ── Cloudinary (file storage) ────────────────────────────────────────────
  CLOUDINARY_CLOUD_NAME: z.string({ required_error: "CLOUDINARY_CLOUD_NAME is required" }),
  CLOUDINARY_API_KEY: z.string({ required_error: "CLOUDINARY_API_KEY is required" }),
  CLOUDINARY_API_SECRET: z.string({ required_error: "CLOUDINARY_API_SECRET is required" }),

 // ── AI / LLM ─────────────────────────────────────────────────────────────
  GEMINI_API_KEY: z
    .string({ required_error: "GEMINI_API_KEY is required" })
    .min(10, { message: "GEMINI_API_KEY appears invalid" }),
  // ── CORS ──────────────────────────────────────────────────────────────────
  // Comma-separated list of allowed frontend origins
  // e.g. "http://localhost:5173,https://safehire.ai"
  ALLOWED_ORIGINS: z.string().default("http://localhost:5173"),

  // ── Rate Limiting ─────────────────────────────────────────────────────────
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default("900000"), // 15 min
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default("100"),

  // ── Cookie ────────────────────────────────────────────────────────────────
  COOKIE_SECRET: z
    .string({ required_error: "COOKIE_SECRET is required" })
    .min(32, "COOKIE_SECRET must be at least 32 characters"),
});

// ─── Parse and validate ───────────────────────────────────────────────────────
// We store the parsed (and type-coerced) result so the rest of the app
// imports `env` instead of using raw process.env strings.
let env;

const validateEnv = () => {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    // Format all validation errors into readable lines
    const errors = result.error.errors
      .map((e) => `  ✗ ${e.path.join(".")}: ${e.message}`)
      .join("\n");

    console.error("\n❌ Invalid environment variables:\n" + errors + "\n");
    process.exit(1); // Crash immediately — do not start the server
  }

  env = result.data;
  return env;
};

// ─── Exports ──────────────────────────────────────────────────────────────────
// validateEnv() is called once in server.js before anything else.
// After that, any file can import `env` to get type-safe, validated values.
// This is better than sprinkling process.env.SOMETHING everywhere because:
//   1. You get autocomplete / type hints
//   2. Values are already coerced (PORT is a number, not a string)
//   3. One place to see every config your app needs
module.exports = { validateEnv, getEnv: () => env };