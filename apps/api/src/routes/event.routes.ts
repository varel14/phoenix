import { Router } from "express";
import { eventController } from "../controllers/event.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { batchEventsBodySchema, playbackEventBodySchema } from "../validators/event.schema.js";

export const eventRouter = Router();

eventRouter.use(requireAuth);

// Single event (e.g. live PLAY/VIEW). Idempotent by clientEventId.
eventRouter.post("/playback", validate({ body: playbackEventBodySchema }), eventController.playback);

// Batch sync for the offline queue.
eventRouter.post("/batch", validate({ body: batchEventsBodySchema }), eventController.batch);
