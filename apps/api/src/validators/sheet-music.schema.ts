import { z } from "zod";
import { paginationSchema, uuidSchema } from "./common.js";

export const createSheetMusicJobBodySchema = z
  .object({
    sourceType: z.enum(["SONG", "UPLOAD"]),
    /** Phoenix catalog song to analyze (sourceType SONG). */
    songId: uuidSchema.optional(),
    /** Storage key returned by the transcription upload endpoint (sourceType UPLOAD). */
    storageKey: z.string().min(1).max(500).optional(),
    sourceName: z.string().trim().min(1).max(200).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.sourceType === "SONG" && !value.songId) {
      ctx.addIssue({ code: "custom", path: ["songId"], message: "songId is required for SONG sources" });
    }
    if (value.sourceType === "SONG" && value.storageKey) {
      ctx.addIssue({ code: "custom", path: ["storageKey"], message: "storageKey must be empty for SONG sources" });
    }
    if (value.sourceType === "UPLOAD" && !value.storageKey) {
      ctx.addIssue({ code: "custom", path: ["storageKey"], message: "storageKey is required for UPLOAD sources" });
    }
  });

export const listSheetMusicJobsQuerySchema = paginationSchema;

export type CreateSheetMusicJobBody = z.infer<typeof createSheetMusicJobBodySchema>;
export type ListSheetMusicJobsQuery = z.infer<typeof listSheetMusicJobsQuerySchema>;
