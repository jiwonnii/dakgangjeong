import type { NextRequest } from "next/server";
import { runExpressHandlers } from "@/src/lib/next-route";
import { validateRequest } from "@/src/lib/validation";
import { requireAuth } from "@/src/middleware/auth";
import {
  dogIdParamsSchema,
  updateDog,
  updateDogProfileSchema
} from "@/src/modules/dogs/dog.controller";

type Context = {
  params: Promise<{ dogId: string }> | { dogId: string };
};

export async function PATCH(request: NextRequest, context: Context) {
  const params = await context.params;

  return runExpressHandlers(request, { params }, [
    requireAuth,
    validateRequest(dogIdParamsSchema, "params"),
    validateRequest(updateDogProfileSchema, "body"),
    updateDog
  ]);
}
