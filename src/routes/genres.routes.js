import { Router } from "express";
import {
  createGenre,
  deleteGenre,
  getAllGenres,
  updateGenre,
} from "../controllers/genres.controller.js";
import { verifyToken, isAdmin } from "../middleware/auth.middleware.js";

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
genresRouter.post("/", verifyToken, isAdmin, createGenre);
genresRouter.put("/:id", verifyToken, isAdmin, updateGenre);
genresRouter.delete("/:id", verifyToken, isAdmin, deleteGenre);

export default genresRouter;
