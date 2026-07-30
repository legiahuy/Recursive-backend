import { Router } from "express";
import {
  getEmailTemplateByKey,
  getEmailTemplates,
  updateEmailTemplate,
} from "../controllers/emailTemplates.controller.js";
import { verifyToken, isOwner } from "../middleware/auth.middleware.js";

const emailTemplatesRouter = Router();

emailTemplatesRouter.get("/", verifyToken, isOwner, getEmailTemplates);
emailTemplatesRouter.get("/:key", verifyToken, isOwner, getEmailTemplateByKey);
emailTemplatesRouter.put("/:key", verifyToken, isOwner, updateEmailTemplate);

export default emailTemplatesRouter;
