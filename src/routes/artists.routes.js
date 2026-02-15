import { Router } from "express";
import {
  getFeaturedArtists,
  getAllArtists,
  getArtistBySlug,
  createArtist,
  updateArtist,
  deleteArtist,
} from "../controllers/artists.controller.js";
import { verifyToken, isAdmin } from "../middleware/auth.middleware.js";

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

/**
 * @swagger
 * /artists:
 *   post:
 *     summary: Create a new artist
 *     tags: [Artists]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - slug
 *             properties:
 *               name:
 *                 type: string
 *               slug:
 *                 type: string
 *               bio:
 *                 type: string
 *               image_url:
 *                 type: string
 *     responses:
 *       201:
 *         description: Artist created successfully.
 *       403:
 *         description: Forbidden (Admin only).
 */
artistsRouter.post("/", verifyToken, isAdmin, createArtist);

/**
 * @swagger
 * /artists/{id}:
 *   put:
 *     summary: Update an artist
 *     tags: [Artists]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Artist ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               bio:
 *                 type: string
 *               image_url:
 *                 type: string
 *               is_featured:
 *                 type: boolean
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Artist updated successfully.
 *       403:
 *         description: Forbidden (Admin only).
 */
artistsRouter.put("/:id", verifyToken, isAdmin, updateArtist);

/**
 * @swagger
 * /artists/{id}:
 *   delete:
 *     summary: Delete an artist
 *     tags: [Artists]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Artist ID
 *     responses:
 *       200:
 *         description: Artist deleted successfully.
 *       403:
 *         description: Forbidden (Admin only).
 */
artistsRouter.delete("/:id", verifyToken, isAdmin, deleteArtist);

export default artistsRouter;
