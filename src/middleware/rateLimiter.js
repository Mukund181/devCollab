const { RateLimiterRedis, RateLimiterMemory } = require("rate-limiter-flexible");
const { getRedisClient } = require("../config/redis");
const ApiError = require("../utils/ApiError");
const logger = require("../utils/logger");

let rateLimiter;

/**
 * Initialize the rate limiter.
 * Uses Redis if available, falls back to in-memory.
 */
const initRateLimiter = () => {
  try {
    const redisClient = getRedisClient();
    rateLimiter = new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix: "rl",
      points: 100, // 100 requests
      duration: 60, // per 60 seconds (per IP)
      blockDuration: 60, // block for 60 seconds if exceeded
    });
    logger.info("Rate limiter initialized with Redis backend");
  } catch (error) {
    logger.warn("Redis unavailable for rate limiter, falling back to memory");
    rateLimiter = new RateLimiterMemory({
      points: 100,
      duration: 60,
      blockDuration: 60,
    });
  }
};

/**
 * Rate limiter middleware — limits by IP address.
 */
const rateLimiterMiddleware = async (req, res, next) => {
  if (!rateLimiter) {
    initRateLimiter();
  }

  try {
    const key = req.ip;
    await rateLimiter.consume(key);
    next();
  } catch (rateLimiterRes) {
    if (rateLimiterRes instanceof Error) {
      // Actual error (not a rate limit hit)
      return next(rateLimiterRes);
    }
    // Rate limit exceeded
    const retryAfter = Math.ceil(rateLimiterRes.msBeforeNext / 1000);
    res.set("Retry-After", String(retryAfter));
    next(ApiError.tooManyRequests());
  }
};

module.exports = rateLimiterMiddleware;
