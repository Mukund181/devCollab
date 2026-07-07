const { createLogger, format, transports } = require("winston");

const logger = createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format: format.combine(
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    format.errors({ stack: true }),
    format.json()
  ),
  defaultMeta: { service: "devcollab-api" },
  transports: [
    // Write errors to a dedicated file
    new transports.File({ filename: "logs/error.log", level: "error" }),
    // Write all logs to combined.log
    new transports.File({ filename: "logs/combined.log" }),
  ],
});

// In development, also log colorized output to the console
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf(({ level, message, timestamp, stack }) => {
          return stack
            ? `${timestamp} ${level}: ${message}\n${stack}`
            : `${timestamp} ${level}: ${message}`;
        })
      ),
    })
  );
}

module.exports = logger;
