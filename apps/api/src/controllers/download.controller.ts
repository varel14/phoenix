import type { Request, Response } from "express";
import { downloadService } from "../services/download.service.js";
import { sendPaginated, sendSuccess } from "../lib/responses.js";
import { AppError } from "../lib/errors.js";
import { validatedBody, validatedParams, validatedQuery } from "../middleware/validate.js";
import type { AuthenticatedUser } from "../types/express.d.js";
import type { CreateDownloadBody, ListDownloadsQuery } from "../validators/download.schema.js";
import type { idParamsSchema } from "../validators/common.js";
import type { z } from "zod";

function requireUser(req: Request): AuthenticatedUser {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}

export const downloadController = {
  /** Registers a completed download record (metadata only — media lives on the device). */
  async create(req: Request, res: Response) {
    const user = requireUser(req);
    const body = validatedBody<CreateDownloadBody>(req);
    const download = await downloadService.register(user.id, body);
    sendSuccess(res, download, 201);
  },

  async list(req: Request, res: Response) {
    const user = requireUser(req);
    const query = validatedQuery<ListDownloadsQuery>(req);
    const { downloads, pagination } = await downloadService.listMine(user.id, query);
    sendPaginated(res, downloads, pagination);
  },

  async remove(req: Request, res: Response) {
    const user = requireUser(req);
    const { id } = validatedParams<z.infer<typeof idParamsSchema>>(req);
    await downloadService.remove(user.id, id);
    sendSuccess(res, { removed: true });
  },
};
