import type { NextRequest } from "next/server";
import { runExpressHandlers } from "@/src/lib/next-route";
import { validateRequest } from "@/src/lib/validation";
import { requireAuth } from "@/src/middleware/auth";
import { listWalkRecords } from "@/src/modules/walkRecords/walk-record.controller";
import { listWalkRecordsQuerySchema } from "@/src/modules/walkRecords/walk-record.schemas";

export async function GET(request: NextRequest) {
  return runExpressHandlers(request, {}, [
    requireAuth,
    validateRequest(listWalkRecordsQuerySchema, "query"),
    listWalkRecords
  ]);
}
