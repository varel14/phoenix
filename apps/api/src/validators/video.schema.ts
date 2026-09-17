import { z } from "zod";
import { paginationSchema, sortDirectionSchema, uuidSchema } from "./common.js";

export const videoSortSchema = z.enum(["publishedAt", "viewCount", "title"]).default("publishedAt");

export const listVideosQuerySchema = paginationSchema.extend({
  sort: videoSortSchema,
  order: sortDirectionSchema,
  artistId: uuidSchema.optional(),
});

export const searchVideosQuerySchema = paginationSchema.extend({
  q: z.string().trim().min(1).max(100),
});

export const videoMediaSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().max(2000).nullish(),
  videoUrl: z.string().url("videoUrl must be a valid URL"),
  thumbnailUrl: z.string().url().nullish(),
  mimeType: z.string().trim().min(1).max(100).nullish(),
  durationSec: z.number().int().positive().max(86400).nullish(),
  fileSizeBytes: z.number().int().positive().nullish(),
  storageKey: z.string().trim().min(1).max(500).nullish(),
  isDownloadable: z.boolean().default(true),
});

export const createVideoBodySchema = videoMediaSchema;

export const updateVideoBodySchema = videoMediaSchema.partial();

export type ListVideosQuery = z.infer<typeof listVideosQuerySchema>;
export type SearchVideosQuery = z.infer<typeof searchVideosQuerySchema>;
export type CreateVideoBody = z.infer<typeof createVideoBodySchema>;
export type UpdateVideoBody = z.infer<typeof updateVideoBodySchema>;
