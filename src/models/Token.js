const mongoose = require("mongoose");

const tokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    tokenHash: { type: String, required: true }, // sha256 of the raw token — never store raw
    type: {
      type: String,
      enum: ["refresh", "email_verify", "password_reset"],
      required: true,
    },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// TTL index — MongoDB auto-deletes the document once expiresAt passes
tokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
tokenSchema.index({ userId: 1, type: 1 });

module.exports = mongoose.model("Token", tokenSchema);
