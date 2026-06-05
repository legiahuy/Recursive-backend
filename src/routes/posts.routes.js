import { Router } from "express";
import {
  createPost,
  deletePost,
  getAllPosts,
  getPostBySlug,
  getPublishedPosts,
  updatePost,
} from "../controllers/posts.controller.js";
import { verifyToken, isAdmin } from "../middleware/auth.middleware.js";

const postsRouter = Router();

postsRouter.get("/", getPublishedPosts);
postsRouter.get("/all", verifyToken, isAdmin, getAllPosts);
postsRouter.get("/admin/:slug", verifyToken, isAdmin, getPostBySlug);
postsRouter.get("/:slug", getPostBySlug);
postsRouter.post("/", verifyToken, isAdmin, createPost);
postsRouter.put("/:id", verifyToken, isAdmin, updatePost);
postsRouter.delete("/:id", verifyToken, isAdmin, deletePost);

export default postsRouter;
