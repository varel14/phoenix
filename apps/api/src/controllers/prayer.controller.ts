import type { Request, Response } from "express";
import { prayerService, type Actor } from "../services/prayer.service.js";
import { sermonService } from "../services/sermon.service.js";
import { sendPaginated, sendSuccess } from "../lib/responses.js";
import { AppError } from "../lib/errors.js";
import { validatedBody, validatedParams, validatedQuery } from "../middleware/validate.js";
import type { AuthenticatedUser } from "../types/express.d.js";
import type {
  CreatePrayerBody,
  ListPrayerFavoritesQuery,
  ListPrayersQuery,
  UpdatePrayerBody,
} from "../validators/prayer.schema.js";
import type { ListSermonsQuery } from "../validators/sermon.schema.js";
import type { idParamsSchema } from "../validators/common.js";
import type { z } from "zod";

function actorOf(req: Request): Actor | null {
  const user = req.user as AuthenticatedUser | undefined;
  if (!user) return null;
  return { id: user.id, role: user.role };
}

function requireActor(req: Request): Actor {
  const actor = actorOf(req);
  if (!actor) throw AppError.unauthorized();
  return actor;
}

export const prayerController = {
  async list(req: Request, res: Response) {
    const query = validatedQuery<ListPrayersQuery>(req);
    const { prayers, pagination } = await prayerService.list(query, actorOf(req));
    sendPaginated(res, prayers, pagination);
  },

  async detail(req: Request, res: Response) {
    const { id } = validatedParams<z.infer<typeof idParamsSchema>>(req);
    const view = await prayerService.getById(id, actorOf(req));
    sendSuccess(res, view);
  },

  async create(req: Request, res: Response) {
    const actor = requireActor(req);
    const body = validatedBody<CreatePrayerBody>(req);
    const view = await prayerService.create(actor, body);
    sendSuccess(res, view, 201);
  },

  async update(req: Request, res: Response) {
    const actor = requireActor(req);
    const { id } = validatedParams<z.infer<typeof idParamsSchema>>(req);
    const body = validatedBody<UpdatePrayerBody>(req);
    const view = await prayerService.update(actor, id, body);
    sendSuccess(res, view);
  },

  async remove(req: Request, res: Response) {
    const actor = requireActor(req);
    const { id } = validatedParams<z.infer<typeof idParamsSchema>>(req);
    await prayerService.remove(actor, id);
    sendSuccess(res, { removed: true });
  },

  async addFavorite(req: Request, res: Response) {
    const actor = requireActor(req);
    const { id } = validatedParams<z.infer<typeof idParamsSchema>>(req);
    await prayerService.addFavorite(actor.id, id);
    sendSuccess(res, { isFavorite: true }, 201);
  },

  async removeFavorite(req: Request, res: Response) {
    const actor = requireActor(req);
    const { id } = validatedParams<z.infer<typeof idParamsSchema>>(req);
    await prayerService.removeFavorite(actor.id, id);
    sendSuccess(res, { isFavorite: false });
  },

  async listFavorites(req: Request, res: Response) {
    const actor = requireActor(req);
    const query = validatedQuery<ListPrayerFavoritesQuery>(req);
    const { prayers, pagination } = await prayerService.listFavorites(actor.id, query);
    sendPaginated(res, prayers, pagination);
  },
};

export const prayerCategoryController = {
  async list(_req: Request, res: Response) {
    const categories = await prayerService.listCategories({ activeOnly: true });
    sendSuccess(res, categories);
  },
};

export const sermonController = {
  async list(req: Request, res: Response) {
    const query = validatedQuery<ListSermonsQuery>(req);
    const { sermons, pagination } = await sermonService.list(query);
    sendPaginated(res, sermons, pagination);
  },

  async detail(req: Request, res: Response) {
    const { id } = validatedParams<z.infer<typeof idParamsSchema>>(req);
    const sermon = await sermonService.getById(id);
    sendSuccess(res, sermon);
  },
};
