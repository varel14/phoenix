import type { Request, Response } from "express";
import { z } from "zod";
import { getFollowState, userService } from "../services/user.service.js";
import { sendSuccess } from "../lib/responses.js";
import { AppError } from "../lib/errors.js";
import { validatedParams } from "../middleware/validate.js";
import type { idParamsSchema } from "../validators/common.js";
import type { AuthenticatedUser } from "../types/express.d.js";

function requireUser(req: Request): AuthenticatedUser {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}

/** Follow-graph endpoints for wallet payments between mutual follows. */
export const userController = {
  async follow(req: Request, res: Response) {
    const user = requireUser(req);
    const { id } = validatedParams<z.infer<typeof idParamsSchema>>(req);
    const state = await userService.follow(user.id, id);
    sendSuccess(res, state, 201);
  },

  async unfollow(req: Request, res: Response) {
    const user = requireUser(req);
    const { id } = validatedParams<z.infer<typeof idParamsSchema>>(req);
    const state = await userService.unfollow(user.id, id);
    sendSuccess(res, state);
  },

  async followState(req: Request, res: Response) {
    const user = requireUser(req);
    const { id } = validatedParams<z.infer<typeof idParamsSchema>>(req);
    const state = await getFollowState(user.id, id);
    sendSuccess(res, state);
  },

  async listFollowing(req: Request, res: Response) {
    const user = requireUser(req);
    const following = await userService.listFollowing(user.id);
    sendSuccess(res, following);
  },

  async listFollowRequests(req: Request, res: Response) {
    const user = requireUser(req);
    const requests = await userService.listFollowRequests(user.id);
    sendSuccess(res, requests);
  },

  async acceptFollowRequest(req: Request, res: Response) {
    const user = requireUser(req);
    const { followerId } = req.params as { followerId: string };
    await userService.acceptFollowRequest(user.id, followerId);
    sendSuccess(res, { accepted: true });
  },

  async rejectFollowRequest(req: Request, res: Response) {
    const user = requireUser(req);
    const { followerId } = req.params as { followerId: string };
    await userService.rejectFollowRequest(user.id, followerId);
    sendSuccess(res, { accepted: false });
  },
};
