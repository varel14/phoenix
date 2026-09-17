import { z } from "zod";
import { paginationSchema, uuidSchema } from "./common.js";

export const createArtistBodySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  bio: z.string().trim().max(2000).nullish(),
  avatarUrl: z.string().url().nullish(),
});

export const updateArtistBodySchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  bio: z.string().trim().max(2000).nullish(),
  avatarUrl: z.string().url().nullish(),
  bannerUrl: z.string().url().nullish(),
});

export const listArtistsQuerySchema = paginationSchema.extend({
  q: z.string().trim().min(1).max(100).optional(),
});

export const createArtistSongParamsSchema = z.object({
  id: uuidSchema,
});

export const artistSongParamsSchema = z.object({
  id: uuidSchema,
  songId: uuidSchema,
});

export const artistVideoParamsSchema = z.object({
  id: uuidSchema,
  videoId: uuidSchema,
});

export type CreateArtistBody = z.infer<typeof createArtistBodySchema>;
export type UpdateArtistBody = z.infer<typeof updateArtistBodySchema>;
export type ListArtistsQuery = z.infer<typeof listArtistsQuerySchema>;
