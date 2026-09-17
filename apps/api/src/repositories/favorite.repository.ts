import type { Prisma, favorite } from "./../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import { songInclude, videoInclude, type SongWithArtist, type VideoWithArtist } from "../types/media.js";

export type FavoriteWithMedia = Prisma.favoriteGetPayload<{
  include: { song: { include: typeof songInclude }; video: { include: typeof videoInclude } };
}>;

export const favoriteRepository = {
  async findManyByUser(
    userId: string,
    options: { page: number; limit: number; mediaType?: "SONG" | "VIDEO" | undefined },
  ): Promise<FavoriteWithMedia[]> {
    const where: Prisma.favoriteWhereInput = { userId };
    if (options.mediaType === "SONG") where.songId = { not: null };
    if (options.mediaType === "VIDEO") where.videoId = { not: null };
    return prisma.favorite.findMany({
      where,
      include: {
        song: { include: songInclude },
        video: { include: videoInclude },
      },
      orderBy: { createdAt: "desc" },
      skip: (options.page - 1) * options.limit,
      take: options.limit,
    });
  },

  async countByUser(userId: string, mediaType?: "SONG" | "VIDEO" | undefined): Promise<number> {
    const where: Prisma.favoriteWhereInput = { userId };
    if (mediaType === "SONG") where.songId = { not: null };
    if (mediaType === "VIDEO") where.videoId = { not: null };
    return prisma.favorite.count({ where });
  },

  async createSongFavorite(userId: string, songId: string): Promise<favorite> {
    return prisma.favorite.create({ data: { userId, songId } });
  },

  async createVideoFavorite(userId: string, videoId: string): Promise<favorite> {
    return prisma.favorite.create({ data: { userId, videoId } });
  },

  async findByIdRef(id: string) {
    return prisma.favorite.findUnique({ where: { id }, select: { id: true, userId: true } });
  },

  async remove(id: string): Promise<void> {
    await prisma.favorite.delete({ where: { id } });
  },

  async removeSongFavorite(userId: string, songId: string): Promise<number> {
    const result = await prisma.favorite.deleteMany({ where: { userId, songId } });
    return result.count;
  },

  async removeVideoFavorite(userId: string, videoId: string): Promise<number> {
    const result = await prisma.favorite.deleteMany({ where: { userId, videoId } });
    return result.count;
  },

  async isSongFavorited(userId: string, songId: string): Promise<boolean> {
    const count = await prisma.favorite.count({ where: { userId, songId } });
    return count > 0;
  },

  async isVideoFavorited(userId: string, videoId: string): Promise<boolean> {
    const count = await prisma.favorite.count({ where: { userId, videoId } });
    return count > 0;
  },
};

export type { SongWithArtist, VideoWithArtist };
