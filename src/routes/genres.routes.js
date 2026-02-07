import { Router } from "express";
import { getAllGenres } from "../controllers/genres.controller.js";

const genresRouter = Router();

/**
 * @swagger
 * /genres:
 *   get:
 *     summary: Get all genres
 *     description: Retrieve a list of all genres.
 *     responses:
 *       200:
 *         description: A list of genres.
 */
genresRouter.get("/", getAllGenres);

export default genresRouter;
