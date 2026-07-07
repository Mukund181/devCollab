const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: { type: String, required: true, maxlength: 500 },
  },
  { timestamps: true }
);

const postSchema = new mongoose.Schema(
  {
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
      index: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: { type: String, required: true, maxlength: 2000 },
    attachments: [
      {
        url: String,
        publicId: String,
        fileType: String,
      },
    ],
    comments: { type: [commentSchema], default: [] },
  },
  { timestamps: true }
);

// Fast "latest posts in room" queries
postSchema.index({ room: 1, createdAt: -1 });

module.exports = mongoose.model("Post", postSchema);
