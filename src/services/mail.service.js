const nodemailer = require("nodemailer");
const env = require("../config/env");
const logger = require("../utils/logger");

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: parseInt(env.SMTP_PORT, 10),
  secure: false, // true for 465, false for other ports (587 uses STARTTLS)
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

/**
 * Send an email verification link
 */
const sendVerificationEmail = async (toEmail, userName, token) => {
  const verifyUrl = `${env.CLIENT_URL}/verify-email?token=${token}`;

  const mailOptions = {
    from: `"DevCollab" <${env.SMTP_USER}>`,
    to: toEmail,
    subject: "Verify your DevCollab account",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Welcome to DevCollab, ${userName}!</h2>
        <p>Please verify your email address by clicking the button below:</p>
        <a href="${verifyUrl}"
           style="display: inline-block; padding: 12px 24px; background-color: #2563eb;
                  color: #ffffff; text-decoration: none; border-radius: 6px; margin: 16px 0;">
          Verify Email
        </a>
        <p style="color: #6b7280; font-size: 14px;">
          Or copy this link into your browser:<br/>
          <a href="${verifyUrl}">${verifyUrl}</a>
        </p>
        <p style="color: #9ca3af; font-size: 12px;">
          This link expires in 24 hours. If you did not create an account, ignore this email.
        </p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info(`Verification email sent to ${toEmail}`);
  } catch (error) {
    logger.error(`Failed to send verification email to ${toEmail}:`, error);
    throw error;
  }
};

/**
 * Send a password reset link
 */
const sendPasswordResetEmail = async (toEmail, userName, token) => {
  const resetUrl = `${env.CLIENT_URL}/reset-password?token=${token}`;

  const mailOptions = {
    from: `"DevCollab" <${env.SMTP_USER}>`,
    to: toEmail,
    subject: "Reset your DevCollab password",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Password Reset Request</h2>
        <p>Hi ${userName}, we received a request to reset your password.</p>
        <a href="${resetUrl}"
           style="display: inline-block; padding: 12px 24px; background-color: #dc2626;
                  color: #ffffff; text-decoration: none; border-radius: 6px; margin: 16px 0;">
          Reset Password
        </a>
        <p style="color: #6b7280; font-size: 14px;">
          Or copy this link into your browser:<br/>
          <a href="${resetUrl}">${resetUrl}</a>
        </p>
        <p style="color: #9ca3af; font-size: 12px;">
          This link expires in 1 hour. If you did not request a password reset, ignore this email.
        </p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info(`Password reset email sent to ${toEmail}`);
  } catch (error) {
    logger.error(`Failed to send password reset email to ${toEmail}:`, error);
    throw error;
  }
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
};
