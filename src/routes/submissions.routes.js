import { Router } from "express";
import { createSubmission } from "../controllers/submissions.controller.js";

const submissionsRouter = Router();

/**
 * @swagger
 * /demo-submission:
 *   post:
 *     summary: Submit a demo
 *     description: Submit a new demo for review.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - artist_name
 *               - email
 *               - stream_link
 *             properties:
 *               artist_name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               stream_link:
 *                 type: string
 *               note:
 *                 type: string
 *     responses:
 *       201:
 *         description: Demo submitted successfully.
 *       500:
 *         description: Server error.
 */
submissionsRouter.post("/", createSubmission);

export default submissionsRouter;
