const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const validate = require("../middleware/validate");
const {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} = require("../validators/auth.validator");

router.post("/register", validate(registerSchema), authController.register);
router.post("/verify-email", validate(verifyEmailSchema), authController.verifyEmail);
router.post("/login", validate(loginSchema), authController.login);
router.post("/refresh-token", authController.refreshAccessToken);
router.post("/logout", authController.logout);
router.post("/forgot-password", validate(forgotPasswordSchema), authController.forgotPassword);
router.post("/reset-password", validate(resetPasswordSchema), authController.resetPassword);

module.exports = router;
