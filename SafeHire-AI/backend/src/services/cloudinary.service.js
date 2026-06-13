
"use strict";

const cloudinary = require("cloudinary").v2;
const logger = require("../utils/logger");

// Configure once — uses env vars
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

class CloudinaryService {

  // Upload a buffer (file in memory) to Cloudinary
  // Returns: { url, publicId }
  async uploadBuffer(buffer, options = {}) {
    return new Promise((resolve, reject) => {
      const uploadOptions = {
        folder: options.folder || "safehire",      // Organizes files in Cloudinary dashboard
        resource_type: options.resourceType || "auto", // auto = image/video/raw
        allowed_formats: options.allowedFormats,
        transformation: options.transformation,
      };

      // Cloudinary's upload_stream accepts a buffer directly
      // No need to save file to disk first — memory efficient
      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            logger.error("Cloudinary upload failed", { error: error.message });
            return reject(error);
          }
          resolve({
            url: result.secure_url,      // HTTPS URL — always use secure_url
            publicId: result.public_id,  // Needed for deletion later
            format: result.format,
            bytes: result.bytes,
          });
        }
      );

      uploadStream.end(buffer); // Send buffer to stream
    });
  }

  // Delete a file from Cloudinary by its publicId
  // Called when user deletes an analysis
  async deleteFile(publicId, resourceType = "image") {
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
      logger.info("Cloudinary file deleted", { publicId });
    } catch (err) {
      // Log but don't throw — file deletion failure shouldn't break the user flow
      logger.error("Cloudinary deletion failed", { publicId, error: err.message });
    }
  }
}

module.exports = new CloudinaryService();