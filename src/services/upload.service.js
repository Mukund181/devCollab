const multer = require("multer");
const cloudinary = require("../config/cloudinary");
const ApiError = require("../utils/ApiError");

// Multer configured to use memory storage (buffer) — no disk writes
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
    "text/plain",
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(ApiError.badRequest(`File type '${file.mimetype}' is not allowed`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB max per file
    files: 5, // max 5 files per request
  },
});

/**
 * Upload a single buffer to Cloudinary
 * @param {Buffer} fileBuffer - The file buffer from multer
 * @param {string} folder - Cloudinary folder name
 * @returns {Promise<{url: string, publicId: string, fileType: string}>}
 */
const uploadToCloudinary = (fileBuffer, folder = "devcollab") => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "auto",
      },
      (error, result) => {
        if (error) {
          return reject(ApiError.internal("Cloudinary upload failed"));
        }
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          fileType: result.resource_type,
        });
      }
    );
    stream.end(fileBuffer);
  });
};

/**
 * Delete a file from Cloudinary by its public ID
 */
const deleteFromCloudinary = async (publicId) => {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    // Log but don't throw — deletion failure shouldn't break the request
    console.error(`Failed to delete Cloudinary asset ${publicId}:`, error);
  }
};

module.exports = {
  upload,
  uploadToCloudinary,
  deleteFromCloudinary,
};
