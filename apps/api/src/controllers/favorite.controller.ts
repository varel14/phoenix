import type { Request, Response } from "express";
import { favoriteService } from "../services/favorite.service.js";
import { sendPaginated, sendSuccess } from "../lib/responses.js";
import { AppError } from "../lib/errors.js";
import { validatedBody, validatedParams, validatedQuery } from "../middleware/validate.js";
import type { AuthenticatedUser } from "../types/express.d.js";
import type { CreateFavoriteBody, ListFavoritesQuery } from "../validators/favorite.schema.js";
import type { idParamsSchema } from "../validators/common.js";
import type { z } from "zod";

function requireUser(req: Request): AuthenticatedUser {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}

export const favoriteController = {
  async list(req: Request, res: Response) {
    const user = requireUser(req);
    const query = validatedQuery<ListFavoritesQuery>(req);
    const { favorites, pagination } = await favoriteService.list(user.id, query);
    sendPaginated(res, favorites, pagination);
  },

  async create(req: Request, res: Response) {
    const user = requireUser(req);
    const body = validatedBody<CreateFavoriteBody>(req);
    const favorite = await favoriteService.create(user.id, body);
    sendSuccess(res, favorite, 201);
  },

  async remove(req: Request, res: Response) {
    const user = requireUser(req);
    const { id } = validatedParams<z.infer<typeof idParamsSchema>>(req);
    await favoriteService.remove(user.id, id);
    sendSuccess(res, { removed: true });
  },
};
