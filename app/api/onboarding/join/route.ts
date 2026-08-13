import type { NextRequest } from "next/server";
import { runExpressHandlers } from "@/src/lib/next-route";
import { validateRequest } from "@/src/lib/validation";
import { requireAuth, requireVerifiedEmail } from "@/src/middleware/auth";
import { joinDogProfile } from "@/src/modules/onboarding/onboarding.controller";
import { joinDogByInviteCodeSchema } from "@/src/modules/onboarding/onboarding.schemas";

export async function POST(request: NextRequest) {
  return runExpressHandlers(request, {}, [
    requireAuth,
    requireVerifiedEmail,
    validateRequest(joinDogByInviteCodeSchema),
    joinDogProfile
  ]);
}
