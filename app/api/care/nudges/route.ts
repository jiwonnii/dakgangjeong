import type { NextRequest } from "next/server";
import { runExpressHandlers } from "@/src/lib/next-route";
import { validateRequest } from "@/src/lib/validation";
import { requireAuth } from "@/src/middleware/auth";
import { sendCareNudge } from "@/src/modules/care/care.controller";
import { careNudgeSchema } from "@/src/modules/care/care.schemas";

export async function POST(request: NextRequest) {
  return runExpressHandlers(request, {}, [
    requireAuth,
    validateRequest(careNudgeSchema, "body"),
    sendCareNudge
  ]);
}
