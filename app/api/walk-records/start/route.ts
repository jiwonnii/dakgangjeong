import type { NextRequest } from "next/server";
import { runExpressHandlers } from "@/src/lib/next-route";
import { validateRequest } from "@/src/lib/validation";
import { requireAuth } from "@/src/middleware/auth";
import { startWalkRecord } from "@/src/modules/walkRecords/walk-record.controller";
import { startWalkRecordSchema } from "@/src/modules/walkRecords/walk-record.schemas";

export async function POST(request: NextRequest) {
  return runExpressHandlers(request, {}, [
    requireAuth,
    validateRequest(startWalkRecordSchema, "body"),
    startWalkRecord
  ]);
}
