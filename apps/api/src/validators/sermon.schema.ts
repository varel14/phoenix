import { z } from "zod";
import { paginationSchema, uuidSchema } from "./common.js";

export const listSermonsQuerySchema = paginationSchema.extend({
  categoryId: uuidSchema.optional(),
  q: z.string().trim().min(1).max(100).optional(),
});

export const sermonStatusBodySchema = z.object({
  status: z.enum(["PUBLISHED", "HIDDEN"]),
});

export type ListSermonsQuery = z.infer<typeof listSermonsQuerySchema>;
