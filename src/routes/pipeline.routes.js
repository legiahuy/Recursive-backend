import { Router } from "express";
import { verifyToken, isAdmin } from "../middleware/auth.middleware.js";
import {
  getPipeline, getPipelineItem, createPipelineItem, updatePipelineItem, cancelPipelineItem,
  addCollaborator, resendCollaborator, removeCollaborator,
  getFormByToken, submitFormByToken,
  getIntakeByToken, submitIntakeByToken,
  generateContractHandler, getContractHandler,
  sendContractHandler, remindContractHandler, voidContractHandler, getSignedContractHandler,
} from "../controllers/pipeline.controller.js";

const pipelineRouter = Router();

// Public token-gated form (MUST be registered before admin-guarded routes)
pipelineRouter.get("/form/:token", getFormByToken);
pipelineRouter.post("/form/:token", submitFormByToken);
pipelineRouter.get("/intake/:token", getIntakeByToken);
pipelineRouter.post("/intake/:token", submitIntakeByToken);

// Admin (any staff: owner/admin/ar)
pipelineRouter.get("/", verifyToken, isAdmin, getPipeline);
pipelineRouter.post("/", verifyToken, isAdmin, createPipelineItem);
pipelineRouter.get("/:id", verifyToken, isAdmin, getPipelineItem);
pipelineRouter.patch("/:id", verifyToken, isAdmin, updatePipelineItem);
pipelineRouter.post("/:id/cancel", verifyToken, isAdmin, cancelPipelineItem);
pipelineRouter.post("/:id/collaborators", verifyToken, isAdmin, addCollaborator);
pipelineRouter.post("/:id/collaborators/:cid/resend", verifyToken, isAdmin, resendCollaborator);
pipelineRouter.delete("/:id/collaborators/:cid", verifyToken, isAdmin, removeCollaborator);
pipelineRouter.post("/:id/contract", verifyToken, isAdmin, generateContractHandler);
pipelineRouter.get("/:id/contract", verifyToken, isAdmin, getContractHandler);
pipelineRouter.post("/:id/contract/send", verifyToken, isAdmin, sendContractHandler);
pipelineRouter.post("/:id/contract/remind", verifyToken, isAdmin, remindContractHandler);
pipelineRouter.post("/:id/contract/void", verifyToken, isAdmin, voidContractHandler);
pipelineRouter.get("/:id/contract/signed", verifyToken, isAdmin, getSignedContractHandler);

export default pipelineRouter;
