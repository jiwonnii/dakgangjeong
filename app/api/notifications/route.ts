import type { NextRequest } from "next/server";
import { runExpressHandlers } from "@/src/lib/next-route";
import { validateRequest } from "@/src/lib/validation";
import { requireAuth } from "@/src/middleware/auth";
import { listNotifications } from "@/src/modules/notifications/notification.controller";
import { notificationListQuerySchema } from "@/src/modules/notifications/notification.schemas";

export async function GET(request: NextRequest) {
  return runExpressHandlers(request, {}, [
    requireAuth,
    validateRequest(notificationListQuerySchema, "query"),
    listNotifications
  ]);
}
