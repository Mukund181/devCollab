const morgan = require("morgan");
const logger = require("../utils/logger");

// Morgan writes to Winston's stream so all logs go through one system
const stream = {
  write: (message) => {
    logger.info(message.trim());
  },
};

const requestLogger = morgan(
  ":method :url :status :res[content-length] - :response-time ms",
  { stream }
);

module.exports = requestLogger;
