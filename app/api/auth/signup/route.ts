import type { NextRequest } from "next/server";
import { runExpressHandlers } from "@/src/lib/next-route";
import { validateRequest } from "@/src/lib/validation";
import { signUpWithEmail } from "@/src/modules/auth/auth.controller";
import { signUpSchema } from "@/src/modules/auth/auth.schemas";

export async function POST(request: NextRequest) {
  return runExpressHandlers(request, {}, [validateRequest(signUpSchema), signUpWithEmail]);
}
