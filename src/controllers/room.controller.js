const Room = require("../models/Room");
const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const { getCache, setCache, deleteCache, deleteCachePattern } = require("../services/cache.service");

// ───────────────────────── CREATE ROOM ─────────────────────────
const createRoom = asyncHandler(async (req, res) => {
  const { name, description, isPrivate } = req.body;

  const room = await Room.create({
    name,
    description,
    owner: req.user._id,
    members: [{ user: req.user._id, role: "admin" }],
    isPrivate,
  });

  // Add room reference to the user's rooms array
  await User.findByIdAndUpdate(req.user._id, {
    $addToSet: { rooms: room._id },
  });

  await deleteCachePattern("rooms:*");
  await deleteCache(`user:${req.user._id}`);

  res.status(201).json(ApiResponse.created(room));
});

// ───────────────────────── GET ALL ROOMS ─────────────────────────
const getRooms = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  const cacheKey = `rooms:page:${page}:limit:${limit}`;
  const cached = await getCache(cacheKey);
  if (cached) {
    return res.json(ApiResponse.ok(cached, "Rooms fetched (cached)"));
  }

  const [rooms, total] = await Promise.all([
    Room.find({ isPrivate: false })
      .populate("owner", "name email avatarUrl")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Room.countDocuments({ isPrivate: false }),
  ]);

  const result = {
    rooms,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };

  await setCache(cacheKey, result, 120); // cache for 2 minutes
  res.json(ApiResponse.ok(result));
});

// ───────────────────────── GET ROOM BY ID ─────────────────────────
const getRoomById = asyncHandler(async (req, res) => {
  const room = await Room.findById(req.params.id)
    .populate("owner", "name email avatarUrl")
    .populate("members.user", "name email avatarUrl");

  if (!room) {
    throw ApiError.notFound("Room not found");
  }

  // Private rooms: only members can view
  if (room.isPrivate) {
    const isMember = room.members.some(
      (m) => m.user._id.toString() === req.user._id.toString()
    );
    if (!isMember) {
      throw ApiError.forbidden("You are not a member of this private room");
    }
  }

  res.json(ApiResponse.ok(room));
});

// ───────────────────────── UPDATE ROOM ─────────────────────────
const updateRoom = asyncHandler(async (req, res) => {
  const room = await Room.findById(req.params.id);
  if (!room) {
    throw ApiError.notFound("Room not found");
  }

  // Only the owner or room admins can update
  const isOwner = room.owner.toString() === req.user._id.toString();
  const isAdmin = room.members.some(
    (m) =>
      m.user.toString() === req.user._id.toString() && m.role === "admin"
  );

  if (!isOwner && !isAdmin) {
    throw ApiError.forbidden("Only the room owner or admins can update this room");
  }

  const { name, description, isPrivate } = req.body;
  if (name !== undefined) room.name = name;
  if (description !== undefined) room.description = description;
  if (isPrivate !== undefined) room.isPrivate = isPrivate;

  await room.save();
  await deleteCachePattern("rooms:*");

  res.json(ApiResponse.ok(room, "Room updated"));
});

// ───────────────────────── DELETE ROOM ─────────────────────────
const deleteRoom = asyncHandler(async (req, res) => {
  const room = await Room.findById(req.params.id);
  if (!room) {
    throw ApiError.notFound("Room not found");
  }

  // Only the owner can delete
  if (room.owner.toString() !== req.user._id.toString()) {
    throw ApiError.forbidden("Only the room owner can delete this room");
  }

  // Remove room reference from all members' rooms arrays
  const memberIds = room.members.map((m) => m.user);
  await User.updateMany(
    { _id: { $in: memberIds } },
    { $pull: { rooms: room._id } }
  );

  await Room.findByIdAndDelete(req.params.id);
  await deleteCachePattern("rooms:*");

  res.json(ApiResponse.ok(null, "Room deleted"));
});

