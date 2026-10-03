import type { Request, Response } from "express";
import { callService } from "../services/call.service.js";
import { sendPaginated, sendSuccess } from "../lib/responses.js";
import { AppError } from "../lib/errors.js";
import { getIceServers } from "../lib/ice.js";
import { validatedQuery } from "../middleware/validate.js";
import type { AuthenticatedUser } from "../types/express.d.js";
import type { ListCallsQuery } from "../validators/call.schema.js";

function requireUser(req: Request): AuthenticatedUser {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}

export const callController = {
  async iceServers(req: Request, res: Response) {
    const user = requireUser(req);
    sendSuccess(res, { iceServers: getIceServers(user.id) });
  },

  async list(req: Request, res: Response) {
    const user = requireUser(req);
    const query = validatedQuery<ListCallsQuery>(req);
    const { calls, pagination } = await callService.list(user.id, query);
    sendPaginated(res, calls, pagination);
  },
};
