import { Router } from "express";
import {
  getFeaturedReleases,
  getAllReleases,
  getReleaseBySlug,
} from "../controllers/releases.controller.js";

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

export default releasesRouter;
