import type { NextRequest } from "next/server";
import { runExpressHandlers } from "@/src/lib/next-route";
import { validateRequest } from "@/src/lib/validation";
import { requireAuth } from "@/src/middleware/auth";
import { markNotificationsRead } from "@/src/modules/notifications/notification.controller";
import { markNotificationsReadSchema } from "@/src/modules/notifications/notification.schemas";

export async function PATCH(request: NextRequest) {
  return runExpressHandlers(request, {}, [
    requireAuth,
    validateRequest(markNotificationsReadSchema, "body"),
    markNotificationsRead
  ]);
}
