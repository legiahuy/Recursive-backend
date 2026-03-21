import { Router } from "express";
import { verifyToken, isAdmin } from "../middleware/auth.middleware.js";
import { uploadImage } from "../controllers/upload.controller.js";
import multer from "multer";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

const router = Router();

/**
 * @swagger
 * /upload:
 *   post:
 *     summary: Upload an image to Supabase Storage
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               bucket:
 *                 type: string
 *                 description: Name of the storage bucket
 *     responses:
 *       200:
 *         description: Image uploaded successfully
 *       400:
 *         description: No file uploaded
 *       500:
 *         description: Server error
 */
router.post(
  "/",
  verifyToken,
  isAdmin,
  upload.single("file"),
  uploadImage
);

export default router;
