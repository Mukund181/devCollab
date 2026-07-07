const ApiError = require("../utils/ApiError");

/**
 * Generic Zod validation middleware.
 * Usage: validate(schema) — validates req.body against the given Zod schema.
 * On failure, throws a 400 ApiError with structured error messages.
 */
const validate = (schema) => {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const errors = result.error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));
      throw ApiError.badRequest("Validation failed", errors);
    }

    // Replace req.body with the parsed (and coerced/trimmed) data
    req.body = result.data;
    next();
  };
};

module.exports = validate;
