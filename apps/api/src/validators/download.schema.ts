import { z } from "zod";
import { paginationSchema, singleMediaRefSchema } from "./common.js";

export const createDownloadBodySchema = singleMediaRefSchema;

export const listDownloadsQuerySchema = paginationSchema.extend({
  mediaType: z.enum(["SONG", "VIDEO"]).optional(),
});

export type CreateDownloadBody = z.infer<typeof createDownloadBodySchema>;
export type ListDownloadsQuery = z.infer<typeof listDownloadsQuerySchema>;
