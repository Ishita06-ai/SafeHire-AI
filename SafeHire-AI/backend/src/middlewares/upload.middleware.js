/**
 * middlewares/upload.middleware.js — Multer file upload config
 *
 * WHY MEMORY STORAGE (not disk):
 * diskStorage saves files to the server filesystem.
 * On cloud platforms (Render, Railway, Heroku) the filesystem resets on deploy.
 * memoryStorage keeps files in RAM as Buffer — we immediately upload to Cloudinary
 * then discard the buffer. No filesystem dependency.
 *
 * WHY CENTRALIZED:
 * Multiple routes need file uploads (screenshots, audio, PDFs).
 * One place defines allowed types and size limits for each.
 */

"use strict";

const multer = require("multer");
const ApiError = require("../utils/ApiError");

// Keep files in memory as Buffer — no disk writes
const storage = multer.memoryStorage();

// ─── File type validators ──────────────────────────────────────────────────────
const imageFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);   // Accept file
  } else {
    cb(ApiError.badRequest("Only JPEG, PNG, WEBP and GIF images are allowed"), false);
  }
};

const audioFilter = (req, file, cb) => {
  const allowed = ["audio/mpeg", "audio/wav", "audio/mp4", "audio/ogg", "audio/webm"];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(ApiError.badRequest("Only MP3, WAV, MP4, OGG and WEBM audio files are allowed"), false);
  }
};

const documentFilter = (req, file, cb) => {
  const allowed = ["application/pdf"];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(ApiError.badRequest("Only PDF files are allowed"), false);
  }
};

// ─── Upload instances for each file type ──────────────────────────────────────
// Each has its own size limit and file type filter

// Screenshot uploads — max 10MB
const uploadImage = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Audio uploads — max 25MB (audio files are larger)
const uploadAudio = multer({
  storage,
  fileFilter: audioFilter,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
});

// Document uploads — max 5MB
const uploadDocument = multer({
  storage,
  fileFilter: documentFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// ─── Export ready-to-use middleware ───────────────────────────────────────────
// .single("screenshot") = expect one file with field name "screenshot"
// Field name must match what the frontend sends in FormData
module.exports = {
  uploadScreenshot: uploadImage.single("screenshot"),
  uploadAudio: uploadAudio.single("audio"),
  uploadDocument: uploadDocument.single("document"),
};