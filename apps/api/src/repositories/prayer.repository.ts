import type { Prisma, PrayerCategory, Prayer, Sermon, user } from "./../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";

/** Author identity attached to prayers/sermons in API responses. */
export const authorSummarySelect = {
  id: true,
  name: true,
  image: true,
} as const;

export const prayerInclude = {
  category: true,
  author: { select: authorSummarySelect },
} satisfies Prisma.PrayerInclude;

export type PrayerWithRelations = Prisma.PrayerGetPayload<{ include: typeof prayerInclude }>;

export const sermonInclude = {
  category: true,
  author: { select: authorSummarySelect },
} satisfies Prisma.SermonInclude;

export type SermonWithRelations = Prisma.SermonGetPayload<{ include: typeof sermonInclude }>;

export interface ListPrayersOptions {
  page: number;
  limit: number;
  categoryId?: string | undefined;
  authorId?: string | undefined;
  q?: string | undefined;
  scope: "PUBLIC" | "MINE";
}

export const prayerRepository = {
  async findMany(options: ListPrayersOptions): Promise<PrayerWithRelations[]> {
    const where: Prisma.PrayerWhereInput = {};
    if (options.scope === "MINE") {
      if (options.authorId !== undefined) where.authorId = options.authorId;
    } else {
      where.status = "PUBLISHED";
      if (options.authorId) where.authorId = options.authorId;
    }
    if (options.categoryId) where.categoryId = options.categoryId;
    if (options.q) {
      where.OR = [
        { title: { contains: options.q, mode: "insensitive" } },
        { content: { contains: options.q, mode: "insensitive" } },
      ];
    }
    return prisma.prayer.findMany({
      where,
      include: prayerInclude,
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      skip: (options.page - 1) * options.limit,
      take: options.limit,
    });
  },

  async count(options: ListPrayersOptions): Promise<number> {
    const where: Prisma.PrayerWhereInput = {};
    if (options.scope === "MINE") {
      if (options.authorId !== undefined) where.authorId = options.authorId;
    } else {
      where.status = "PUBLISHED";
      if (options.authorId) where.authorId = options.authorId;
    }
    if (options.categoryId) where.categoryId = options.categoryId;
    if (options.q) {
      where.OR = [
        { title: { contains: options.q, mode: "insensitive" } },
        { content: { contains: options.q, mode: "insensitive" } },
      ];
    }
    return prisma.prayer.count({ where });
  },

  async findById(id: string): Promise<PrayerWithRelations | null> {
    return prisma.prayer.findUnique({ where: { id }, include: prayerInclude });
  },

  async findCategoryById(id: string): Promise<PrayerCategory | null> {
    return prisma.prayerCategory.findUnique({ where: { id } });
  },

  async listCategories(options: { activeOnly: boolean }): Promise<PrayerCategory[]> {
    return prisma.prayerCategory.findMany({
      where: options.activeOnly ? { isActive: true } : {},
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  },

  async create(
    authorId: string,
    data: Omit<Prisma.PrayerUncheckedCreateInput, "authorId">,
  ): Promise<PrayerWithRelations> {
    return prisma.prayer.create({ data: { ...data, authorId }, include: prayerInclude });
  },

  async update(id: string, data: Prisma.PrayerUncheckedUpdateInput): Promise<PrayerWithRelations> {
    return prisma.prayer.update({ where: { id }, data, include: prayerInclude });
  },

  async remove(id: string): Promise<void> {
    await prisma.prayer.delete({ where: { id } });
  },

  async setStatus(id: string, status: "DRAFT" | "PUBLISHED" | "HIDDEN"): Promise<PrayerWithRelations> {
    return prisma.prayer.update({
      where: { id },
      data: { status, ...(status === "PUBLISHED" ? { publishedAt: new Date() } : {}) },
      include: prayerInclude,
    });
  },

  async favoriteIdsForUser(userId: string, prayerIds: string[]): Promise<Set<string>> {
    if (prayerIds.length === 0) return new Set();
    const rows = await prisma.prayerFavorite.findMany({
      where: { userId, prayerId: { in: prayerIds } },
      select: { prayerId: true },
    });
    return new Set(rows.map((row) => row.prayerId));
  },

  async listFavorites(
    userId: string,
    options: { page: number; limit: number },
  ): Promise<PrayerWithRelations[]> {
    const favorites = await prisma.prayerFavorite.findMany({
      where: { userId },
      include: { prayer: { include: prayerInclude } },
      orderBy: { createdAt: "desc" },
      skip: (options.page - 1) * options.limit,
      take: options.limit,
    });
    return favorites.map((favorite) => favorite.prayer);
  },

  async countFavorites(userId: string): Promise<number> {
    return prisma.prayerFavorite.count({ where: { userId } });
  },

  async addFavorite(userId: string, prayerId: string): Promise<void> {
    await prisma.prayerFavorite.create({ data: { userId, prayerId } });
  },

  async removeFavorite(userId: string, prayerId: string): Promise<number> {
    const result = await prisma.prayerFavorite.deleteMany({ where: { userId, prayerId } });
    return result.count;
  },
};

export interface ListSermonsOptions {
  page: number;
  limit: number;
  categoryId?: string | undefined;
  q?: string | undefined;
}

export const sermonRepository = {
  async findMany(options: ListSermonsOptions): Promise<SermonWithRelations[]> {
    const where: Prisma.SermonWhereInput = { status: "PUBLISHED" };
    if (options.categoryId) where.categoryId = options.categoryId;
    if (options.q) {
      where.OR = [
        { title: { contains: options.q, mode: "insensitive" } },
        { description: { contains: options.q, mode: "insensitive" } },
        { speakerName: { contains: options.q, mode: "insensitive" } },
      ];
    }
    return prisma.sermon.findMany({
      where,
      include: sermonInclude,
      orderBy: { publishedAt: "desc" },
      skip: (options.page - 1) * options.limit,
      take: options.limit,
    });
  },

  async count(options: ListSermonsOptions): Promise<number> {
    const where: Prisma.SermonWhereInput = { status: "PUBLISHED" };
    if (options.categoryId) where.categoryId = options.categoryId;
    if (options.q) {
      where.OR = [
        { title: { contains: options.q, mode: "insensitive" } },
        { description: { contains: options.q, mode: "insensitive" } },
        { speakerName: { contains: options.q, mode: "insensitive" } },
      ];
    }
    return prisma.sermon.count({ where });
  },

  async findById(id: string): Promise<SermonWithRelations | null> {
    return prisma.sermon.findUnique({ where: { id }, include: sermonInclude });
  },

  async setStatus(id: string, status: "PUBLISHED" | "HIDDEN"): Promise<SermonWithRelations> {
    return prisma.sermon.update({ where: { id }, data: { status }, include: sermonInclude });
  },
};
