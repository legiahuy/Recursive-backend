import { Router } from "express";
import { boldsignWebhookHandler } from "../controllers/pipeline.controller.js";

const webhooksRouter = Router();

// Public (no auth) — authenticity is enforced by HMAC signature verification.
webhooksRouter.post("/boldsign", boldsignWebhookHandler);

export default webhooksRouter;
