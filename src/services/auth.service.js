const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const env = require("../config/env");
const Token = require("../models/Token");

const SALT_ROUNDS = 12;

/**
 * Hash a plain-text password with bcrypt (cost factor 12)
 */
const hashPassword = async (plainPassword) => {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
};

/**
 * Compare a plain-text password against a bcrypt hash
 */
const comparePassword = async (plainPassword, hash) => {
  return bcrypt.compare(plainPassword, hash);
};

/**
 * Generate a short-lived JWT access token
 */
const generateAccessToken = (payload) => {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRY,
  });
};

/**
 * Generate a long-lived JWT refresh token
 */
const generateRefreshToken = (payload) => {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRY,
  });
};

/**
 * Verify a JWT access token
 */
const verifyAccessToken = (token) => {
  return jwt.verify(token, env.JWT_ACCESS_SECRET);
};

/**
 * Verify a JWT refresh token
 */
const verifyRefreshToken = (token) => {
  return jwt.verify(token, env.JWT_REFRESH_SECRET);
};

/**
 * Generate a cryptographically random token and its SHA-256 hash.
 * The raw token is sent to the user (e.g. in an email link);
 * only the hash is stored in the database.
 */
const generateRandomToken = () => {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  return { rawToken, tokenHash };
};

/**
 * Hash a raw token with SHA-256 (for lookup during verification)
 */
const hashToken = (rawToken) => {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
};

/**
 * Save a hashed token to the database (refresh, email_verify, or password_reset)
 */
const saveToken = async (userId, tokenHash, type, expiresInMs) => {
  // Remove any existing tokens of the same type for this user
  await Token.deleteMany({ userId, type });

  const token = await Token.create({
    userId,
    tokenHash,
    type,
    expiresAt: new Date(Date.now() + expiresInMs),
  });

  return token;
};

/**
 * Find and validate a token from the database
 */
const findValidToken = async (tokenHash, type) => {
  const token = await Token.findOne({
    tokenHash,
    type,
    expiresAt: { $gt: new Date() },
  });
  return token;
};

/**
 * Invalidate (delete) all tokens of a given type for a user
 */
const invalidateTokens = async (userId, type) => {
  await Token.deleteMany({ userId, type });
};

module.exports = {
  hashPassword,
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateRandomToken,
  hashToken,
  saveToken,
  findValidToken,
  invalidateTokens,
};
