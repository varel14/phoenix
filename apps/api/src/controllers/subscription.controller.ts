import type { Request, Response } from "express";
import { subscriptionService } from "../services/subscription.service.js";
import { sendSuccess } from "../lib/responses.js";
import { AppError } from "../lib/errors.js";
import { validatedBody, validatedQuery } from "../middleware/validate.js";
import type { AuthenticatedUser } from "../types/express.d.js";
import type { SubscribeBody, CancelSubscriptionQuery } from "../validators/subscription.schema.js";

function requireUser(req: Request): AuthenticatedUser {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}

export const subscriptionController = {
  async subscribe(req: Request, res: Response) {
    const user = requireUser(req);
    const body = validatedBody<SubscribeBody>(req) ?? {};
    const result = await subscriptionService.subscribe(user.id, body);
    sendSuccess(res, result, 201);
  },

  async status(req: Request, res: Response) {
    const user = requireUser(req);
    const status = await subscriptionService.getMyStatus(user.id);
    sendSuccess(res, status);
  },

  async cancel(req: Request, res: Response) {
    const user = requireUser(req);
    const query = validatedQuery<CancelSubscriptionQuery>(req) ?? {};
    const result = await subscriptionService.cancel(user.id, query.artistId);
    sendSuccess(res, result);
  },

  async myRoyalties(req: Request, res: Response) {
    const user = requireUser(req);
    const royalties = await subscriptionService.listMyRoyalties(user.id);
    sendSuccess(res, royalties);
  },

  async artistEarnings(req: Request, res: Response) {
    const user = requireUser(req);
    const earnings = await subscriptionService.getArtistEarnings(user.id);
    sendSuccess(res, earnings);
  },
};
