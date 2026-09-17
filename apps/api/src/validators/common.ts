import { z } from "zod";

export const uuidSchema = z.string().uuid("Must be a valid UUID");

export const idParamsSchema = z.object({
  id: uuidSchema,
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const sortDirectionSchema = z.enum(["asc", "desc"]).default("desc");

export const mediaTypeSchema = z.enum(["SONG", "VIDEO"]);

/** Ensures exactly one media reference (songId or videoId) is present. */
export const singleMediaRefSchema = z
  .object({
    mediaType: mediaTypeSchema,
    songId: uuidSchema.optional(),
    videoId: uuidSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.mediaType === "SONG" && !value.songId) {
      ctx.addIssue({ code: "custom", path: ["songId"], message: "songId is required for SONG media" });
    }
    if (value.mediaType === "VIDEO" && !value.videoId) {
      ctx.addIssue({ code: "custom", path: ["videoId"], message: "videoId is required for VIDEO media" });
    }
    if (value.mediaType === "SONG" && value.videoId) {
      ctx.addIssue({ code: "custom", path: ["videoId"], message: "videoId must be empty for SONG media" });
    }
    if (value.mediaType === "VIDEO" && value.songId) {
      ctx.addIssue({ code: "custom", path: ["songId"], message: "songId must be empty for VIDEO media" });
    }
  });
