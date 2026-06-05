import { Router } from "express";
import {
  getAnalyticsSummary,
  trackAnalyticsEvent,
} from "../controllers/analytics.controller.js";
import { verifyToken, isAdmin } from "../middleware/auth.middleware.js";

const analyticsRouter = Router();

analyticsRouter.post("/", trackAnalyticsEvent);
analyticsRouter.get("/summary", verifyToken, isAdmin, getAnalyticsSummary);

export default analyticsRouter;
