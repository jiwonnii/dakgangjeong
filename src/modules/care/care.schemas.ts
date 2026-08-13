import { z } from "zod";

const uuidSchema = z.string().uuid();
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const timeSchema = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/);

export const careTaskTypeSchema = z.enum([
  "walk",
  "feed",
  "medicine",
  "grooming",
  "hospital",
  "other"
]);

export const careRoutineSchema = z.object({
  dogId: uuidSchema,
  taskType: careTaskTypeSchema,
  title: z.string().trim().min(1).max(120),
  instructions: z.string().trim().max(1000).optional(),
  frequency: z.enum(["once", "daily", "weekly", "monthly"]).default("daily"),
  intervalCount: z.number().int().positive().max(30).default(1),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).default([]),
  daysOfMonth: z.array(z.number().int().min(1).max(31)).default([]),
  timesOfDay: z.array(timeSchema).min(1).max(12).default(["09:00"]),
  startDate: dateSchema,
  endDate: dateSchema.optional(),
  timezone: z.string().trim().min(1).max(80).default("Asia/Seoul"),
  reminderMinutesBefore: z.array(z.number().int().min(0).max(10080)).default([]),
  isActive: z.boolean().default(true)
});

export const careScheduleQuerySchema = z.object({
  dogId: uuidSchema.optional(),
  date: dateSchema.optional()
});

export const careRoutineListQuerySchema = z.object({
  dogId: uuidSchema.optional(),
  includeInactive: z.coerce.boolean().default(false)
});

export const careTaskIdParamsSchema = z.object({
  taskId: uuidSchema
});

export const updateCareTaskSchema = z.object({
  status: z.enum(["pending", "completed", "skipped"]),
  note: z.string().trim().max(1000).optional()
});
