const express = require("express");
const router = express.Router();
const postController = require("../controllers/post.controller");
const authenticate = require("../middleware/authenticate");
const { upload } = require("../services/upload.service");

// All post routes require authentication
router.use(authenticate);

// Posts scoped to a room
router.post("/:roomId/posts", upload.array("attachments", 5), postController.createPost);
router.get("/:roomId/posts", postController.getPostsByRoom);

// Individual post operations
router.get("/posts/:id", postController.getPostById);
router.patch("/posts/:id", postController.updatePost);
router.delete("/posts/:id", postController.deletePost);

// Comments on a post
router.post("/posts/:id/comments", postController.addComment);
router.delete("/posts/:postId/comments/:commentId", postController.deleteComment);

module.exports = router;
