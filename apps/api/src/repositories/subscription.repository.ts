import type { Prisma, PageSubscription } from "./../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";

export type PageSubscriptionWithArtist = Prisma.PageSubscriptionGetPayload<{
  include: { artist: { select: { id: true; name: true; avatarUrl: true } } };
}>;

export const subscriptionRepository = {
  async findAnyByUserAndArtist(userId: string, artistId: string): Promise<PageSubscription | null> {
    return prisma.pageSubscription.findUnique({
      where: { userId_artistId: { userId, artistId } },
    });
  },

  findActiveByUserAndArtist(userId: string, artistId: string): Promise<PageSubscription | null> {
    return prisma.pageSubscription.findFirst({
      where: { userId, artistId, status: "ACTIVE", currentPeriodEnd: { gt: new Date() } },
    });
  },

  findActiveByUser(userId: string): Promise<PageSubscriptionWithArtist | null> {
    return prisma.pageSubscription.findFirst({
      where: { userId, status: "ACTIVE", currentPeriodEnd: { gt: new Date() } },
      include: { artist: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: { currentPeriodEnd: "desc" },
    });
  },

  async upsertActive(subscription: PageSubscription, period: { start: Date; end: Date }): Promise<PageSubscription> {
    return prisma.pageSubscription.update({
      where: { id: subscription.id },
      data: {
        status: "ACTIVE",
        autoRenew: true,
        cancelledAt: null,
        currentPeriodStart: period.start,
        currentPeriodEnd: period.end,
        monthlyAmount: subscription.monthlyAmount,
      },
    });
  },

  async create(
    userId: string,
    artistId: string,
    monthlyAmount: number,
    currency: string,
    periodEnd: Date,
  ): Promise<PageSubscription> {
    return prisma.pageSubscription.create({
      data: {
        userId,
        artistId,
        monthlyAmount,
        currency,
        status: "ACTIVE",
        autoRenew: true,
        currentPeriodStart: new Date(),
        currentPeriodEnd: periodEnd,
      },
    });
  },

  async cancel(id: string): Promise<PageSubscription> {
    return prisma.pageSubscription.update({
      where: { id },
      data: { status: "CANCELLED", autoRenew: false, cancelledAt: new Date() },
    });
  },

  /** COMPLETED downloads of a user whose file is still kept (royalty-bearing). */
  findRoyaltyBearingDownloads(userId: string) {
    return prisma.download.findMany({
      where: { userId, status: "COMPLETED" },
      select: {
        id: true,
        createdAt: true,
        song: { select: { artistId: true } },
        video: { select: { artistId: true } },
      },
    });
  },

  countCompletedDownloads(userId: string): Promise<number> {
    return prisma.download.count({ where: { userId, status: "COMPLETED" } });
  },

  async cancelAllByUser(userId: string): Promise<number> {
    const result = await prisma.pageSubscription.updateMany({
      where: { userId, status: "ACTIVE" },
      data: { status: "CANCELLED", autoRenew: false, cancelledAt: new Date() },
    });
    return result.count;
  },

  createRoyalty(data: { downloadId: string; artistId: string; userId: string; periodStart: Date; amount: number; currency: string }) {
    return prisma.downloadRoyalty.upsert({
      where: {
        downloadId_periodStart: { downloadId: data.downloadId, periodStart: data.periodStart },
      },
      create: data,
      update: {},
    });
  },

  createManyRoyalties(
    rows: Array<{ downloadId: string; artistId: string; userId: string; periodStart: Date; amount: number; currency: string }>,
  ): Promise<number> {
    if (rows.length === 0) return Promise.resolve(0);
    return prisma.downloadRoyalty
      .createMany({ data: rows, skipDuplicates: true })
      .then((result) => result.count);
  },

  countRoyaltiesByUser(userId: string, options?: { periodStart?: Date | undefined }): Promise<number> {
    return prisma.downloadRoyalty.count({
      where: { userId, ...(options?.periodStart ? { periodStart: options.periodStart } : {}) },
    });
  },

  sumRoyaltiesByUser(userId: string): Promise<number> {
    return prisma.downloadRoyalty
      .aggregate({ where: { userId }, _sum: { amount: true } })
      .then((result) => result._sum.amount ?? 0);
  },

  /** Royalty history for a payer, grouped by month (most recent first). */
  async listRoyaltyMonthsByUser(userId: string) {
    const rows = await prisma.downloadRoyalty.groupBy({
      by: ["periodStart"],
      where: { userId },
      _count: { id: true },
      _sum: { amount: true },
      orderBy: { periodStart: "desc" },
    });
    return rows.map((row) => ({
      periodStart: row.periodStart,
      downloads: row._count.id,
      amount: row._sum.amount ?? 0,
    }));
  },

  /** Artist earnings grouped by month. */
  async listRoyaltyMonthsByArtist(artistId: string) {
    const rows = await prisma.downloadRoyalty.groupBy({
      by: ["periodStart"],
      where: { artistId },
      _count: { id: true },
      _sum: { amount: true },
      orderBy: { periodStart: "desc" },
    });
    return rows.map((row) => ({
      periodStart: row.periodStart,
      downloads: row._count.id,
      amount: row._sum.amount ?? 0,
    }));
  },

  sumRoyaltiesByArtist(artistId: string): Promise<number> {
    return prisma.downloadRoyalty
      .aggregate({ where: { artistId }, _sum: { amount: true } })
      .then((result) => result._sum.amount ?? 0);
  },

  countActiveSubscribers(artistId: string): Promise<number> {
    return prisma.pageSubscription.count({ where: { artistId, status: "ACTIVE", currentPeriodEnd: { gt: new Date() } } });
  },

  findArtistByUserId(userId: string) {
    return prisma.artist.findUnique({ where: { userId }, select: { id: true, name: true } });
  },

  /** Default page to subscribe to (single-artist app): the oldest artist. */
  findDefaultArtist() {
    return prisma.artist.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true, name: true } });
  },
};
