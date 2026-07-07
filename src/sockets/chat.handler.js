const Message = require("../models/Message");
const Room = require("../models/Room");
const logger = require("../utils/logger");

/**
 * Chat event handler — registers all chat-related events on a socket.
 * Events:
 *   - join_room: join a socket.io room (and broadcast presence)
 *   - leave_room: leave a socket.io room
 *   - send_message: send a chat message (persisted to DB + broadcast)
 *   - typing: broadcast typing indicator to room
 *   - stop_typing: broadcast stop-typing indicator
 *   - get_messages: fetch paginated chat history for a room
 */
const chatHandler = (io, socket) => {
  // ── JOIN ROOM ──
  socket.on("join_room", async (roomId) => {
    try {
      const room = await Room.findById(roomId);
      if (!room) {
        return socket.emit("error", { message: "Room not found" });
      }

      // Verify membership
      const isMember = room.members.some(
        (m) => m.user.toString() === socket.user._id.toString()
      );
      if (!isMember) {
        return socket.emit("error", { message: "You are not a member of this room" });
      }

      socket.join(roomId);
      logger.info(`${socket.user.name} joined room ${roomId}`);

      // Broadcast to others in the room
      socket.to(roomId).emit("user_joined", {
        userId: socket.user._id,
        name: socket.user.name,
        avatarUrl: socket.user.avatarUrl,
        timestamp: new Date(),
      });

      // Send online users in this room
      const roomSockets = await io.in(roomId).fetchSockets();
      const onlineUsers = roomSockets.map((s) => ({
        userId: s.user._id,
        name: s.user.name,
        avatarUrl: s.user.avatarUrl,
      }));

      socket.emit("online_users", onlineUsers);
    } catch (error) {
      logger.error(`join_room error: ${error.message}`);
      socket.emit("error", { message: "Failed to join room" });
    }
  });

  // ── LEAVE ROOM ──
  socket.on("leave_room", (roomId) => {
    socket.leave(roomId);
    logger.info(`${socket.user.name} left room ${roomId}`);

    socket.to(roomId).emit("user_left", {
      userId: socket.user._id,
      name: socket.user.name,
      timestamp: new Date(),
    });
  });

  // ── SEND MESSAGE ──
  socket.on("send_message", async ({ roomId, text }) => {
    try {
      if (!text || !text.trim()) {
        return socket.emit("error", { message: "Message text is required" });
      }

      // Persist to MongoDB
      const message = await Message.create({
        room: roomId,
        sender: socket.user._id,
        text: text.trim(),
      });

      const populatedMessage = await Message.findById(message._id)
        .populate("sender", "name email avatarUrl")
        .lean();

      // Broadcast to ALL users in the room (including sender)
      io.in(roomId).emit("new_message", populatedMessage);

      logger.info(`Message sent by ${socket.user.name} in room ${roomId}`);
    } catch (error) {
      logger.error(`send_message error: ${error.message}`);
      socket.emit("error", { message: "Failed to send message" });
    }
  });

  // ── TYPING INDICATOR ──
  socket.on("typing", (roomId) => {
    socket.to(roomId).emit("user_typing", {
      userId: socket.user._id,
      name: socket.user.name,
    });
  });

  socket.on("stop_typing", (roomId) => {
    socket.to(roomId).emit("user_stop_typing", {
      userId: socket.user._id,
      name: socket.user.name,
    });
  });

  // ── GET CHAT HISTORY (paginated) ──
  socket.on("get_messages", async ({ roomId, before, limit = 50 }) => {
    try {
      const query = { room: roomId };
      if (before) {
        query.createdAt = { $lt: new Date(before) };
      }

      const messages = await Message.find(query)
        .populate("sender", "name email avatarUrl")
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      // Return in chronological order
      socket.emit("message_history", {
        roomId,
        messages: messages.reverse(),
        hasMore: messages.length === limit,
      });
    } catch (error) {
      logger.error(`get_messages error: ${error.message}`);
      socket.emit("error", { message: "Failed to fetch messages" });
    }
  });

  // ── DISCONNECT ──
  socket.on("disconnect", () => {
    logger.info(`Socket disconnected: ${socket.user.name} (${socket.user._id})`);

    // Broadcast to all rooms this socket was in
    for (const roomId of socket.rooms) {
      if (roomId !== socket.id) {
        socket.to(roomId).emit("user_left", {
          userId: socket.user._id,
          name: socket.user.name,
          timestamp: new Date(),
        });
      }
    }
  });
};

module.exports = chatHandler;
