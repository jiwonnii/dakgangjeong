import { z } from "zod";

const uuidSchema = z.string().uuid();

export const notificationListQuerySchema = z.object({
  dogId: uuidSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20)
});

export const markNotificationsReadSchema = z.object({
  dogId: uuidSchema.optional()
});
