import { Router } from "express";
import { validateRequest } from "../../lib/validation";
import { requireAuth } from "../../middleware/auth";
import {
  createCareRoutine,
  getTodayCareStatus,
  listCareRoutines,
  sendCareNudge,
  updateCareTask
} from "./care.controller";
import {
  careRoutineListQuerySchema,
  careRoutineSchema,
  careScheduleQuerySchema,
  careTaskIdParamsSchema,
  updateCareTaskSchema
} from "./care.schemas";

export const careRouter = Router();

careRouter.use(requireAuth);
careRouter.get("/today", validateRequest(careScheduleQuerySchema, "query"), getTodayCareStatus);
careRouter.get("/routines", validateRequest(careRoutineListQuerySchema, "query"), listCareRoutines);
careRouter.post("/routines", validateRequest(careRoutineSchema), createCareRoutine);
careRouter.patch(
  "/tasks/:taskId",
  validateRequest(careTaskIdParamsSchema, "params"),
  validateRequest(updateCareTaskSchema),
  updateCareTask
);
careRouter.post("/nudges", sendCareNudge);
