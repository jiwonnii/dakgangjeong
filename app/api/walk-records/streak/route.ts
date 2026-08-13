import type { NextRequest } from "next/server";
import { runExpressHandlers } from "@/src/lib/next-route";
import { validateRequest } from "@/src/lib/validation";
import { requireAuth } from "@/src/middleware/auth";
import { getWalkStreak } from "@/src/modules/walkRecords/walk-record.controller";
import { walkStreakQuerySchema } from "@/src/modules/walkRecords/walk-record.schemas";

export async function GET(request: NextRequest) {
  return runExpressHandlers(request, {}, [
    requireAuth,
    validateRequest(walkStreakQuerySchema, "query"),
    getWalkStreak
  ]);
}
