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
    const result = await prisma.artistFollow.deleteMany({
      where: { userId, artistId },
    });
    return result.count;
  },

  async isFollowing(userId: string, artistId: string): Promise<boolean> {
    const count = await prisma.artistFollow.count({
      where: { userId, artistId },
    });
    return count > 0;
  },

  async listByUser(
    userId: string,
    page: number,
    limit: number,
  ): Promise<FollowWithArtist[]> {
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

/** Minimal user reference shared by follow/recipient payloads. */
export type UserFollowRef = { id: string; name: string; image: string | null };

const userRefSelect = { id: true, name: true, image: true } as const;

/** User-to-user follow graph — mutual ACCEPTED follows power wallet payments
 * and unlock chatting. New follows are PENDING until the recipient accepts. */
export const userFollowRepository = {
  async follow(
    followerId: string,
    followingId: string,
    status: "PENDING" | "ACCEPTED" = "PENDING",
  ): Promise<void> {
    await prisma.userFollow.create({
      data: { followerId, followingId, status },
    });
  },

  async findEdge(followerId: string, followingId: string) {
    return prisma.userFollow.findUnique({
      where: { followerId_followingId: { followerId, followingId } },
      select: { id: true, status: true },
    });
  },

  /** My outgoing edges toward `userIds`, with status — for list enrichment. */
  async findEdgesFrom(
    userId: string,
    userIds: string[],
  ): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (userIds.length === 0) return map;
    const rows = await prisma.userFollow.findMany({
      where: { followerId: userId, followingId: { in: userIds } },
      select: { followingId: true, status: true },
    });
    for (const row of rows) map.set(row.followingId, row.status);
    return map;
  },

  /** Which of `userIds` have a PENDING incoming request toward `userId`? */
  async findPendingIncomingIds(
    userId: string,
    userIds: string[],
  ): Promise<Set<string>> {
    if (userIds.length === 0) return new Set();
    const rows = await prisma.userFollow.findMany({
      where: {
        followerId: { in: userIds },
        followingId: userId,
        status: "PENDING",
      },
      select: { followerId: true },
    });
    return new Set(rows.map((row) => row.followerId));
  },

  /** Promotes a pending request to ACCEPTED (idempotent no-op when absent). */
  async accept(followerId: string, followingId: string): Promise<boolean> {
    const result = await prisma.userFollow.updateMany({
      where: { followerId, followingId, status: "PENDING" },
      data: { status: "ACCEPTED" },
    });
    return result.count > 0;
  },

  async unfollow(followerId: string, followingId: string): Promise<number> {
    const result = await prisma.userFollow.deleteMany({
      where: { followerId, followingId },
    });
    return result.count;
  },

  /** Which of `userIds` does `userId` follow with ANY edge (PENDING or ACCEPTED)? */
  async findAnyFollowingIds(
    userId: string,
    userIds: string[],
  ): Promise<Set<string>> {
    if (userIds.length === 0) return new Set();
    const rows = await prisma.userFollow.findMany({
      where: { followerId: userId, followingId: { in: userIds } },
      select: { followingId: true },
    });
    return new Set(rows.map((row) => row.followingId));
  },

  /** Outgoing edges of any status (wallet contact pool includes pending). */
  async listOutgoingAny(userId: string, take = 50): Promise<UserFollowRef[]> {
    const rows = await prisma.userFollow.findMany({
      where: { followerId: userId },
      select: { following: { select: userRefSelect } },
      orderBy: { createdAt: "desc" },
      take,
    });
    return rows.map((row) => row.following);
  },

  /** Which of `userIds` does `userId` follow (ACCEPTED only)? */
  async findFollowingIds(
    userId: string,
    userIds: string[],
  ): Promise<Set<string>> {
    if (userIds.length === 0) return new Set();
    const rows = await prisma.userFollow.findMany({
      where: {
        followerId: userId,
        followingId: { in: userIds },
        status: "ACCEPTED",
      },
      select: { followingId: true },
    });
    return new Set(rows.map((row) => row.followingId));
  },

  /** Which of `userIds` follow `userId` back (ACCEPTED only)? */
  async findFollowerIds(
    userId: string,
    userIds: string[],
  ): Promise<Set<string>> {
    if (userIds.length === 0) return new Set();
    const rows = await prisma.userFollow.findMany({
      where: {
        followerId: { in: userIds },
        followingId: userId,
        status: "ACCEPTED",
      },
      select: { followerId: true },
    });
    return new Set(rows.map((row) => row.followerId));
  },

  /** Pending follow requests awaiting `userId`'s acceptance. */
  async findPendingIncoming(
    userId: string,
    take = 50,
  ): Promise<UserFollowRef[]> {
    const rows = await prisma.userFollow.findMany({
      where: { followingId: userId, status: "PENDING" },
      select: { follower: { select: userRefSelect } },
      orderBy: { createdAt: "desc" },
      take,
    });
    return rows.map((row) => row.follower);
  },

  /** Users `userId` follows who follow them back — the payment inner circle. */
  async findMutualFollowing(
    userId: string,
    take = 20,
  ): Promise<UserFollowRef[]> {
    const rows = await prisma.userFollow.findMany({
      where: {
        followerId: userId,
        status: "ACCEPTED",
        // The followed user's own ACCEPTED follow points back at us.
        following: {
          userFollowing: { some: { followingId: userId, status: "ACCEPTED" } },
        },
      },
      select: { following: { select: userRefSelect } },
      orderBy: { createdAt: "desc" },
      take,
    });
    return rows.map((row) => row.following);
  },

  /** Everyone `userId` follows (newest first), for the follows list. */
  async listFollowing(userId: string, take = 50): Promise<UserFollowRef[]> {
    const rows = await prisma.userFollow.findMany({
      where: { followerId: userId, status: "ACCEPTED" },
      select: { following: { select: userRefSelect } },
      orderBy: { createdAt: "desc" },
      take,
    });
    return rows.map((row) => row.following);
  },
};
