import { z } from "zod";

const latSchema = z.coerce.number().min(-90).max(90);
const lonSchema = z.coerce.number().min(-180).max(180);
const dogIdSchema = z.string().uuid();

export const durationOptionsQuerySchema = z.object({
  dogId: dogIdSchema,
  lat: latSchema,
  lon: lonSchema
});

export const warningsQuerySchema = z.object({
  dogId: dogIdSchema,
  lat: latSchema,
  lon: lonSchema
});

export const recommendationRequestSchema = z
  .object({
    dogId: dogIdSchema,
    origin: z.object({
      lat: z.number().min(-90).max(90),
      lon: z.number().min(-180).max(180)
    }),
    durationChoice: z.enum(["minimum", "recommended", "custom"]).default("recommended"),
    customMinutes: z.number().positive().max(600).optional(),
    /** "다시 추천받기": 캐시를 건너뛰고 새 시드로 코스를 다시 뽑는다. */
    refresh: z.boolean().default(false)
  })
  .refine((value) => value.durationChoice !== "custom" || value.customMinutes !== undefined, {
    message: "customMinutes is required when durationChoice is 'custom'.",
    path: ["customMinutes"]
  });
