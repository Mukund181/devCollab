const { Server } = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const { getRedisClient } = require("../config/redis");
const socketAuth = require("./socketAuth");
const chatHandler = require("./chat.handler");
const logger = require("../utils/logger");
const env = require("../config/env");

/**
 * Initialize Socket.io on the given HTTP server.
 * Sets up:
 *   1. CORS configuration
 *   2. Redis adapter for horizontal scaling (multiple Node.js instances)
 *   3. JWT authentication middleware on the socket handshake
 *   4. Chat event handlers
 */
const initializeSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: env.CLIENT_URL,
      methods: ["GET", "POST"],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Try to attach Redis adapter for horizontal scaling
  try {
    const pubClient = getRedisClient();
    const subClient = pubClient.duplicate();

    io.adapter(createAdapter(pubClient, subClient));
    logger.info("Socket.io Redis adapter attached");
  } catch (error) {
    logger.warn(
      "Socket.io running without Redis adapter — single-instance only:",
      error.message
    );
  }

  // Authentication middleware
  io.use(socketAuth);

  // Connection handler
  io.on("connection", (socket) => {
    logger.info(`New socket connection: ${socket.user.name} (${socket.id})`);

    // Register chat event handlers
    chatHandler(io, socket);
  });

  return io;
};

module.exports = initializeSocket;
