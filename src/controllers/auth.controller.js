const User = require("../models/User");
const authService = require("../services/auth.service");
const mailService = require("../services/mail.service");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");

// ───────────────────────── REGISTER ─────────────────────────
const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw ApiError.conflict("A user with this email already exists");
  }

  // Hash password and create user
  const hashedPassword = await authService.hashPassword(password);
  const user = await User.create({
    name,
    email,
    password: hashedPassword,
  });

  // Generate email verification token
  const { rawToken, tokenHash } = authService.generateRandomToken();
  await authService.saveToken(
    user._id,
    tokenHash,
    "email_verify",
    24 * 60 * 60 * 1000 // 24 hours
  );

  // Send verification email (fire-and-forget — don't block the response)
  mailService.sendVerificationEmail(email, name, rawToken).catch(() => {});

  const userObj = user.toObject();
  delete userObj.password;

  res.status(201).json(
    ApiResponse.created(
      { user: userObj },
      "Registration successful. Please check your email to verify your account."
    )
  );
});

// ───────────────────────── VERIFY EMAIL ─────────────────────────
const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.body;

  const tokenHash = authService.hashToken(token);
  const tokenDoc = await authService.findValidToken(tokenHash, "email_verify");
  if (!tokenDoc) {
    throw ApiError.badRequest("Invalid or expired verification token");
  }

  // Mark user as verified
  await User.findByIdAndUpdate(tokenDoc.userId, { isVerified: true });

  // Clean up the used token
  await authService.invalidateTokens(tokenDoc.userId, "email_verify");

  res.json(ApiResponse.ok(null, "Email verified successfully"));
});

// ───────────────────────── LOGIN ─────────────────────────
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Find user and explicitly select the password field
  const user = await User.findOne({ email }).select("+password");
  if (!user) {
    throw ApiError.unauthorized("Invalid email or password");
  }

  // Compare password
  const isMatch = await authService.comparePassword(password, user.password);
  if (!isMatch) {
    throw ApiError.unauthorized("Invalid email or password");
  }

  if (!user.isVerified) {
    throw ApiError.forbidden(
      "Please verify your email before logging in. Check your inbox for the verification link."
    );
  }

  // Generate tokens
  const payload = { userId: user._id, role: user.role };
  const accessToken = authService.generateAccessToken(payload);
  const refreshToken = authService.generateRefreshToken(payload);

  // Save refresh token hash in DB
  const { tokenHash } = { tokenHash: authService.hashToken(refreshToken) };
  await authService.saveToken(
    user._id,
    tokenHash,
    "refresh",
    7 * 24 * 60 * 60 * 1000 // 7 days
  );

  // Set refresh token as httpOnly cookie
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  const userObj = user.toObject();
  delete userObj.password;

  res.json(
    ApiResponse.ok({
      user: userObj,
      accessToken,
    })
  );
});

// ───────────────────────── REFRESH TOKEN ─────────────────────────
const refreshAccessToken = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) {
    throw ApiError.unauthorized("Refresh token is missing");
  }

  // Verify the JWT signature
  let decoded;
  try {
    decoded = authService.verifyRefreshToken(token);
  } catch {
    throw ApiError.unauthorized("Invalid or expired refresh token");
  }

  // Check the token hash exists in DB
  const tokenHash = authService.hashToken(token);
  const tokenDoc = await authService.findValidToken(tokenHash, "refresh");
  if (!tokenDoc) {
    throw ApiError.unauthorized("Refresh token has been revoked");
  }

  // Generate a new access token
  const payload = { userId: decoded.userId, role: decoded.role };
  const newAccessToken = authService.generateAccessToken(payload);

  res.json(ApiResponse.ok({ accessToken: newAccessToken }));
});

// ───────────────────────── LOGOUT ─────────────────────────
const logout = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken;

  if (token) {
    // Invalidate the refresh token in DB
    try {
      const decoded = authService.verifyRefreshToken(token);
      await authService.invalidateTokens(decoded.userId, "refresh");
    } catch {
      // Token is invalid/expired — still clear the cookie
    }
  }

  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });

  res.json(ApiResponse.ok(null, "Logged out successfully"));
});

// ───────────────────────── FORGOT PASSWORD ─────────────────────────
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });
  // Always return success to prevent email enumeration
  if (!user) {
    return res.json(
      ApiResponse.ok(
        null,
        "If that email is registered, a password reset link has been sent."
      )
    );
  }

  const { rawToken, tokenHash } = authService.generateRandomToken();
  await authService.saveToken(
    user._id,
    tokenHash,
    "password_reset",
    60 * 60 * 1000 // 1 hour
  );

  mailService.sendPasswordResetEmail(email, user.name, rawToken).catch(() => {});

  res.json(
    ApiResponse.ok(
      null,
      "If that email is registered, a password reset link has been sent."
    )
  );
});

// ───────────────────────── RESET PASSWORD ─────────────────────────
const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;

  const tokenHash = authService.hashToken(token);
  const tokenDoc = await authService.findValidToken(tokenHash, "password_reset");
  if (!tokenDoc) {
    throw ApiError.badRequest("Invalid or expired reset token");
  }

  const hashedPassword = await authService.hashPassword(password);
  await User.findByIdAndUpdate(tokenDoc.userId, { password: hashedPassword });

  // Clean up all reset tokens and refresh tokens for this user
  await authService.invalidateTokens(tokenDoc.userId, "password_reset");
  await authService.invalidateTokens(tokenDoc.userId, "refresh");

  res.json(ApiResponse.ok(null, "Password reset successful. Please log in again."));
});

module.exports = {
  register,
  verifyEmail,
  login,
  refreshAccessToken,
  logout,
  forgotPassword,
  resetPassword,
};
