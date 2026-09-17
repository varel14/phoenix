import { z } from "zod";
import { paginationSchema, uuidSchema } from "./common.js";

export const createPlaylistBodySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  description: z.string().trim().max(500).nullish(),
  isPublic: z.boolean().default(false),
});

export const updatePlaylistBodySchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(500).nullish(),
  isPublic: z.boolean().optional(),
});

export const addPlaylistItemBodySchema = z.object({
  songId: uuidSchema,
});

export const listPlaylistsQuerySchema = paginationSchema;

export const listPlaylistItemsQuerySchema = paginationSchema;

export type CreatePlaylistBody = z.infer<typeof createPlaylistBodySchema>;
export type UpdatePlaylistBody = z.infer<typeof updatePlaylistBodySchema>;
export type AddPlaylistItemBody = z.infer<typeof addPlaylistItemBodySchema>;
export type ListPlaylistsQuery = z.infer<typeof listPlaylistsQuerySchema>;