// ───────────────────────── JOIN ROOM ─────────────────────────
const joinRoom = asyncHandler(async (req, res) => {
  const room = await Room.findById(req.params.id);
  if (!room) {
    throw ApiError.notFound("Room not found");
  }

  if (room.isPrivate) {
    throw ApiError.forbidden("This is a private room. You must be invited.");
  }

  // Check if already a member
  const alreadyMember = room.members.some(
    (m) => m.user.toString() === req.user._id.toString()
  );
  if (alreadyMember) {
    throw ApiError.conflict("You are already a member of this room");
  }

  room.members.push({ user: req.user._id, role: "member" });
  await room.save();

  await User.findByIdAndUpdate(req.user._id, {
    $addToSet: { rooms: room._id },
  });

  await deleteCachePattern("rooms:*");
  await deleteCache(`user:${req.user._id}`);

  res.json(ApiResponse.ok(room, "Joined room successfully"));
});

// ───────────────────────── LEAVE ROOM ─────────────────────────
const leaveRoom = asyncHandler(async (req, res) => {
  const room = await Room.findById(req.params.id);
  if (!room) {
    throw ApiError.notFound("Room not found");
  }

  // Owner cannot leave — they must delete or transfer ownership
  if (room.owner.toString() === req.user._id.toString()) {
    throw ApiError.badRequest(
      "Room owner cannot leave. Transfer ownership or delete the room."
    );
  }

  room.members = room.members.filter(
    (m) => m.user.toString() !== req.user._id.toString()
  );
  await room.save();

  await User.findByIdAndUpdate(req.user._id, {
    $pull: { rooms: room._id },
  });

  await deleteCachePattern("rooms:*");
  await deleteCache(`user:${req.user._id}`);

  res.json(ApiResponse.ok(null, "Left room successfully"));
});

// ───────────────────────── ADD MEMBER (Admin/Owner) ─────────────────────────
const addMember = asyncHandler(async (req, res) => {
  const room = await Room.findById(req.params.id);
  if (!room) {
    throw ApiError.notFound("Room not found");
  }

  // Only owner or admin can add members
  const isOwner = room.owner.toString() === req.user._id.toString();
  const isAdmin = room.members.some(
    (m) =>
      m.user.toString() === req.user._id.toString() && m.role === "admin"
  );
  if (!isOwner && !isAdmin) {
    throw ApiError.forbidden("Only room admins can add members");
  }

  const { userId, role } = req.body;

  // Verify the user exists
  const userToAdd = await User.findById(userId);
  if (!userToAdd) {
    throw ApiError.notFound("User to add not found");
  }

  // Check if already a member
  const alreadyMember = room.members.some(
    (m) => m.user.toString() === userId
  );
  if (alreadyMember) {
    throw ApiError.conflict("User is already a member of this room");
  }

  room.members.push({ user: userId, role: role || "member" });
  await room.save();

  await User.findByIdAndUpdate(userId, {
    $addToSet: { rooms: room._id },
  });

  await deleteCachePattern("rooms:*");

  res.json(ApiResponse.ok(room, "Member added"));
});

// ───────────────────────── REMOVE MEMBER (Admin/Owner) ─────────────────────────
const removeMember = asyncHandler(async (req, res) => {
  const room = await Room.findById(req.params.id);
  if (!room) {
    throw ApiError.notFound("Room not found");
  }

  const isOwner = room.owner.toString() === req.user._id.toString();
  const isAdmin = room.members.some(
    (m) =>
      m.user.toString() === req.user._id.toString() && m.role === "admin"
  );
  if (!isOwner && !isAdmin) {
    throw ApiError.forbidden("Only room admins can remove members");
  }

  const { userId } = req.params;

  // Cannot remove the owner
  if (room.owner.toString() === userId) {
    throw ApiError.badRequest("Cannot remove the room owner");
  }

  room.members = room.members.filter(
    (m) => m.user.toString() !== userId
  );
  await room.save();

  await User.findByIdAndUpdate(userId, {
    $pull: { rooms: room._id },
  });

  await deleteCachePattern("rooms:*");

  res.json(ApiResponse.ok(room, "Member removed"));
});

module.exports = {
  createRoom,
  getRooms,
  getRoomById,
  updateRoom,
  deleteRoom,
  joinRoom,
  leaveRoom,
  addMember,
  removeMember,
};
