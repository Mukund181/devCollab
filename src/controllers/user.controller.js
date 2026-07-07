const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const { getCache, setCache, deleteCache } = require("../services/cache.service");
const { uploadToCloudinary } = require("../services/upload.service");

// ───────────────────────── GET MY PROFILE ─────────────────────────
const getMyProfile = asyncHandler(async (req, res) => {
  const cacheKey = `user:${req.user._id}`;
  const cached = await getCache(cacheKey);
  if (cached) {
    return res.json(ApiResponse.ok(cached, "Profile fetched (cached)"));
  }

  const user = await User.findById(req.user._id).populate("rooms", "name description");
  if (!user) {
    throw ApiError.notFound("User not found");
  }

  await setCache(cacheKey, user, 300); // cache for 5 minutes
  res.json(ApiResponse.ok(user));
});

// ───────────────────────── GET USER BY ID ─────────────────────────
const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select("-rooms");
  if (!user) {
    throw ApiError.notFound("User not found");
  }
  res.json(ApiResponse.ok(user));
});

// ───────────────────────── UPDATE PROFILE ─────────────────────────
const updateProfile = asyncHandler(async (req, res) => {
  const allowedFields = ["name"];
  const updates = {};

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }

  const user = await User.findByIdAndUpdate(req.user._id, updates, {
    new: true,
    runValidators: true,
  });

  // Invalidate profile cache
  await deleteCache(`user:${req.user._id}`);

  res.json(ApiResponse.ok(user, "Profile updated"));
});

// ───────────────────────── UPDATE AVATAR ─────────────────────────
const updateAvatar = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw ApiError.badRequest("No image file provided");
  }

  const result = await uploadToCloudinary(req.file.buffer, "devcollab/avatars");

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { avatarUrl: result.url },
    { new: true }
  );

  await deleteCache(`user:${req.user._id}`);

  res.json(ApiResponse.ok(user, "Avatar updated"));
});

module.exports = {
  getMyProfile,
  getUserById,
  updateProfile,
  updateAvatar,
};
