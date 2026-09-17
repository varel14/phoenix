import type { Request, Response } from "express";
import { songService } from "../services/song.service.js";
import { favoriteService } from "../services/favorite.service.js";
import { sendPaginated, sendSuccess } from "../lib/responses.js";
import { AppError } from "../lib/errors.js";
import { validatedBody, validatedParams, validatedQuery } from "../middleware/validate.js";
import type { AuthenticatedUser } from "../types/express.d.js";
import type { ListSongsQuery, SearchSongsQuery } from "../validators/song.schema.js";
import type { idParamsSchema } from "../validators/common.js";
import type { z } from "zod";

function requireUser(req: Request): AuthenticatedUser {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}

export const songController = {
  async list(req: Request, res: Response) {
    const query = validatedQuery<ListSongsQuery>(req);
    const { songs, pagination } = await songService.list(query);
    sendPaginated(res, songs, pagination);
  },

  async search(req: Request, res: Response) {
    const query = validatedQuery<SearchSongsQuery>(req);
    const { songs, pagination } = await songService.search(query);
    sendPaginated(res, songs, pagination);
  },

  async getById(req: Request, res: Response) {
    const { id } = validatedParams<z.infer<typeof idParamsSchema>>(req);
    const song = await songService.getById(id);
    sendSuccess(res, song);
  },

  async favorite(req: Request, res: Response) {
    const user = requireUser(req);
    const { id } = validatedParams<z.infer<typeof idParamsSchema>>(req);
    const favorite = await favoriteService.create(user.id, { mediaType: "SONG", songId: id });
    sendSuccess(res, favorite, 201);
  },

  async unfavorite(req: Request, res: Response) {
    const user = requireUser(req);
    const { id } = validatedParams<z.infer<typeof idParamsSchema>>(req);
    await favoriteService.removeSongFavorite(user.id, id);
    sendSuccess(res, { removed: true });
  },
};
