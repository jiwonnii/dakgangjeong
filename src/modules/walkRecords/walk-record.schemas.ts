import { z } from "zod";

const uuidSchema = z.string().uuid();
const isoDatetimeSchema = z.string().datetime({ offset: true });
const optionalIsoDatetimeSchema = isoDatetimeSchema.optional();

const coordinateSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  accuracy: z.number().nonnegative().optional(),
  recordedAt: isoDatetimeSchema.optional()
});

const geoJsonLineStringSchema = z.object({
  type: z.literal("LineString"),
  coordinates: z.array(z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]))
});

export const reviewFactorSchema = z.enum([
  "riskZones",
  "vehicleExposure",
  "pedestrianSafety",
  "environment",
  "familiarity",
  "fit"
]);

const recommendedCourseExplanationFactorSchema = z.object({
  key: reviewFactorSchema,
  label: z.string().trim().min(1).max(80),
  score: z.number().optional(),
  weight: z.number().optional(),
  contribution: z.number().optional(),
  detail: z.string().max(1000).optional(),
  preferenceAdjustment: z.number().optional()
});

export const recommendedCourseSchema = z.object({
  rank: z.number().int().min(1),
  direction: z.string().trim().min(1).max(40).optional(),
  /** Change 7: short feature-based display name (e.g. "공원 많은 길"),
   * max 8 Korean characters by product rule. The stored max here is looser
   * (40) than the display rule — see ai-explanation.service.ts's
   * truncateCourseName for the actual 8-char enforcement; this schema just
   * needs a generous ceiling so it never rejects a value the app itself
   * produced. */
  courseName: z.string().trim().min(1).max(40).optional(),
  distanceMeters: z.number().int().min(0),
  durationMinutes: z.number().int().min(0),
  score: z.number().optional(),
  aiExplanation: z.string().max(1000).optional(),
  explanation: z.object({
    summary: z.string().max(1000).optional(),
    factors: z.array(recommendedCourseExplanationFactorSchema).optional()
  }).optional(),
  /** Change 2/8: plain-language practical cautions for this course (risk
   * zones, vehicle exposure, stairs, etc.) — see buildCourseCautions in
   * recommendation.service.ts. */
  cautions: z.array(z.string().max(200)).optional(),
  facts: z.record(z.string(), z.unknown()).optional(),
  path: geoJsonLineStringSchema
});

export const walkRecordIdParamsSchema = z.object({
  walkRecordId: uuidSchema
});

export const listWalkRecordsQuerySchema = z.object({
  dogId: uuidSchema.optional(),
  from: optionalIsoDatetimeSchema,
  to: optionalIsoDatetimeSchema,
  limit: z.coerce.number().int().min(1).max(100).default(30),
  offset: z.coerce.number().int().min(0).default(0)
});

export const startWalkRecordSchema = z.object({
  dogId: uuidSchema,
  startedAt: optionalIsoDatetimeSchema,
  recommendedCourse: recommendedCourseSchema.optional()
});

export const finishWalkRecordSchema = z.object({
  endedAt: optionalIsoDatetimeSchema,
  distanceMeters: z.number().int().min(0),
  durationSeconds: z.number().int().min(0),
  path: z.array(coordinateSchema).min(0).default([]),
  rating: z.number().int().min(1).max(5).optional(),
  likedFactor: reviewFactorSchema.optional(),
  dislikedFactor: reviewFactorSchema.optional(),
  likedNotes: z.string().max(1000).optional(),
  dislikedNotes: z.string().max(1000).optional(),
  staticMapUrl: z.string().url().optional()
});

export const progressWalkRecordSchema = z.object({
  distanceMeters: z.number().int().min(0),
  path: z.array(coordinateSchema).min(0).default([])
});

export const manualWalkRecordSchema = z.object({
  dogId: uuidSchema,
  walkedAt: optionalIsoDatetimeSchema,
  distanceMeters: z.number().int().min(0),
  durationSeconds: z.number().int().min(1),
  rating: z.number().int().min(1).max(5).optional(),
  likedFactor: reviewFactorSchema.optional(),
  dislikedFactor: reviewFactorSchema.optional(),
  likedNotes: z.string().max(1000).optional(),
  dislikedNotes: z.string().max(1000).optional()
});

export const walkStreakQuerySchema = z.object({
  dogId: uuidSchema.optional()
});

export const inProgressWalkRecordQuerySchema = z.object({
  dogId: uuidSchema.optional()
});
