import express from "express";
import {
  getActiveHeroSpotlight,
  getAllHeroSpotlights,
  createHeroSpotlight,
  updateHeroSpotlight,
  deleteHeroSpotlight,
  reorderHeroSpotlights,
} from "../controllers/hero-spotlights.controller.js";
import { verifyToken, isOwner } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/all", getAllHeroSpotlights); // Admin lists all
router.get("/", getActiveHeroSpotlight); // Public gets active

router.post("/", verifyToken, isOwner, createHeroSpotlight);
router.patch("/reorder", verifyToken, isOwner, reorderHeroSpotlights);
router.put("/:id", verifyToken, isOwner, updateHeroSpotlight);
router.delete("/:id", verifyToken, isOwner, deleteHeroSpotlight);

export default router;
