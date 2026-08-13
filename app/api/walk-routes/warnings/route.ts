import type { NextRequest } from "next/server";
import { runExpressHandlers } from "@/src/lib/next-route";
import { validateRequest } from "@/src/lib/validation";
import { requireAuth, requireVerifiedEmail } from "@/src/middleware/auth";
import { getWarnings } from "@/src/modules/walkRoutes/walk-route.controller";
import { warningsQuerySchema } from "@/src/modules/walkRoutes/walk-route.schemas";

export async function GET(request: NextRequest) {
  return runExpressHandlers(request, {}, [
    requireAuth,
    requireVerifiedEmail,
    validateRequest(warningsQuerySchema, "query"),
    getWarnings
  ]);
}
