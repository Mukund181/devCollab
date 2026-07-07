const { getRedisClient } = require("../config/redis");
const logger = require("../utils/logger");

const DEFAULT_TTL = 300; // 5 minutes in seconds

/**
 * Get a cached value by key.
 * Returns parsed JSON or null if key doesn't exist / Redis is unavailable.
 */
const getCache = async (key) => {
  try {
    const client = getRedisClient();
    const data = await client.get(key);
    if (!data) return null;
    return JSON.parse(data);
  } catch (error) {
    logger.warn(`Redis GET failed for key '${key}':`, error.message);
    return null; // graceful degradation — app works without cache
  }
};

/**
 * Set a cached value with optional TTL (seconds).
 */
const setCache = async (key, value, ttl = DEFAULT_TTL) => {
  try {
    const client = getRedisClient();
    await client.set(key, JSON.stringify(value), "EX", ttl);
  } catch (error) {
    logger.warn(`Redis SET failed for key '${key}':`, error.message);
  }
};

/**
 * Delete a cached key (cache invalidation).
 */
const deleteCache = async (key) => {
  try {
    const client = getRedisClient();
    await client.del(key);
  } catch (error) {
    logger.warn(`Redis DEL failed for key '${key}':`, error.message);
  }
};

/**
 * Delete all keys matching a pattern (e.g. "rooms:*").
 * Uses SCAN to avoid blocking Redis with KEYS.
 */
const deleteCachePattern = async (pattern) => {
  try {
    const client = getRedisClient();
    let cursor = "0";
    do {
      const [nextCursor, keys] = await client.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await client.del(...keys);
      }
    } while (cursor !== "0");
  } catch (error) {
    logger.warn(`Redis pattern delete failed for '${pattern}':`, error.message);
  }
};

module.exports = {
  getCache,
  setCache,
  deleteCache,
  deleteCachePattern,
};
