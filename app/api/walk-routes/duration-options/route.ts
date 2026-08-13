import type { NextRequest } from "next/server";
import { runExpressHandlers } from "@/src/lib/next-route";
import { validateRequest } from "@/src/lib/validation";
import { requireAuth, requireVerifiedEmail } from "@/src/middleware/auth";
import { getDurationOptions } from "@/src/modules/walkRoutes/walk-route.controller";
import { durationOptionsQuerySchema } from "@/src/modules/walkRoutes/walk-route.schemas";

export async function GET(request: NextRequest) {
  return runExpressHandlers(request, {}, [
    requireAuth,
    requireVerifiedEmail,
    validateRequest(durationOptionsQuerySchema, "query"),
    getDurationOptions
  ]);
}
