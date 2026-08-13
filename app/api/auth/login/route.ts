import type { NextRequest } from "next/server";
import { runExpressHandlers } from "@/src/lib/next-route";
import { validateRequest } from "@/src/lib/validation";
import { signInWithEmail } from "@/src/modules/auth/auth.controller";
import { loginSchema } from "@/src/modules/auth/auth.schemas";

export async function POST(request: NextRequest) {
  return runExpressHandlers(request, {}, [validateRequest(loginSchema), signInWithEmail]);
}
