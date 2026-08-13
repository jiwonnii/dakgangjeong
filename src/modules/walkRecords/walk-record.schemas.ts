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

export const recommendedCourseSchema = z.object({
  rank: z.number().int().min(1),
  direction: z.string().trim().min(1).max(40).optional(),
  distanceMeters: z.number().int().min(0),
  durationMinutes: z.number().int().min(0),
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
  likedNotes: z.string().max(1000).optional(),
  dislikedNotes: z.string().max(1000).optional()
});

export const walkStreakQuerySchema = z.object({
  dogId: uuidSchema.optional()
});

export const inProgressWalkRecordQuerySchema = z.object({
  dogId: uuidSchema.optional()
});
