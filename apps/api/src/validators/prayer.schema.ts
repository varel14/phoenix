import { z } from "zod";
import { paginationSchema, userIdSchema, uuidSchema } from "./common.js";

export const prayerStatusSchema = z.enum(["DRAFT", "PUBLISHED", "HIDDEN"]);

export const listPrayersQuerySchema = paginationSchema.extend({
  categoryId: uuidSchema.optional(),
  authorId: userIdSchema.optional(),
  /** Full-text filter on title and content. */
  q: z.string().trim().min(1).max(100).optional(),
  scope: z.enum(["PUBLIC", "MINE"]).default("PUBLIC"),
});

export const createPrayerBodySchema = z.object({
  title: z.string().trim().min(2, "Title is too short").max(150),
  content: z.string().trim().max(20000).optional(),
  categoryId: uuidSchema,
  audioUrl: z.string().min(1).max(2048).optional(),
  audioStorageKey: z.string().max(500).optional(),
  audioDurationSec: z.coerce.number().int().min(1).max(3600).optional(),
  status: prayerStatusSchema.default("DRAFT"),
});

export const updatePrayerBodySchema = createPrayerBodySchema
  .extend({ categoryId: uuidSchema.optional() })
  .partial();

export const listPrayerFavoritesQuerySchema = paginationSchema;

export type PrayerStatus = z.infer<typeof prayerStatusSchema>;
export type ListPrayersQuery = z.infer<typeof listPrayersQuerySchema>;
export type CreatePrayerBody = z.infer<typeof createPrayerBodySchema>;
export type UpdatePrayerBody = z.infer<typeof updatePrayerBodySchema>;
export type ListPrayerFavoritesQuery = z.infer<typeof listPrayerFavoritesQuerySchema>;
