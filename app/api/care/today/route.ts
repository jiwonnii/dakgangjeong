import type { NextRequest } from "next/server";
import { runExpressHandlers } from "@/src/lib/next-route";
import { validateRequest } from "@/src/lib/validation";
import { requireAuth } from "@/src/middleware/auth";
import { getTodayCareStatus } from "@/src/modules/care/care.controller";
import { careScheduleQuerySchema } from "@/src/modules/care/care.schemas";

export async function GET(request: NextRequest) {
  return runExpressHandlers(request, {}, [
    requireAuth,
    validateRequest(careScheduleQuerySchema, "query"),
    getTodayCareStatus
  ]);
}
