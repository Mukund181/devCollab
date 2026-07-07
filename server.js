const http = require("http");
const app = require("./src/app");
const connectDB = require("./src/config/db");
const { connectRedis } = require("./src/config/redis");
const initializeSocket = require("./src/sockets");
const env = require("./src/config/env");
const logger = require("./src/utils/logger");

const PORT = env.PORT || 5000;

// Create HTTP server from the Express app
const server = http.createServer(app);

// Initialize Socket.io on the same HTTP server
const io = initializeSocket(server);

// Make io accessible from req if needed
app.set("io", io);

const startServer = async () => {
  try {
    // 1. Connect to MongoDB
    await connectDB();

    // 2. Connect to Redis (non-blocking — app works without it)
    try {
      const redisClient = connectRedis();
      await redisClient.connect();
    } catch (redisErr) {
      logger.warn("Redis connection failed — running without cache/rate-limiting:", redisErr.message);
    }

    // 3. Start listening
    server.listen(PORT, () => {
      logger.info(`🚀 DevCollab server running on port ${PORT} [${env.NODE_ENV}]`);
      logger.info(`   REST API : http://localhost:${PORT}/api/v1`);
      logger.info(`   Health   : http://localhost:${PORT}/api/v1/health`);
      logger.info(`   WebSocket: ws://localhost:${PORT}`);
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
};

// ───────────── Graceful Shutdown ─────────────
const shutdown = (signal) => {
  logger.info(`${signal} received — shutting down gracefully...`);
  server.close(() => {
    logger.info("HTTP server closed");
    process.exit(0);
  });

  // Force exit if graceful shutdown takes too long
  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Catch unhandled rejections/exceptions
process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled Rejection:", reason);
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", error);
  process.exit(1);
});

startServer();
