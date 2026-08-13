import type { NextRequest } from "next/server";
import { runExpressHandlers } from "@/src/lib/next-route";
import { validateRequest } from "@/src/lib/validation";
import { requireAuth } from "@/src/middleware/auth";
import { getInProgressWalkRecord } from "@/src/modules/walkRecords/walk-record.controller";
import { inProgressWalkRecordQuerySchema } from "@/src/modules/walkRecords/walk-record.schemas";

export async function GET(request: NextRequest) {
  return runExpressHandlers(request, {}, [
    requireAuth,
    validateRequest(inProgressWalkRecordQuerySchema, "query"),
    getInProgressWalkRecord
  ]);
}
