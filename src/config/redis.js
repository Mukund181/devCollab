const Redis = require("ioredis");
const env = require("./env");
const logger = require("../utils/logger");

let redisClient = null;

const connectRedis = () => {
  if (redisClient) return redisClient;

  redisClient = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      const delay = Math.min(times * 200, 2000);
      return delay;
    },
    lazyConnect: true,
  });

  redisClient.on("connect", () => {
    logger.info("Redis connected");
  });

  redisClient.on("error", (err) => {
    logger.error("Redis connection error:", err.message);
  });

  redisClient.on("close", () => {
    logger.warn("Redis connection closed");
  });

  return redisClient;
};

const getRedisClient = () => {
  if (!redisClient) {
    return connectRedis();
  }
  return redisClient;
};

module.exports = { connectRedis, getRedisClient };
