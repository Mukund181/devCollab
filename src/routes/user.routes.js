const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller");
const authenticate = require("../middleware/authenticate");
const { upload } = require("../services/upload.service");

// All user routes require authentication
router.use(authenticate);

router.get("/me", userController.getMyProfile);
router.get("/:id", userController.getUserById);
router.patch("/me", userController.updateProfile);
router.patch("/me/avatar", upload.single("avatar"), userController.updateAvatar);

module.exports = router;
