import type { Prisma } from "./../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import { artistSummarySelect, songInclude, videoInclude } from "../types/media.js";

const artistDetailInclude = {
  songs: {
    include: songInclude,
    orderBy: { playCount: "desc" as const },
    take: 5,
  },
  videos: {
    include: videoInclude,
    orderBy: { viewCount: "desc" as const },
    take: 5,
  },
  _count: {
    select: { songs: true, videos: true, followers: true },
  },
} satisfies Prisma.ArtistInclude;

export type ArtistWithCounts = Prisma.ArtistGetPayload<{ include: { _count: { select: { songs: true; videos: true; followers: true } } } }>;
export type ArtistDetail = Prisma.ArtistGetPayload<{ include: typeof artistDetailInclude }>;

export const artistRepository = {
  async findMany(query: { q?: string | undefined; page: number; limit: number }): Promise<ArtistWithCounts[]> {
    const where: Prisma.ArtistWhereInput = query.q
      ? { name: { contains: query.q, mode: "insensitive" } }
      : {};
    return prisma.artist.findMany({
      where,
      include: { _count: { select: { songs: true, videos: true, followers: true } } },
      orderBy: [{ isVerified: "desc" }, { createdAt: "desc" }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
  },

  async countMany(q?: string | undefined): Promise<number> {
    const where: Prisma.ArtistWhereInput = q ? { name: { contains: q, mode: "insensitive" } } : {};
    return prisma.artist.count({ where });
  },

  async findById(id: string): Promise<ArtistDetail | null> {
    return prisma.artist.findUnique({
      where: { id },
      include: artistDetailInclude,
    });
  },

  async findByIdRef(id: string) {
    return prisma.artist.findUnique({
      where: { id },
      select: { id: true, userId: true, name: true },
    });
  },

  async findByUserId(userId: string) {
    return prisma.artist.findUnique({ where: { userId } });
  },

  async createWithRoleUpgrade(
    userId: string,
    data: Omit<Prisma.ArtistUncheckedCreateInput, "userId">,
  ) {
    return prisma.$transaction(async (tx) => {
      const artist = await tx.artist.create({ data: { ...data, userId } });
      await tx.user.update({ where: { id: userId }, data: { role: "ARTIST" } });
      return artist;
    });
  },

  async update(id: string, data: Prisma.ArtistUncheckedUpdateInput) {
    return prisma.artist.update({ where: { id }, data });
  },

  async stats(id: string) {
    const [songAgg, videoAgg, followers] = await Promise.all([
      prisma.song.aggregate({ where: { artistId: id }, _sum: { playCount: true, downloadCount: true } }),
      prisma.video.aggregate({ where: { artistId: id }, _sum: { viewCount: true, downloadCount: true } }),
      prisma.artistFollow.count({ where: { artistId: id } }),
    ]);
    return {
      plays: songAgg._sum.playCount ?? 0,
      views: videoAgg._sum.viewCount ?? 0,
      downloads: (songAgg._sum.downloadCount ?? 0) + (videoAgg._sum.downloadCount ?? 0),
      subscribers: followers,
    };
  },

  async listArtistSongs(artistId: string, page: number, limit: number) {
    return prisma.song.findMany({
      where: { artistId },
      include: songInclude,
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });
  },

  async countArtistSongs(artistId: string): Promise<number> {
    return prisma.song.count({ where: { artistId } });
  },

  async listArtistVideos(artistId: string, page: number, limit: number) {
    return prisma.video.findMany({
      where: { artistId },
      include: videoInclude,
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });
  },

  async countArtistVideos(artistId: string): Promise<number> {
    return prisma.video.count({ where: { artistId } });
  },
};

export { artistSummarySelect };
