import type { Prisma } from "./../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import { artistSummarySelect } from "../types/media.js";

export type FollowWithArtist = Prisma.ArtistFollowGetPayload<{
  include: { artist: { select: typeof artistSummarySelect & { bio: true } } };
}>;

export const followRepository = {
  async follow(userId: string, artistId: string): Promise<void> {
    await prisma.artistFollow.create({ data: { userId, artistId } });
  },

  async unfollow(userId: string, artistId: string): Promise<number> {
    const result = await prisma.artistFollow.deleteMany({ where: { userId, artistId } });
    return result.count;
  },

  async isFollowing(userId: string, artistId: string): Promise<boolean> {
    const count = await prisma.artistFollow.count({ where: { userId, artistId } });
    return count > 0;
  },

  async listByUser(userId: string, page: number, limit: number): Promise<FollowWithArtist[]> {
    return prisma.artistFollow.findMany({
      where: { userId },
      include: { artist: { select: { ...artistSummarySelect, bio: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });
  },

  async countByUser(userId: string): Promise<number> {
    return prisma.artistFollow.count({ where: { userId } });
  },
};
