import type { NextRequest } from "next/server";
import { runExpressHandlers } from "@/src/lib/next-route";
import { requireAuth } from "@/src/middleware/auth";
import { getMe } from "@/src/modules/auth/auth.controller";

export async function GET(request: NextRequest) {
  return runExpressHandlers(request, {}, [requireAuth, getMe]);
}
