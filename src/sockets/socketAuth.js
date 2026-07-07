const { verifyAccessToken } = require("../services/auth.service");
const User = require("../models/User");
const logger = require("../utils/logger");

/**
 * Socket.io authentication middleware.
 * Verifies the JWT sent in the handshake auth object.
 * On success, attaches the user document to socket.user.
 */
const socketAuth = async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error("Authentication error: Token missing"));
    }

    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return next(new Error("Authentication error: User not found"));
    }

    if (!user.isVerified) {
      return next(new Error("Authentication error: Email not verified"));
    }

    // Attach user to the socket instance for use in event handlers
    socket.user = user;
    logger.info(`Socket authenticated: ${user.name} (${user._id})`);
    next();
  } catch (error) {
    logger.warn(`Socket auth failed: ${error.message}`);
    next(new Error("Authentication error: Invalid token"));
  }
};

module.exports = socketAuth;
