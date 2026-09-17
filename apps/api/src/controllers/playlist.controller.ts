import type { Request, Response } from "express";
import { playlistService } from "../services/playlist.service.js";
import { sendPaginated, sendSuccess } from "../lib/responses.js";
import { AppError } from "../lib/errors.js";
import { validatedBody, validatedParams, validatedQuery } from "../middleware/validate.js";
import type { AuthenticatedUser } from "../types/express.d.js";
import type {
  AddPlaylistItemBody,
  CreatePlaylistBody,
  ListPlaylistsQuery,
  UpdatePlaylistBody,
} from "../validators/playlist.schema.js";
import type { idParamsSchema } from "../validators/common.js";
import type { z } from "zod";

function requireUser(req: Request): AuthenticatedUser {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}

export const playlistController = {
  async list(req: Request, res: Response) {
    const user = requireUser(req);
    const query = validatedQuery<ListPlaylistsQuery>(req);
    const { playlists, pagination } = await playlistService.listMine(user.id, query.page, query.limit);
    sendPaginated(res, playlists, pagination);
  },

  async create(req: Request, res: Response) {
    const user = requireUser(req);
    const body = validatedBody<CreatePlaylistBody>(req);
    const playlist = await playlistService.create(user.id, body);
    sendSuccess(res, playlist, 201);
  },

  async getById(req: Request, res: Response) {
    const user = requireUser(req);
    const { id } = validatedParams<z.infer<typeof idParamsSchema>>(req);
    const playlist = await playlistService.getById(id, user.id);
    sendSuccess(res, playlist);
  },

  async update(req: Request, res: Response) {
    const user = requireUser(req);
    const { id } = validatedParams<z.infer<typeof idParamsSchema>>(req);
    const body = validatedBody<UpdatePlaylistBody>(req);
    const playlist = await playlistService.update(id, user.id, body);
    sendSuccess(res, playlist);
  },

  async remove(req: Request, res: Response) {
    const user = requireUser(req);
    const { id } = validatedParams<z.infer<typeof idParamsSchema>>(req);
    await playlistService.remove(id, user.id);
    sendSuccess(res, { removed: true });
  },

  async listItems(req: Request, res: Response) {
    const user = requireUser(req);
    const { id } = validatedParams<z.infer<typeof idParamsSchema>>(req);
    const query = validatedQuery<ListPlaylistsQuery>(req);
    const { items, pagination } = await playlistService.listItems(id, user.id, query.page, query.limit);
    sendPaginated(res, items, pagination);
  },

  async addItem(req: Request, res: Response) {
    const user = requireUser(req);
    const { id } = validatedParams<z.infer<typeof idParamsSchema>>(req);
    const body = validatedBody<AddPlaylistItemBody>(req);
    const item = await playlistService.addItem(id, user.id, body);
    sendSuccess(res, item, 201);
  },

  async removeItem(req: Request, res: Response) {
    const user = requireUser(req);
    const { id, itemId } = validatedParams<{ id: string; itemId: string }>(req);
    await playlistService.removeItem(id, itemId, user.id);
    sendSuccess(res, { removed: true });
  },
};
