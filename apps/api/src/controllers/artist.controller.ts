import type { Request, Response } from "express";
import { artistService } from "../services/artist.service.js";
import { sendPaginated, sendSuccess } from "../lib/responses.js";
import { AppError } from "../lib/errors.js";
import { validatedBody, validatedParams, validatedQuery } from "../middleware/validate.js";
import type { AuthenticatedUser } from "../types/express.d.js";
import type {
  CreateArtistBody,
  ListArtistsQuery,
  UpdateArtistBody,
} from "../validators/artist.schema.js";
import type { CreateSongBody, UpdateSongBody } from "../validators/song.schema.js";
import type { CreateVideoBody, UpdateVideoBody } from "../validators/video.schema.js";
import type { idParamsSchema } from "../validators/common.js";
import type { paginationSchema } from "../validators/common.js";
import type { z } from "zod";

function requireUser(req: Request): AuthenticatedUser {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}

export const artistController = {
  async list(req: Request, res: Response) {
    const query = validatedQuery<ListArtistsQuery>(req);
    const { artists, pagination } = await artistService.list(query);
    sendPaginated(res, artists, pagination);
  },

  async getById(req: Request, res: Response) {
    const { id } = validatedParams<z.infer<typeof idParamsSchema>>(req);
    const artist = await artistService.getById(id, req.user?.id);
    sendSuccess(res, artist);
  },

  async getMe(req: Request, res: Response) {
    const user = requireUser(req);
    const artist = await artistService.getByUserId(user.id);
    sendSuccess(res, artist); // null when the user has no artist profile yet
  },

  async create(req: Request, res: Response) {
    const user = requireUser(req);
    const body = validatedBody<CreateArtistBody>(req);
    const artist = await artistService.becomeArtist(user.id, body);
    sendSuccess(res, artist, 201);
  },

  async update(req: Request, res: Response) {
    const user = requireUser(req);
    const { id } = validatedParams<z.infer<typeof idParamsSchema>>(req);
    const body = validatedBody<UpdateArtistBody>(req);
    const artist = await artistService.update(id, user.id, body);
    sendSuccess(res, artist);
  },

  // -- Song management ---------------------------------------------------------

  async publishSong(req: Request, res: Response) {
    const user = requireUser(req);
    const { id } = validatedParams<z.infer<typeof idParamsSchema>>(req);
    const body = validatedBody<CreateSongBody>(req);
    const song = await artistService.publishSong(id, user.id, body);
    sendSuccess(res, song, 201);
  },

  async updateSong(req: Request, res: Response) {
    const user = requireUser(req);
    const { id, songId } = validatedParams<{ id: string; songId: string }>(req);
    const body = validatedBody<UpdateSongBody>(req);
    const song = await artistService.updateSong(id, songId, user.id, body);
    sendSuccess(res, song);
  },

  async removeSong(req: Request, res: Response) {
    const user = requireUser(req);
    const { id, songId } = validatedParams<{ id: string; songId: string }>(req);
    await artistService.removeSong(id, songId, user.id);
    sendSuccess(res, { removed: true });
  },

  // -- Video management ----------------------------------------------------------

  async publishVideo(req: Request, res: Response) {
    const user = requireUser(req);
    const { id } = validatedParams<z.infer<typeof idParamsSchema>>(req);
    const body = validatedBody<CreateVideoBody>(req);
    const video = await artistService.publishVideo(id, user.id, body);
    sendSuccess(res, video, 201);
  },

  async updateVideo(req: Request, res: Response) {
    const user = requireUser(req);
    const { id, videoId } = validatedParams<{ id: string; videoId: string }>(req);
    const body = validatedBody<UpdateVideoBody>(req);
    const video = await artistService.updateVideo(id, videoId, user.id, body);
    sendSuccess(res, video);
  },

  async removeVideo(req: Request, res: Response) {
    const user = requireUser(req);
    const { id, videoId } = validatedParams<{ id: string; videoId: string }>(req);
    await artistService.removeVideo(id, videoId, user.id);
    sendSuccess(res, { removed: true });
  },

  // -- Catalog listings ------------------------------------------------------------

  async listSongs(req: Request, res: Response) {
    const { id } = validatedParams<z.infer<typeof idParamsSchema>>(req);
    const query = validatedQuery<z.infer<typeof paginationSchema>>(req);
    const result = await artistService.listArtistSongs(id, query.page, query.limit);
    sendPaginated(res, result.songs, result.pagination);
  },

  async listVideos(req: Request, res: Response) {
    const { id } = validatedParams<z.infer<typeof idParamsSchema>>(req);
    const query = validatedQuery<z.infer<typeof paginationSchema>>(req);
    const result = await artistService.listArtistVideos(id, query.page, query.limit);
    sendPaginated(res, result.videos, result.pagination);
  },

  // -- Follows ---------------------------------------------------------------------

  async follow(req: Request, res: Response) {
    const user = requireUser(req);
    const { id } = validatedParams<z.infer<typeof idParamsSchema>>(req);
    await artistService.follow(user.id, id);
    sendSuccess(res, { following: true }, 201);
  },

  async unfollow(req: Request, res: Response) {
    const user = requireUser(req);
    const { id } = validatedParams<z.infer<typeof idParamsSchema>>(req);
    await artistService.unfollow(user.id, id);
    sendSuccess(res, { following: false });
  },

  async listFollowing(req: Request, res: Response) {
    const user = requireUser(req);
    const query = validatedQuery<z.infer<typeof paginationSchema>>(req);
    const result = await artistService.listFollowing(user.id, query.page, query.limit);
    sendPaginated(res, result.follows, result.pagination);
  },

  // -- Stats -----------------------------------------------------------------------

  async stats(req: Request, res: Response) {
    const user = requireUser(req);
    const { id } = validatedParams<z.infer<typeof idParamsSchema>>(req);
    const stats = await artistService.stats(id, user.id);
    sendSuccess(res, stats);
  },
};
