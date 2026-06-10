/**
 * server.js — Entry point for SafeHire AI backend
 *
 * PATTERN: We separate the Express "app" object from the HTTP server.
 * - `app`    is the configured Express application (imported by tests without starting a port)
 * - `server` is the actual HTTP server that binds to a port (only started here)
 *
 * This distinction matters because:
 *   1. Tests import `app` directly — no port binding, no conflicts
 *   2. Graceful shutdown only lives here — tests don't need it
 *   3. Clustering (worker processes) each call listen() on their own — they all share the same app config
 */

"use strict";

const http = require("http");
const app = require("./src/app");         // Express app config lives in src/app.js
const connectDB = require("./src/config/db");
const logger = require("./src/utils/logger");
const { validateEnv } = require("./src/config/env");

// ─── Step 1: Validate environment variables before doing anything else ────────
// If PORT, MONGO_URI, or JWT_SECRET are missing, crash immediately with a clear
// error rather than failing silently at runtime. validateEnv throws if anything
// is missing or malformed.
validateEnv();

const PORT = process.env.PORT || 5000;

// ─── Step 2: Create the HTTP server ──────────────────────────────────────────
// We wrap Express in a raw http.Server so we can:
//   - Handle WebSocket upgrades later (real-time threat alerts)
//   - Control keep-alive timeout explicitly
//   - Access the server reference for graceful shutdown
const server = http.createServer(app);

// Increase keep-alive timeout slightly above typical load balancer idle timeout
// (e.g. AWS ALB defaults to 60s). This prevents premature connection drops.
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

// ─── Step 3: Connect to MongoDB, then start listening ────────────────────────
// We connect to the DB BEFORE starting the server. If the DB is unavailable,
// the server never starts — better to fail fast than serve requests that will
// all fail at the repository layer.
connectDB()
  .then(() => {
    server.listen(PORT, () => {
      logger.info(`SafeHire API running on port ${PORT} [${process.env.NODE_ENV}]`);
    });
  })
  .catch((err) => {
    // DB connection failed — log and exit. PM2/Kubernetes will restart the process.
    logger.error("Failed to connect to MongoDB. Server not started.", { error: err.message });
    process.exit(1);
  });

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
// INTERVIEW CONCEPT: Graceful shutdown prevents dropped requests on deploys.
//
// Without this: When Kubernetes sends SIGTERM to deploy a new version, Node
// exits immediately. Any in-flight requests (AI analysis calls, file uploads)
// are dropped. Users see 503 errors.
//
// With this:
//   1. Stop accepting NEW connections immediately (server.close)
//   2. Wait for existing connections to finish (up to 10 seconds)
//   3. Close the DB connection cleanly
//   4. Exit with code 0 (clean exit)
//
// PM2, Docker, and Kubernetes all send SIGTERM before killing a process.
// SIGINT is Ctrl+C in development.

const gracefulShutdown = (signal) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  // Stop accepting new connections
  server.close(async () => {
    logger.info("HTTP server closed. No new connections accepted.");

    try {
      // Close MongoDB connection pool cleanly
      const mongoose = require("mongoose");
      await mongoose.connection.close(false);
      logger.info("MongoDB connection closed.");
      process.exit(0);
    } catch (err) {
      logger.error("Error during shutdown cleanup:", { error: err.message });
      process.exit(1);
    }
  });

  // Force shutdown after 10 seconds if connections don't drain
  // (e.g. a long-running AI call that's stuck)
  setTimeout(() => {
    logger.error("Forced shutdown: connections did not drain within 10s.");
    process.exit(1);
  }, 10_000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM")); // Kubernetes / Docker stop
process.on("SIGINT", () => gracefulShutdown("SIGINT"));   // Ctrl+C in development

// ─── Unhandled Rejection & Exception Guards ───────────────────────────────────
// INTERVIEW CONCEPT: In production, unhandled promise rejections are silent bugs.
// Before Node 15, they were just warnings. From Node 15+, they crash the process.
// We explicitly handle them here to log them properly before crashing.

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Promise Rejection — shutting down.", {
    reason: reason?.message || reason,
    promise,
  });
  // Trigger graceful shutdown so in-flight requests finish
  gracefulShutdown("UNHANDLED_REJECTION");
});

process.on("uncaughtException", (err) => {
  // An uncaughtException means the process is in an undefined state.
  // The only safe action is to log and exit. Let the process manager restart.
  logger.error("Uncaught Exception — shutting down immediately.", {
    error: err.message,
    stack: err.stack,
  });
  process.exit(1);
});

module.exports = server;