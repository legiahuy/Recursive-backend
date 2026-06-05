import { Router } from "express";
import {
  exportNewsletterSubscribers,
  getNewsletterSubscribers,
  subscribeNewsletter,
} from "../controllers/newsletter.controller.js";
import { verifyToken, isAdmin } from "../middleware/auth.middleware.js";

const newsletterRouter = Router();

newsletterRouter.post("/", subscribeNewsletter);
newsletterRouter.get("/", verifyToken, isAdmin, getNewsletterSubscribers);
newsletterRouter.get(
  "/export",
  verifyToken,
  isAdmin,
  exportNewsletterSubscribers,
);

export default newsletterRouter;
