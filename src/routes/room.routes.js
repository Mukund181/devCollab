const express = require("express");
const router = express.Router();
const roomController = require("../controllers/room.controller");
const authenticate = require("../middleware/authenticate");
const validate = require("../middleware/validate");
const {
  createRoomSchema,
  updateRoomSchema,
  addMemberSchema,
} = require("../validators/room.validator");

// All room routes require authentication
router.use(authenticate);

router.post("/", validate(createRoomSchema), roomController.createRoom);
router.get("/", roomController.getRooms);
router.get("/:id", roomController.getRoomById);
router.patch("/:id", validate(updateRoomSchema), roomController.updateRoom);
router.delete("/:id", roomController.deleteRoom);

// Membership
router.post("/:id/join", roomController.joinRoom);
router.post("/:id/leave", roomController.leaveRoom);
router.post("/:id/members", validate(addMemberSchema), roomController.addMember);
router.delete("/:id/members/:userId", roomController.removeMember);

module.exports = router;
