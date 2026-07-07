const express = require("express");
const router = express.Router();

const authRoutes = require("./auth.routes");
const userRoutes = require("./user.routes");
const roomRoutes = require("./room.routes");
const postRoutes = require("./post.routes");

// Mount all routers on /api/v1
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/rooms", roomRoutes);
router.use("/rooms", postRoutes); // posts are scoped under rooms

// Health check endpoint
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "DevCollab API is running",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

module.exports = router;
