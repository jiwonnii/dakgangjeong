import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { validateRequest } from "../../lib/validation";
import {
  createManualWalkRecord,
  finishWalkRecord,
  getInProgressWalkRecord,
  getWalkStreak,
  listWalkRecords,
  startWalkRecord,
  updateWalkRecordProgress
} from "./walk-record.controller";
import {
  finishWalkRecordSchema,
  inProgressWalkRecordQuerySchema,
  listWalkRecordsQuerySchema,
  manualWalkRecordSchema,
  progressWalkRecordSchema,
  startWalkRecordSchema,
  walkRecordIdParamsSchema,
  walkStreakQuerySchema
} from "./walk-record.schemas";

export const walkRecordRouter = Router();

walkRecordRouter.use(requireAuth);
walkRecordRouter.get("/", validateRequest(listWalkRecordsQuerySchema, "query"), listWalkRecords);
walkRecordRouter.get(
  "/in-progress",
  validateRequest(inProgressWalkRecordQuerySchema, "query"),
  getInProgressWalkRecord
);
walkRecordRouter.get("/streak", validateRequest(walkStreakQuerySchema, "query"), getWalkStreak);
walkRecordRouter.post("/start", validateRequest(startWalkRecordSchema), startWalkRecord);
walkRecordRouter.post("/manual", validateRequest(manualWalkRecordSchema), createManualWalkRecord);
walkRecordRouter.patch(
  "/:walkRecordId/finish",
  validateRequest(walkRecordIdParamsSchema, "params"),
  validateRequest(finishWalkRecordSchema),
  finishWalkRecord
);
walkRecordRouter.patch(
  "/:walkRecordId/progress",
  validateRequest(walkRecordIdParamsSchema, "params"),
  validateRequest(progressWalkRecordSchema),
  updateWalkRecordProgress
);
