import type { Prisma, Song } from "./../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import { songInclude, type SongWithArtist } from "../types/media.js";
import type { ListSongsQuery, SearchSongsQuery } from "../validators/song.schema.js";

function buildWhere(query: Partial<ListSongsQuery>): Prisma.SongWhereInput {
  const where: Prisma.SongWhereInput = {};
  if (query.artistId) where.artistId = query.artistId;
  if (query.genre) where.genre = { equals: query.genre, mode: "insensitive" };
  return where;
}

export const songRepository = {
  async findMany(query: ListSongsQuery): Promise<SongWithArtist[]> {
    return prisma.song.findMany({
      where: buildWhere(query),
      include: songInclude,
      orderBy: { [query.sort]: query.order },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
  },

  async count(query: Partial<ListSongsQuery>): Promise<number> {
    return prisma.song.count({ where: buildWhere(query) });
  },

  async search(query: SearchSongsQuery): Promise<SongWithArtist[]> {
    const q = query.q;
    return prisma.song.findMany({
      where: {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { albumName: { contains: q, mode: "insensitive" } },
          { artist: { name: { contains: q, mode: "insensitive" } } },
        ],
      },
      include: songInclude,
      orderBy: { playCount: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
  },

  async countSearch(q: string): Promise<number> {
    return prisma.song.count({
      where: {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { albumName: { contains: q, mode: "insensitive" } },
          { artist: { name: { contains: q, mode: "insensitive" } } },
        ],
      },
    });
  },

  async findById(id: string): Promise<SongWithArtist | null> {
    return prisma.song.findUnique({ where: { id }, include: songInclude });
  },

  async findByIdForArtist(id: string): Promise<{ id: string; artistId: string; storageKey: string | null } | null> {
    return prisma.song.findUnique({ where: { id }, select: { id: true, artistId: true, storageKey: true } });
  },

  async create(artistId: string, data: Omit<Prisma.SongUncheckedCreateInput, "artistId">): Promise<SongWithArtist> {
    return prisma.song.create({ data: { ...data, artistId }, include: songInclude });
  },

  async update(id: string, data: Prisma.SongUncheckedUpdateInput): Promise<SongWithArtist> {
    return prisma.song.update({ where: { id }, data, include: songInclude });
  },

  async remove(id: string): Promise<void> {
    await prisma.song.delete({ where: { id } });
  },

  async incrementPlayCount(id: string, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? prisma;
    await client.song.update({ where: { id }, data: { playCount: { increment: 1 } } });
  },

  async incrementDownloadCount(id: string, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? prisma;
    await client.song.update({ where: { id }, data: { downloadCount: { increment: 1 } } });
  },
};
