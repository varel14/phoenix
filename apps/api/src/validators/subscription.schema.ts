import { z } from "zod";
import { uuidSchema } from "./common.js";

export const subscribeBodySchema = z.object({
  artistId: uuidSchema.optional(),
});

export const cancelSubscriptionQuerySchema = z.object({
  artistId: uuidSchema.optional(),
});

export type SubscribeBody = z.infer<typeof subscribeBodySchema>;
export type CancelSubscriptionQuery = z.infer<typeof cancelSubscriptionQuerySchema>;
