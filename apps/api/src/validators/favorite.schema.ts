import { z } from "zod";
import { mediaTypeSchema, paginationSchema } from "./common.js";

export const listFavoritesQuerySchema = paginationSchema.extend({
  mediaType: mediaTypeSchema.optional(),
});

export const createFavoriteBodySchema = z
  .object({
    mediaType: mediaTypeSchema,
    songId: z.string().uuid().optional(),
    videoId: z.string().uuid().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.mediaType === "SONG" && !value.songId) {
      ctx.addIssue({ code: "custom", path: ["songId"], message: "songId is required for SONG media" });
    }
    if (value.mediaType === "VIDEO" && !value.videoId) {
      ctx.addIssue({ code: "custom", path: ["videoId"], message: "videoId is required for VIDEO media" });
    }
  });

export type ListFavoritesQuery = z.infer<typeof listFavoritesQuerySchema>;
export type CreateFavoriteBody = z.infer<typeof createFavoriteBodySchema>;
