import { Router } from "express";
import {
  getFeaturedArtists,
  getAllArtists,
  getArtistBySlug,
} from "../controllers/artists.controller.js";

const artistsRouter = Router();

/**
 * @swagger
 * /artists/featured:
 *   get:
 *     summary: Get featured artists
 *     description: Retrieve a list of featured artists (max 4).
 *     responses:
 *       200:
 *         description: A list of featured artists.
 */
artistsRouter.get("/featured", getFeaturedArtists);

/**
 * @swagger
 * /artists:
 *   get:
 *     summary: Get all artists
 *     description: Retrieve a list of active artists with pagination and search.
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
 *         description: Search query for artist name
 *     responses:
 *       200:
 *         description: A paginated list of artists.
 */
artistsRouter.get("/", getAllArtists);

/**
 * @swagger
 * /artists/{slug}:
 *   get:
 *     summary: Get artist details
 *     description: Retrieve details of a specific artist by slug.
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: Artist slug
 *     responses:
 *       200:
 *         description: Artist details including social links.
 *       404:
 *         description: Artist not found.
 */
artistsRouter.get("/:slug", getArtistBySlug);

export default artistsRouter;
