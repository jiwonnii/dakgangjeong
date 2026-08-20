import type { NextRequest } from "next/server";
import { runExpressHandlers } from "@/src/lib/next-route";
import { validateRequest } from "@/src/lib/validation";
import { requireAuth } from "@/src/middleware/auth";
import { listNearbyPetFacilities } from "@/src/modules/petFacilities/pet-facility.controller";
import { petFacilityListQuerySchema } from "@/src/modules/petFacilities/pet-facility.schemas";

export async function GET(request: NextRequest) {
  return runExpressHandlers(request, {}, [
    requireAuth,
    validateRequest(petFacilityListQuerySchema, "query"),
    listNearbyPetFacilities
  ]);
}
