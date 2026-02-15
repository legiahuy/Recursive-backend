import express from "express";
import {
  getActiveHeroSpotlight,
  getAllHeroSpotlights,
} from "../controllers/hero-spotlights.controller.js";

const router = express.Router();

router.get("/", getActiveHeroSpotlight);
router.get("/all", getAllHeroSpotlights);

export default router;
