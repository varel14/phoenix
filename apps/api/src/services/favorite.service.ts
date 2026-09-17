import { Prisma } from "./../generated/prisma/client.js";
import { favoriteRepository, type FavoriteWithMedia } from "../repositories/favorite.repository.js";
import { songRepository } from "../repositories/song.repository.js";
import { videoRepository } from "../repositories/video.repository.js";
import { AppError } from "../lib/errors.js";
import { buildPagination, type PaginationMeta } from "../lib/responses.js";
import type { CreateFavoriteBody } from "../validators/favorite.schema.js";

export const favoriteService = {
  async list(
    userId: string,
    options: { page: number; limit: number; mediaType?: "SONG" | "VIDEO" | undefined },
  ): Promise<{ favorites: FavoriteWithMedia[]; pagination: PaginationMeta }> {
    const [favorites, total] = await Promise.all([
      favoriteRepository.findManyByUser(userId, options),
      favoriteRepository.countByUser(userId, options.mediaType),
    ]);
    return { favorites, pagination: buildPagination(options.page, options.limit, total) };
  },

  async create(userId: string, body: CreateFavoriteBody): Promise<FavoriteWithMedia> {
    if (body.mediaType === "SONG") {
      const song = await songRepository.findById(body.songId!);
      if (!song) throw AppError.notFound("Song");
      try {
        await favoriteRepository.createSongFavorite(userId, body.songId!);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          throw AppError.conflict("Song is already in your favorites");
        }
        throw error;
      }
    } else {
      const video = await videoRepository.findById(body.videoId!);
      if (!video) throw AppError.notFound("Video");
      try {
        await favoriteRepository.createVideoFavorite(userId, body.videoId!);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          throw AppError.conflict("Video is already in your favorites");
        }
        throw error;
      }
    }

    const favorites = await favoriteRepository.findManyByUser(userId, { page: 1, limit: 1, mediaType: body.mediaType });
    // Fetch the exact record we just created to hand it back.
    const created = favorites.find((f) =>
      body.mediaType === "SONG" ? f.songId === body.songId : f.videoId === body.videoId,
    );
    if (!created) throw AppError.notFound("Favorite");
    return created;
  },

  async remove(userId: string, favoriteId: string): Promise<void> {
    const favorite = await favoriteRepository.findByIdRef(favoriteId);
    if (!favorite || favorite.userId !== userId) throw AppError.notFound("Favorite");
    await favoriteRepository.remove(favoriteId);
  },

  async removeSongFavorite(userId: string, songId: string): Promise<void> {
    const removed = await favoriteRepository.removeSongFavorite(userId, songId);
    if (removed === 0) throw AppError.notFound("Favorite");
  },

  async removeVideoFavorite(userId: string, videoId: string): Promise<void> {
    const removed = await favoriteRepository.removeVideoFavorite(userId, videoId);
    if (removed === 0) throw AppError.notFound("Favorite");
  },
};
