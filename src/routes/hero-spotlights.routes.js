import express from "express";
import {
  getActiveHeroSpotlight,
  getAllHeroSpotlights,
  createHeroSpotlight,
  updateHeroSpotlight,
  deleteHeroSpotlight,
} from "../controllers/hero-spotlights.controller.js";
import { verifyToken, isAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/all", getAllHeroSpotlights); // Admin lists all
router.get("/", getActiveHeroSpotlight); // Public gets active

router.post("/", verifyToken, isAdmin, createHeroSpotlight);
router.put("/:id", verifyToken, isAdmin, updateHeroSpotlight);
router.delete("/:id", verifyToken, isAdmin, deleteHeroSpotlight);

export default router;
