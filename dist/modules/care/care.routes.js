import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { getTodayCareStatus, sendCareNudge, updateCareTask } from "./care.controller.js";
export const careRouter = Router();
careRouter.use(requireAuth);
careRouter.get("/today", getTodayCareStatus);
careRouter.patch("/tasks/:taskId", updateCareTask);
careRouter.post("/nudges", sendCareNudge);
