import { Router } from "express";
import {
  createSubmission,
  getSubmissionStatus,
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
 * /demo-submission/status:
 *   get:
 *     summary: Check a demo submission status
 *     description: >
 *       Public status lookup for submitters. Requires both the submission
 *       reference and the email used to submit; the email must match the
 *       reference or the lookup returns 404. Only submitter-safe fields are
 *       returned (no internal notes or contact details).
 *     tags: [Submissions]
 *     parameters:
 *       - in: query
 *         name: ref
 *         required: true
 *         schema:
 *           type: string
 *         description: The submission reference (id) from the confirmation email.
 *       - in: query
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *           format: email
 *         description: The email used when the demo was submitted.
 *     responses:
 *       200:
 *         description: Submission status.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 artist_name:
 *                   type: string
 *                 status:
 *                   type: string
 *                 status_label:
 *                   type: string
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Missing reference or email.
 *       404:
 *         description: No submission matches that reference and email.
 */
submissionsRouter.get("/status", getSubmissionStatus);

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
