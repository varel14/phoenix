import type { Request, Response } from "express";
import { videoService } from "../services/video.service.js";
import { favoriteService } from "../services/favorite.service.js";
import { sendPaginated, sendSuccess } from "../lib/responses.js";
import { AppError } from "../lib/errors.js";
import { validatedParams, validatedQuery } from "../middleware/validate.js";
import type { AuthenticatedUser } from "../types/express.d.js";
import type { ListVideosQuery, SearchVideosQuery } from "../validators/video.schema.js";
import type { idParamsSchema } from "../validators/common.js";
import type { z } from "zod";

function requireUser(req: Request): AuthenticatedUser {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}

export const videoController = {
  async list(req: Request, res: Response) {
    const query = validatedQuery<ListVideosQuery>(req);
    const { videos, pagination } = await videoService.list(query);
    sendPaginated(res, videos, pagination);
  },

  async search(req: Request, res: Response) {
    const query = validatedQuery<SearchVideosQuery>(req);
    const { videos, pagination } = await videoService.search(query);
    sendPaginated(res, videos, pagination);
  },

  async getById(req: Request, res: Response) {
    const { id } = validatedParams<z.infer<typeof idParamsSchema>>(req);
    const video = await videoService.getById(id);
    sendSuccess(res, video);
  },

  async favorite(req: Request, res: Response) {
    const user = requireUser(req);
    const { id } = validatedParams<z.infer<typeof idParamsSchema>>(req);
    const favorite = await favoriteService.create(user.id, { mediaType: "VIDEO", videoId: id });
    sendSuccess(res, favorite, 201);
  },

  async unfavorite(req: Request, res: Response) {
    const user = requireUser(req);
    const { id } = validatedParams<z.infer<typeof idParamsSchema>>(req);
    await favoriteService.removeVideoFavorite(user.id, id);
    sendSuccess(res, { removed: true });
  },
};
