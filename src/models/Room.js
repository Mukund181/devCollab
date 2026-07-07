const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, maxlength: 300 },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    members: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        role: {
          type: String,
          enum: ["admin", "member"],
          default: "member",
        },
        joinedAt: { type: Date, default: Date.now },
      },
    ],
    isPrivate: { type: Boolean, default: false },
  },
  { timestamps: true }
);

roomSchema.index({ owner: 1 });
roomSchema.index({ "members.user": 1 });

module.exports = mongoose.model("Room", roomSchema);
