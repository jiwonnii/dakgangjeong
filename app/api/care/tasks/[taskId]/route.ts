import type { NextRequest } from "next/server";
import { runExpressHandlers } from "@/src/lib/next-route";
import { validateRequest } from "@/src/lib/validation";
import { requireAuth } from "@/src/middleware/auth";
import { updateCareTask } from "@/src/modules/care/care.controller";
import {
  careTaskIdParamsSchema,
  updateCareTaskSchema
} from "@/src/modules/care/care.schemas";

type Context = {
  params: Promise<{ taskId: string }> | { taskId: string };
};

export async function PATCH(request: NextRequest, context: Context) {
  return runExpressHandlers(request, { params: await context.params }, [
    requireAuth,
    validateRequest(careTaskIdParamsSchema, "params"),
    validateRequest(updateCareTaskSchema, "body"),
    updateCareTask
  ]);
}
