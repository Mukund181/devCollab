const { z } = require("zod");

const createRoomSchema = z.object({
  name: z
    .string({ required_error: "Room name is required" })
    .trim()
    .min(2, "Room name must be at least 2 characters")
    .max(80, "Room name must be at most 80 characters"),
  description: z
    .string()
    .max(300, "Description must be at most 300 characters")
    .optional(),
  isPrivate: z.boolean().optional().default(false),
});

const updateRoomSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Room name must be at least 2 characters")
    .max(80, "Room name must be at most 80 characters")
    .optional(),
  description: z
    .string()
    .max(300, "Description must be at most 300 characters")
    .optional(),
  isPrivate: z.boolean().optional(),
});

const addMemberSchema = z.object({
  userId: z.string({ required_error: "User ID is required" }),
  role: z.enum(["admin", "member"]).optional().default("member"),
});

module.exports = {
  createRoomSchema,
  updateRoomSchema,
  addMemberSchema,
};
