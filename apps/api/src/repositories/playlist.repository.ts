import type { Prisma } from "./../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import { songInclude } from "../types/media.js";

const playlistItemInclude = {
  song: { include: songInclude },
} satisfies Prisma.playlistItemInclude;

export type PlaylistItemWithSong = Prisma.playlistItemGetPayload<{ include: typeof playlistItemInclude }>;
export type PlaylistWithCounts = Prisma.PlaylistGetPayload<{
  include: { _count: { select: { items: true } } };
}>;

export const playlistRepository = {
  async findManyByUser(
    userId: string,
    page: number,
    limit: number,
  ): Promise<PlaylistWithCounts[]> {
    return prisma.playlist.findMany({
      where: { userId },
      include: {
        _count: { select: { items: true } },
      },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });
  },

  async countByUser(userId: string): Promise<number> {
    return prisma.playlist.count({ where: { userId } });
  },

  async findById(id: string): Promise<PlaylistWithCounts | null> {
    return prisma.playlist.findUnique({
      where: { id },
      include: { _count: { select: { items: true } } },
    });
  },

  async findByIdRef(id: string) {
    return prisma.playlist.findUnique({
      where: { id },
      select: { id: true, userId: true, isPublic: true },
    });
  },

  async create(userId: string, data: Omit<Prisma.PlaylistUncheckedCreateInput, "userId">) {
    return prisma.playlist.create({ data: { ...data, userId } });
  },

  async update(id: string, data: Prisma.PlaylistUncheckedUpdateInput) {
    return prisma.playlist.update({ where: { id }, data });
  },

  async remove(id: string): Promise<void> {
    await prisma.playlist.delete({ where: { id } });
  },

  async findItem(playlistId: string, itemId: string): Promise<PlaylistItemWithSong | null> {
    return prisma.playlistItem.findFirst({
      where: { id: itemId, playlistId },
      include: playlistItemInclude,
    });
  },

  async findItemBySong(playlistId: string, songId: string) {
    return prisma.playlistItem.findUnique({
      where: { playlistId_songId: { playlistId, songId } },
      select: { id: true },
    });
  },

  async listItems(playlistId: string, page: number, limit: number): Promise<PlaylistItemWithSong[]> {
    return prisma.playlistItem.findMany({
      where: { playlistId },
      include: playlistItemInclude,
      orderBy: { position: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    });
  },

  async countItems(playlistId: string): Promise<number> {
    return prisma.playlistItem.count({ where: { playlistId } });
  },

  async nextPosition(playlistId: string, tx?: Prisma.TransactionClient): Promise<number> {
    const client = tx ?? prisma;
    const last = await client.playlistItem.findFirst({
      where: { playlistId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    return (last?.position ?? -1) + 1;
  },

  async addItem(playlistId: string, songId: string, position: number, tx?: Prisma.TransactionClient) {
    const client = tx ?? prisma;
    return client.playlistItem.create({
      data: { playlistId, songId, position },
      include: playlistItemInclude,
    });
  },

  async removeItem(itemId: string): Promise<void> {
    await prisma.playlistItem.delete({ where: { id: itemId } });
  },
};
