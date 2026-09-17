import type { Prisma, Video } from "./../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import { videoInclude, type VideoWithArtist } from "../types/media.js";
import type { ListVideosQuery, SearchVideosQuery } from "../validators/video.schema.js";

function buildWhere(query: Partial<ListVideosQuery>): Prisma.VideoWhereInput {
  const where: Prisma.VideoWhereInput = {};
  if (query.artistId) where.artistId = query.artistId;
  return where;
}

export const videoRepository = {
  async findMany(query: ListVideosQuery): Promise<VideoWithArtist[]> {
    return prisma.video.findMany({
      where: buildWhere(query),
      include: videoInclude,
      orderBy: { [query.sort]: query.order },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
  },

  async count(query: Partial<ListVideosQuery>): Promise<number> {
    return prisma.video.count({ where: buildWhere(query) });
  },

  async search(query: SearchVideosQuery): Promise<VideoWithArtist[]> {
    const q = query.q;
    return prisma.video.findMany({
      where: {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
          { artist: { name: { contains: q, mode: "insensitive" } } },
        ],
      },
      include: videoInclude,
      orderBy: { viewCount: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
  },

  async countSearch(q: string): Promise<number> {
    return prisma.video.count({
      where: {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
          { artist: { name: { contains: q, mode: "insensitive" } } },
        ],
      },
    });
  },

  async findById(id: string): Promise<VideoWithArtist | null> {
    return prisma.video.findUnique({ where: { id }, include: videoInclude });
  },

  async findByIdRef(id: string): Promise<Pick<Video, "id" | "artistId"> | null> {
    return prisma.video.findUnique({ where: { id }, select: { id: true, artistId: true } });
  },

  async create(artistId: string, data: Omit<Prisma.VideoUncheckedCreateInput, "artistId">): Promise<VideoWithArtist> {
    return prisma.video.create({ data: { ...data, artistId }, include: videoInclude });
  },

  async update(id: string, data: Prisma.VideoUncheckedUpdateInput): Promise<VideoWithArtist> {
    return prisma.video.update({ where: { id }, data, include: videoInclude });
  },

  async remove(id: string): Promise<void> {
    await prisma.video.delete({ where: { id } });
  },

  async incrementViewCount(id: string, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? prisma;
    await client.video.update({ where: { id }, data: { viewCount: { increment: 1 } } });
  },

  async incrementDownloadCount(id: string, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? prisma;
    await client.video.update({ where: { id }, data: { downloadCount: { increment: 1 } } });
  },
};
