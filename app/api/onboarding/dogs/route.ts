import type { NextRequest } from "next/server";
import { runExpressHandlers } from "@/src/lib/next-route";
import { validateRequest } from "@/src/lib/validation";
import { requireAuth, requireVerifiedEmail } from "@/src/middleware/auth";
import { createDogProfile } from "@/src/modules/onboarding/onboarding.controller";
import { createDogOnboardingSchema } from "@/src/modules/onboarding/onboarding.schemas";

export async function POST(request: NextRequest) {
  return runExpressHandlers(request, {}, [
    requireAuth,
    requireVerifiedEmail,
    validateRequest(createDogOnboardingSchema),
    createDogProfile
  ]);
}
