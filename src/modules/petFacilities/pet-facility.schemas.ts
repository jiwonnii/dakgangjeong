import { z } from "zod";

export const petFacilityListQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  radiusM: z.coerce.number().min(100).max(5000).default(1500),
  type: z.enum(["hospital", "grooming", "cafe", "other"]).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20)
});
