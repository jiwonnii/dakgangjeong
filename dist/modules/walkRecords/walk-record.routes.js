import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { finishWalkRecord, listWalkRecords, startWalkRecord } from "./walk-record.controller.js";
export const walkRecordRouter = Router();
walkRecordRouter.use(requireAuth);
walkRecordRouter.get("/", listWalkRecords);
walkRecordRouter.post("/start", startWalkRecord);
walkRecordRouter.patch("/:walkRecordId/finish", finishWalkRecord);
