import { Router } from "express";
import { callController } from "../controllers/call.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { listCallsQuerySchema } from "../validators/call.schema.js";

export const callRouter = Router();

callRouter.use(requireAuth);

/** TURN/STUN configuration for WebRTC peers (turned per user for ephemeral credentials). */
callRouter.get("/ice-servers", callController.iceServers);

callRouter.get("/", validate({ query: listCallsQuerySchema }), callController.list);
