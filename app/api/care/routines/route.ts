import type { NextRequest } from "next/server";
import { runExpressHandlers } from "@/src/lib/next-route";
import { validateRequest } from "@/src/lib/validation";
import { requireAuth } from "@/src/middleware/auth";
import {
  createCareRoutine,
  listCareRoutines
} from "@/src/modules/care/care.controller";
import {
  careRoutineListQuerySchema,
  careRoutineSchema
} from "@/src/modules/care/care.schemas";

export async function GET(request: NextRequest) {
  return runExpressHandlers(request, {}, [
    requireAuth,
    validateRequest(careRoutineListQuerySchema, "query"),
    listCareRoutines
  ]);
}

export async function POST(request: NextRequest) {
  return runExpressHandlers(request, {}, [
    requireAuth,
    validateRequest(careRoutineSchema, "body"),
    createCareRoutine
  ]);
}
