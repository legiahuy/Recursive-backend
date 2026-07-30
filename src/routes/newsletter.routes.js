import { Router } from "express";
import {
  exportNewsletterSubscribers,
  getNewsletterSubscribers,
  subscribeNewsletter,
} from "../controllers/newsletter.controller.js";
import { verifyToken, isOwner } from "../middleware/auth.middleware.js";

const newsletterRouter = Router();

newsletterRouter.post("/", subscribeNewsletter);
newsletterRouter.get("/", verifyToken, isOwner, getNewsletterSubscribers);
newsletterRouter.get(
  "/export",
  verifyToken,
  isOwner,
  exportNewsletterSubscribers,
);

export default newsletterRouter;
