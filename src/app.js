const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const requestLogger = require("./middleware/requestLogger");
const rateLimiter = require("./middleware/rateLimiter");
const errorHandler = require("./middleware/errorHandler");
const routes = require("./routes");
const env = require("./config/env");
const ApiError = require("./utils/ApiError");

const app = express();

// ───────────── Security Headers ─────────────
app.set("trust proxy", 1);
app.use(helmet());

// ───────────── CORS ─────────────
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ───────────── Body Parsing ─────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ───────────── Cookie Parsing ─────────────
app.use(cookieParser());

// ───────────── Request Logging ─────────────
app.use(requestLogger);

// ───────────── Rate Limiting ─────────────
app.use(rateLimiter);

// ───────────── API Routes ─────────────
app.use("/api/v1", routes);

// ───────────── 404 Handler ─────────────
app.use((req, res, next) => {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
});

// ───────────── Centralized Error Handler ─────────────
app.use(errorHandler);

module.exports = app;
