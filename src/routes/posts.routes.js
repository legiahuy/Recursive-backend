import { Router } from "express";
import {
  createPost,
  deletePost,
  getAllPosts,
  getPostBySlug,
  getPublishedPosts,
  updatePost,
} from "../controllers/posts.controller.js";
import { verifyToken, isOwner } from "../middleware/auth.middleware.js";

const postsRouter = Router();

postsRouter.get("/", getPublishedPosts);
postsRouter.get("/all", verifyToken, isOwner, getAllPosts);
postsRouter.get("/admin/:slug", verifyToken, isOwner, getPostBySlug);
postsRouter.get("/:slug", getPostBySlug);
postsRouter.post("/", verifyToken, isOwner, createPost);
postsRouter.put("/:id", verifyToken, isOwner, updatePost);
postsRouter.delete("/:id", verifyToken, isOwner, deletePost);

export default postsRouter;
