import type { NextRequest } from "next/server";
import { runExpressHandlers } from "@/src/lib/next-route";
import { validateRequest } from "@/src/lib/validation";
import { requireAuth, requireVerifiedEmail } from "@/src/middleware/auth";
import { upsertGuardianProfile } from "@/src/modules/onboarding/onboarding.controller";
import { guardianProfileSchema } from "@/src/modules/onboarding/onboarding.schemas";

export async function PUT(request: NextRequest) {
  return runExpressHandlers(request, {}, [
    requireAuth,
    requireVerifiedEmail,
    validateRequest(guardianProfileSchema),
    upsertGuardianProfile
  ]);
}
