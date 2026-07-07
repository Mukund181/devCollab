const ApiError = require("../utils/ApiError");

/**
 * Role-based authorization middleware factory.
 * Usage: authorize("admin", "user") — allows only those roles.
 * Must be placed AFTER authenticate middleware (depends on req.user).
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized("Authentication required"));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        ApiError.forbidden(
          `Role '${req.user.role}' is not authorized to access this resource`
        )
      );
    }

    next();
  };
};

module.exports = authorize;
