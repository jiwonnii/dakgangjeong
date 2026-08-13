import type { NextRequest } from "next/server";
import { runExpressHandlers } from "@/src/lib/next-route";
import { requireAuth } from "@/src/middleware/auth";
import { signOut } from "@/src/modules/auth/auth.controller";

export async function POST(request: NextRequest) {
  return runExpressHandlers(request, {}, [requireAuth, signOut]);
}
