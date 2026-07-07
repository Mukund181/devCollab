const Post = require("../models/Post");
const Room = require("../models/Room");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const { uploadToCloudinary, deleteFromCloudinary } = require("../services/upload.service");

// ───────────────────────── CREATE POST ─────────────────────────
const createPost = asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const { content } = req.body;

  // Verify room exists and user is a member
  const room = await Room.findById(roomId);
  if (!room) {
    throw ApiError.notFound("Room not found");
  }

  const isMember = room.members.some(
    (m) => m.user.toString() === req.user._id.toString()
  );
  if (!isMember) {
    throw ApiError.forbidden("You must be a member of this room to post");
  }

  // Handle file attachments
  let attachments = [];
  if (req.files && req.files.length > 0) {
    const uploadPromises = req.files.map((file) =>
      uploadToCloudinary(file.buffer, `devcollab/rooms/${roomId}`)
    );
    attachments = await Promise.all(uploadPromises);
  }

  const post = await Post.create({
    room: roomId,
    author: req.user._id,
    content,
    attachments,
  });

  await post.populate("author", "name email avatarUrl");

  res.status(201).json(ApiResponse.created(post));
});

// ───────────────────────── GET POSTS IN ROOM ─────────────────────────
const getPostsByRoom = asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  // Verify room exists
  const room = await Room.findById(roomId);
  if (!room) {
    throw ApiError.notFound("Room not found");
  }

  // Private room check
  if (room.isPrivate) {
    const isMember = room.members.some(
      (m) => m.user.toString() === req.user._id.toString()
    );
    if (!isMember) {
      throw ApiError.forbidden("You are not a member of this private room");
    }
  }

  const [posts, total] = await Promise.all([
    Post.find({ room: roomId })
      .populate("author", "name email avatarUrl")
      .populate("comments.author", "name email avatarUrl")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Post.countDocuments({ room: roomId }),
  ]);

  res.json(
    ApiResponse.ok({
      posts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  );
});

// ───────────────────────── GET POST BY ID ─────────────────────────
const getPostById = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id)
    .populate("author", "name email avatarUrl")
    .populate("comments.author", "name email avatarUrl");

  if (!post) {
    throw ApiError.notFound("Post not found");
  }

  res.json(ApiResponse.ok(post));
});

// ───────────────────────── UPDATE POST ─────────────────────────
const updatePost = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) {
    throw ApiError.notFound("Post not found");
  }

  // Only the author can update their post
  if (post.author.toString() !== req.user._id.toString()) {
    throw ApiError.forbidden("You can only edit your own posts");
  }

  if (req.body.content !== undefined) {
    post.content = req.body.content;
  }

  await post.save();
  await post.populate("author", "name email avatarUrl");

  res.json(ApiResponse.ok(post, "Post updated"));
});

// ───────────────────────── DELETE POST ─────────────────────────
const deletePost = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) {
    throw ApiError.notFound("Post not found");
  }

  // Author or room admin/owner can delete
  const isAuthor = post.author.toString() === req.user._id.toString();
  let isRoomAdmin = false;

  if (!isAuthor) {
    const room = await Room.findById(post.room);
    if (room) {
      isRoomAdmin =
        room.owner.toString() === req.user._id.toString() ||
        room.members.some(
          (m) =>
            m.user.toString() === req.user._id.toString() &&
            m.role === "admin"
        );
    }
  }

  if (!isAuthor && !isRoomAdmin) {
    throw ApiError.forbidden("You can only delete your own posts or posts in rooms you admin");
  }

  // Delete attachments from Cloudinary
  if (post.attachments && post.attachments.length > 0) {
    for (const attachment of post.attachments) {
      if (attachment.publicId) {
        await deleteFromCloudinary(attachment.publicId);
      }
    }
  }

  await Post.findByIdAndDelete(req.params.id);
  res.json(ApiResponse.ok(null, "Post deleted"));
});

// ───────────────────────── ADD COMMENT ─────────────────────────
const addComment = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) {
    throw ApiError.notFound("Post not found");
  }

  const { text } = req.body;
  if (!text || !text.trim()) {
    throw ApiError.badRequest("Comment text is required");
  }

  post.comments.push({
    author: req.user._id,
    text: text.trim(),
  });

  await post.save();
  await post.populate("comments.author", "name email avatarUrl");

  res.status(201).json(ApiResponse.created(post, "Comment added"));
});

// ───────────────────────── DELETE COMMENT ─────────────────────────
const deleteComment = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.postId);
  if (!post) {
    throw ApiError.notFound("Post not found");
  }

  const comment = post.comments.id(req.params.commentId);
  if (!comment) {
    throw ApiError.notFound("Comment not found");
  }

  // Only the comment author can delete it
  if (comment.author.toString() !== req.user._id.toString()) {
    throw ApiError.forbidden("You can only delete your own comments");
  }

  post.comments.pull({ _id: req.params.commentId });
  await post.save();

  res.json(ApiResponse.ok(post, "Comment deleted"));
});

module.exports = {
  createPost,
  getPostsByRoom,
  getPostById,
  updatePost,
  deletePost,
  addComment,
  deleteComment,
};
