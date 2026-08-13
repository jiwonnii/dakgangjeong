import type { NextRequest } from "next/server";
import { runExpressHandlers } from "@/src/lib/next-route";
import { validateRequest } from "@/src/lib/validation";
import { requireAuth } from "@/src/middleware/auth";
import { updateWalkRecordProgress } from "@/src/modules/walkRecords/walk-record.controller";
import {
  progressWalkRecordSchema,
  walkRecordIdParamsSchema
} from "@/src/modules/walkRecords/walk-record.schemas";

type Context = {
  params: Promise<{ walkRecordId: string }> | { walkRecordId: string };
};

export async function PATCH(request: NextRequest, context: Context) {
  return runExpressHandlers(
    request,
    { params: await context.params },
    [
      requireAuth,
      validateRequest(walkRecordIdParamsSchema, "params"),
      validateRequest(progressWalkRecordSchema, "body"),
      updateWalkRecordProgress
    ]
  );
}
