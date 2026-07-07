/**
 * Wraps an async route handler so that any rejected promise
 * is automatically forwarded to Express's next(err) instead
 * of crashing the process with an unhandled rejection.
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = asyncHandler;
