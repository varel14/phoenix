import type { Request, Response } from "express";
import { eventService } from "../services/event.service.js";
import { sendSuccess } from "../lib/responses.js";
import { AppError } from "../lib/errors.js";
import { validatedBody } from "../middleware/validate.js";
import type { AuthenticatedUser } from "../types/express.d.js";
import type { BatchEventsBody, PlaybackEventBody } from "../validators/event.schema.js";

function requireUser(req: Request): AuthenticatedUser {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}

export const eventController = {
  /** Single playback/view/download event. Idempotent by clientEventId. */
  async playback(req: Request, res: Response) {
    const user = requireUser(req);
    const body = validatedBody<PlaybackEventBody>(req);
    const outcome = await eventService.ingest(user.id, body);
    sendSuccess(res, { clientEventId: body.clientEventId, status: outcome }, 202);
  },

  /** Batch endpoint used by the mobile offline event queue. */
  async batch(req: Request, res: Response) {
    const user = requireUser(req);
    const body = validatedBody<BatchEventsBody>(req);
    const result = await eventService.ingestBatch(user.id, body.events);
    sendSuccess(res, result, 200);
  },
};
