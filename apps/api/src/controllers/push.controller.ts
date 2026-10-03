import type { Request, Response } from "express";
import { pushTokenService } from "../services/push-token.service.js";
import { sendSuccess } from "../lib/responses.js";
import { AppError } from "../lib/errors.js";
import { validatedBody } from "../middleware/validate.js";
import type { AuthenticatedUser } from "../types/express.d.js";
import type { DeletePushTokenBody, RegisterPushTokenBody } from "../validators/push.schema.js";

function requireUser(req: Request): AuthenticatedUser {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}

export const pushController = {
  async register(req: Request, res: Response) {
    const user = requireUser(req);
    const body = validatedBody<RegisterPushTokenBody>(req);
    const pushToken = await pushTokenService.register(user.id, body);
    sendSuccess(res, pushToken, 201);
  },

  async remove(req: Request, res: Response) {
    const user = requireUser(req);
    const body = validatedBody<DeletePushTokenBody>(req);
    await pushTokenService.remove(user.id, body);
    sendSuccess(res, { deleted: true });
  },
};
