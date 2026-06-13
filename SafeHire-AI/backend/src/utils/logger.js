/**
 * utils/logger.js — Centralized structured logger using Winston
 *
 * WHY THIS FILE EXISTS:
 * console.log() has no levels, no timestamps, no structure, and no way to
 * send logs to external services. Winston gives us all of that.
 *
 * USAGE (anywhere in the app):
 *   const logger = require('../utils/logger');
 *   logger.info('User logged in', { userId: '123' });
 *   logger.error('DB query failed', { error: err.message });
 *   logger.warn('Rate limit approaching', { ip: '1.2.3.4' });
 */

"use strict";

const { createLogger, format, transports } = require("winston");
const path = require("path");

const { combine, timestamp, errors, json, colorize, printf } = format;

const isDevelopment = process.env.NODE_ENV !== "production";

// ─── Development format ───────────────────────────────────────────────────────
// Human-readable, colorized output for your terminal while coding.
// Example output:
//   2024-01-15 10:23:01 [INFO]  MongoDB connected: cluster0.mongodb.net
//   2024-01-15 10:23:05 [ERROR] JWT verification failed { error: 'TokenExpiredError' }
const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  errors({ stack: true }), // If you log an Error object, include the stack trace
  printf(({ timestamp, level, message, stack, ...meta }) => {
    // meta = any extra object you pass as second argument to logger.info(msg, meta)
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : "";
    return `${timestamp} [${level}] ${message} ${metaStr} ${stack || ""}`.trim();
  })
);

// ─── Production format ────────────────────────────────────────────────────────
// Every log is a JSON object. Logging services (Datadog, CloudWatch) ingest this.
// Example output:
//   {"timestamp":"2024-01-15T10:23:01.000Z","level":"error","message":"JWT failed","error":"TokenExpiredError"}
const prodFormat = combine(
  timestamp(),       // ISO 8601 timestamp
  errors({ stack: true }),
  json()             // Serialize the entire log entry as JSON
);

// ─── Transports = where logs go ──────────────────────────────────────────────
// In development: just the console.
// In production: console (captured by Docker/PM2) + error log file as backup.
const logTransports = [
  new transports.Console(),
];

if (!isDevelopment) {
  // In production, also write error-level logs to a file.
  // Useful as a local backup if your logging service is briefly unavailable.
  logTransports.push(
    new transports.File({
      filename: path.join("logs", "error.log"),
      level: "error",      // Only write errors to this file
      maxsize: 5_242_880,  // 5MB max per file
      maxFiles: 5,         // Keep last 5 rotated files
    })
  );
}

// ─── Create the logger instance ───────────────────────────────────────────────
const logger = createLogger({
  // Log levels (low number = high priority):
  // error: 0, warn: 1, info: 2, http: 3, verbose: 4, debug: 5
  // Setting level: "info" means: log info, warn, and error. Skip debug/verbose.
  level: isDevelopment ? "debug" : "info",

  format: isDevelopment ? devFormat : prodFormat,

  transports: logTransports,

  // If Winston itself throws an error (e.g. can't write to log file),
  // don't crash the entire app — just silently ignore it.
  exitOnError: false,
});

// ─── HTTP request logger stream ───────────────────────────────────────────────
// Morgan (HTTP request logger middleware) can pipe its output through Winston.
// This means all HTTP logs share the same format and destination as app logs.
// Used in app.js: morgan('combined', { stream: logger.stream })
logger.stream = {
  write: (message) => logger.http(message.trim()),
};

module.exports = logger;