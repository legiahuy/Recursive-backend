import { Router } from "express";
import { getDashboardStats } from "../controllers/dashboard.controller.js";
import { verifyToken, isAdmin } from "../middleware/auth.middleware.js";

const dashboardRouter = Router();

/**
 * @swagger
 * /dashboard/stats:
 *   get:
 *     summary: Get dashboard KPI stats including counts and recent activity
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard stats
 */
dashboardRouter.get("/stats", verifyToken, isAdmin, getDashboardStats);

export default dashboardRouter;
