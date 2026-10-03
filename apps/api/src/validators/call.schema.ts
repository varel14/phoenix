import { z } from "zod";
import { paginationSchema, uuidSchema } from "./common.js";

export const listCallsQuerySchema = paginationSchema.extend({});

export type ListCallsQuery = z.infer<typeof listCallsQuerySchema>;
export type CallRecipientId = z.infer<typeof uuidSchema>;
