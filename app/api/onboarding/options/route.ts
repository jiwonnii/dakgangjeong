import type { NextRequest } from "next/server";
import { runExpressHandlers } from "@/src/lib/next-route";
import { getOnboardingOptions } from "@/src/modules/onboarding/onboarding.controller";

export async function GET(request: NextRequest) {
  return runExpressHandlers(request, {}, [getOnboardingOptions]);
}
