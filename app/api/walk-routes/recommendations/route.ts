import { NextResponse, type NextRequest } from "next/server";
import { runExpressHandlers } from "@/src/lib/next-route";
import { validateRequest } from "@/src/lib/validation";
import { requireAuth, requireVerifiedEmail } from "@/src/middleware/auth";
import { recommendWalkRoutes } from "@/src/modules/walkRoutes/walk-route.controller";
import { recommendationRequestSchema } from "@/src/modules/walkRoutes/walk-route.schemas";
import { addAiExplanationsToCourses } from "@/src/modules/walkRoutes/services/ai-explanation.service";

export async function POST(request: NextRequest) {
  const response = await runExpressHandlers(request, {}, [
    requireAuth,
    requireVerifiedEmail,
    validateRequest(recommendationRequestSchema, "body"),
    recommendWalkRoutes
  ]);

  if (!response.ok) {
    return response;
  }

  const payload = await response.json().catch(() => null);

  if (!payload || payload.status !== "ok" || !Array.isArray(payload.courses)) {
    return NextResponse.json(payload ?? {}, { status: response.status });
  }

  const courses = await addAiExplanationsToCourses(payload.courses);

  return NextResponse.json(
    {
      ...payload,
      courses
    },
    { status: response.status }
  );
}
