import { Router } from "express";
import {
  getEmailTemplateByKey,
  getEmailTemplates,
  updateEmailTemplate,
} from "../controllers/emailTemplates.controller.js";
import { verifyToken, isAdmin } from "../middleware/auth.middleware.js";

const emailTemplatesRouter = Router();

emailTemplatesRouter.get("/", verifyToken, isAdmin, getEmailTemplates);
emailTemplatesRouter.get("/:key", verifyToken, isAdmin, getEmailTemplateByKey);
emailTemplatesRouter.put("/:key", verifyToken, isAdmin, updateEmailTemplate);

export default emailTemplatesRouter;
