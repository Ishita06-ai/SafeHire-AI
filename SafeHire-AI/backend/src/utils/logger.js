/**
 * src/utils/logger.js — Centralized logging utility
 *
 * WHY THIS FILE EXISTS:
 * One centralized place that handles connecting to MongoDB,
 * retrying on failure, pooling connections, and logging DB events.
 * No other file should ever call mongoose.connect() directly.
 */

"use strict";

const mongoose = require("mongoose");
const logger = require("./logger");

// ─── Connection options ───────────────────────────────────────────────────────
// Tuning knobs for the connection pool.
const MONGO_OPTIONS = {
  maxPoolSize: 10,          // Keep 10 reusable connections open (like 10 waiters on staff)
  serverSelectionTimeoutMS: 5_000,  // Give up finding a MongoDB server after 5s
  socketTimeoutMS: 45_000,          // Close socket if no response for 45s
  family: 4,                        // Use IPv4 — avoids IPv6 DNS lookup delays
};

// ─── Retry config ─────────────────────────────────────────────────────────────
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3_000; // Wait 3 seconds between each retry attempt

// ─── Main connect function ────────────────────────────────────────────────────
// Called once in server.js before the HTTP server starts listening.
// If MongoDB is unavailable, we retry up to MAX_RETRIES times before giving up.
const connectDB = async (retryCount = 0) => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, MONGO_OPTIONS);
    logger.info(`MongoDB connected: ${conn.connection.host}`);

    // Attach event listeners AFTER first successful connection.
    // These fire if the connection drops while the app is running.
    setupConnectionEvents();

  } catch (err) {
    logger.error(`MongoDB connection failed (attempt ${retryCount + 1}/${MAX_RETRIES})`, {
      error: err.message,
    });

    if (retryCount < MAX_RETRIES - 1) {
      logger.info(`Retrying in ${RETRY_DELAY_MS / 1000}s...`);
      // Wait, then retry — the retryCount increments each time
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      return connectDB(retryCount + 1);
    }

    // All retries exhausted — throw so server.js can catch it and exit cleanly
    throw new Error(`Could not connect to MongoDB after ${MAX_RETRIES} attempts.`);
  }
};

// ─── Connection event listeners ───────────────────────────────────────────────
// WHY: MongoDB can disconnect mid-runtime (network blip, Atlas maintenance).
// Mongoose auto-reconnects, but we want logs so we can debug/alert in production.
const setupConnectionEvents = () => {
  mongoose.connection.on("disconnected", () => {
    logger.warn("MongoDB disconnected. Mongoose will auto-reconnect...");
  });

  mongoose.connection.on("reconnected", () => {
    logger.info("MongoDB reconnected successfully.");
  });

  mongoose.connection.on("error", (err) => {
    logger.error("MongoDB runtime error:", { error: err.message });
  });
};

module.exports = connectDB;