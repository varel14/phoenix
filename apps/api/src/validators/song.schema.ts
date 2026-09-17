import { z } from "zod";
import { paginationSchema, sortDirectionSchema, uuidSchema } from "./common.js";

export const songSortSchema = z.enum(["publishedAt", "playCount", "title"]).default("publishedAt");

export const listSongsQuerySchema = paginationSchema.extend({
  sort: songSortSchema,
  order: sortDirectionSchema,
  artistId: uuidSchema.optional(),
  genre: z.string().min(1).max(50).optional(),
});

export const searchSongsQuerySchema = paginationSchema.extend({
  q: z.string().trim().min(1).max(100),
});

export const songMediaSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  audioUrl: z.string().url("audioUrl must be a valid URL"),
  thumbnailUrl: z.string().url().nullish(),
  genre: z.string().trim().min(1).max(50).nullish(),
  albumName: z.string().trim().min(1).max(200).nullish(),
  mimeType: z.string().trim().min(1).max(100).nullish(),
  durationSec: z.number().int().positive().max(86400).nullish(),
  fileSizeBytes: z.number().int().positive().nullish(),
  storageKey: z.string().trim().min(1).max(500).nullish(),
  isDownloadable: z.boolean().default(true),
});

export const createSongBodySchema = songMediaSchema;

export const updateSongBodySchema = songMediaSchema.partial();

export type ListSongsQuery = z.infer<typeof listSongsQuerySchema>;
export type SearchSongsQuery = z.infer<typeof searchSongsQuerySchema>;
export type CreateSongBody = z.infer<typeof createSongBodySchema>;
export type UpdateSongBody = z.infer<typeof updateSongBodySchema>;
