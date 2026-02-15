import { Router } from "express";
import {
  createSubmission,
  getAllSubmissions,
  updateSubmissionStatus,
} from "../controllers/submissions.controller.js";
import { verifyToken, isAdmin } from "../middleware/auth.middleware.js";

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

/**
 * @swagger
 * /demo-submission:
 *   get:
 *     summary: Get all demo submissions
 *     tags: [Submissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of submissions.
 *       403:
 *         description: Forbidden (Admin only).
 */
submissionsRouter.get("/", verifyToken, isAdmin, getAllSubmissions);

/**
 * @swagger
 * /demo-submission/{id}:
 *   put:
 *     summary: Update submission status
 *     tags: [Submissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *               note:
 *                 type: string
 *     responses:
 *       200:
 *         description: Submission updated.
 *       403:
 *         description: Forbidden (Admin only).
 */
submissionsRouter.put("/:id", verifyToken, isAdmin, updateSubmissionStatus);

export default submissionsRouter;
