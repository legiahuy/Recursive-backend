import { Router } from "express";
import {
  getFeaturedReleases,
  getAllReleases,
  getReleaseBySlug,
  createRelease,
  updateRelease,
  deleteRelease,
} from "../controllers/releases.controller.js";
import { verifyToken, isAdmin } from "../middleware/auth.middleware.js";

const releasesRouter = Router();

/**
 * @swagger
 * /releases/featured:
 *   get:
 *     summary: Get featured releases
 *     description: Retrieve a list of featured releases (max 4).
 *     responses:
 *       200:
 *         description: A list of featured releases.
 */
releasesRouter.get("/featured", getFeaturedReleases);

/**
 * @swagger
 * /releases:
 *   get:
 *     summary: Get all releases
 *     description: Retrieve a list of releases with pagination, search, and genre filter.
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search query for release title
 *       - in: query
 *         name: genre
 *         schema:
 *           type: string
 *         description: Filter by genre slug
 *     responses:
 *       200:
 *         description: A paginated list of releases.
 */
releasesRouter.get("/", getAllReleases);

/**
 * @swagger
 * /releases/{slug}:
 *   get:
 *     summary: Get release details
 *     description: Retrieve details of a specific release by slug.
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: Release slug
 *     responses:
 *       200:
 *         description: Release details including artists and genres.
 *       404:
 *         description: Release not found.
 */
releasesRouter.get("/:slug", getReleaseBySlug);

/**
 * @swagger
 * /releases:
 *   post:
 *     summary: Create a new release
 *     tags: [Releases]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - slug
 *               - release_date
 *               - type
 *     responses:
 *       201:
 *         description: Release created successfully.
 *       403:
 *         description: Forbidden (Admin only).
 */
releasesRouter.post("/", verifyToken, isAdmin, createRelease);

/**
 * @swagger
 * /releases/{id}:
 *   put:
 *     summary: Update a release
 *     tags: [Releases]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Release ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Release updated successfully.
 *       403:
 *         description: Forbidden (Admin only).
 */
releasesRouter.put("/:id", verifyToken, isAdmin, updateRelease);

/**
 * @swagger
 * /releases/{id}:
 *   delete:
 *     summary: Delete a release
 *     tags: [Releases]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Release ID
 *     responses:
 *       200:
 *         description: Release deleted successfully.
 *       403:
 *         description: Forbidden (Admin only).
 */
releasesRouter.delete("/:id", verifyToken, isAdmin, deleteRelease);

export default releasesRouter;
