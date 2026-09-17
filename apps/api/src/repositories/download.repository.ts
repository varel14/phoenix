import type { Prisma } from "./../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import { songInclude, videoInclude } from "../types/media.js";

export type DownloadWithMedia = Prisma.DownloadGetPayload<{
  include: { song: { include: typeof songInclude }; video: { include: typeof videoInclude } };
}>;

export const downloadRepository = {
  async upsertSongDownload(userId: string, songId: string): Promise<DownloadWithMedia | null> {
    return prisma.download.upsert({
      where: { userId_songId: { userId, songId } },
      update: { status: "COMPLETED", completedAt: new Date() },
      create: { userId, songId, status: "COMPLETED", completedAt: new Date() },
      include: { song: { include: songInclude }, video: { include: videoInclude } },
    });
  },

  async upsertVideoDownload(userId: string, videoId: string): Promise<DownloadWithMedia | null> {
    return prisma.download.upsert({
      where: { userId_videoId: { userId, videoId } },
      update: { status: "COMPLETED", completedAt: new Date() },
      create: { userId, videoId, status: "COMPLETED", completedAt: new Date() },
      include: { song: { include: songInclude }, video: { include: videoInclude } },
    });
  },

  async findManyByUser(
    userId: string,
    options: { page: number; limit: number; mediaType?: "SONG" | "VIDEO" | undefined },
  ): Promise<DownloadWithMedia[]> {
    const where: Prisma.DownloadWhereInput = { userId };
    if (options.mediaType === "SONG") where.songId = { not: null };
    if (options.mediaType === "VIDEO") where.videoId = { not: null };
    return prisma.download.findMany({
      where,
      include: { song: { include: songInclude }, video: { include: videoInclude } },
      orderBy: { createdAt: "desc" },
      skip: (options.page - 1) * options.limit,
      take: options.limit,
    });
  },

  async countByUser(userId: string, mediaType?: "SONG" | "VIDEO" | undefined): Promise<number> {
    const where: Prisma.DownloadWhereInput = { userId };
    if (mediaType === "SONG") where.songId = { not: null };
    if (mediaType === "VIDEO") where.videoId = { not: null };
    return prisma.download.count({ where });
  },

  async findByIdRef(id: string) {
    return prisma.download.findUnique({ where: { id }, select: { id: true, userId: true } });
  },

  async remove(id: string): Promise<void> {
    await prisma.download.delete({ where: { id } });
  },
};
