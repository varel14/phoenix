import { z } from "zod";
import { singleMediaRefSchema } from "./common.js";

export const playbackEventBodySchema = singleMediaRefSchema.extend({
  eventType: z.enum(["PLAY", "VIEW", "DOWNLOAD"]),
  clientEventId: z.string().uuid("clientEventId must be a client-generated UUID"),
  occurredAt: z.coerce.date(),
});

export const batchEventsBodySchema = z.object({
  events: z.array(playbackEventBodySchema).min(1).max(500),
});

export type PlaybackEventBody = z.infer<typeof playbackEventBodySchema>;
export type BatchEventsBody = z.infer<typeof batchEventsBodySchema>;
