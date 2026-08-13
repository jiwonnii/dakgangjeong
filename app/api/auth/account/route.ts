import type { NextRequest } from "next/server";
import { runExpressHandlers } from "@/src/lib/next-route";
import { requireAuth } from "@/src/middleware/auth";
import { deleteAccount } from "@/src/modules/auth/auth.controller";

export async function DELETE(request: NextRequest) {
  return runExpressHandlers(request, {}, [requireAuth, deleteAccount]);
}
