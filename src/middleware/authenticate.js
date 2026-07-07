const { verifyAccessToken } = require("../services/auth.service");
const ApiError = require("../utils/ApiError");
const User = require("../models/User");

/**
 * Authentication middleware.
 * Extracts the JWT from the Authorization header (Bearer <token>),
 * verifies it, and attaches the user document to req.user.
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw ApiError.unauthorized("Access token is missing");
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyAccessToken(token);

    const user = await User.findById(decoded.userId);
    if (!user) {
      throw ApiError.unauthorized("User no longer exists");
    }

    if (!user.isVerified) {
      throw ApiError.forbidden("Please verify your email before accessing this resource");
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof ApiError) {
      return next(error);
    }
    // JWT verification errors (expired, malformed, etc.)
    next(ApiError.unauthorized("Invalid or expired access token"));
  }
};

module.exports = authenticate;
