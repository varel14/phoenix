import { songRepository } from "../repositories/song.repository.js";
import { buildPagination, type PaginationMeta } from "../lib/responses.js";
import type { SongWithArtist } from "../types/media.js";
import type { CreateSongBody, ListSongsQuery, SearchSongsQuery, UpdateSongBody } from "../validators/song.schema.js";
import { AppError } from "../lib/errors.js";
import { pruneUndefined } from "../lib/prune.js";

export const songService = {
  async list(query: ListSongsQuery): Promise<{ songs: SongWithArtist[]; pagination: PaginationMeta }> {
    const [songs, total] = await Promise.all([
      songRepository.findMany(query),
      songRepository.count(query),
    ]);
    return { songs, pagination: buildPagination(query.page, query.limit, total) };
  },

  async search(query: SearchSongsQuery): Promise<{ songs: SongWithArtist[]; pagination: PaginationMeta }> {
    const [songs, total] = await Promise.all([
      songRepository.search(query),
      songRepository.countSearch(query.q),
    ]);
    return { songs, pagination: buildPagination(query.page, query.limit, total) };
  },

  async getById(id: string): Promise<SongWithArtist> {
    const song = await songRepository.findById(id);
    if (!song) throw AppError.notFound("Song");
    return song;
  },

  async create(artistId: string, body: CreateSongBody): Promise<SongWithArtist> {
    return songRepository.create(artistId, pruneUndefined(body));
  },

  async update(songId: string, artistId: string, body: UpdateSongBody): Promise<SongWithArtist> {
    const song = await songRepository.findByIdForArtist(songId);
    if (!song || song.artistId !== artistId) throw AppError.notFound("Song");
    return songRepository.update(songId, pruneUndefined(body));
  },

  async remove(songId: string, artistId: string): Promise<void> {
    const song = await songRepository.findByIdForArtist(songId);
    if (!song || song.artistId !== artistId) throw AppError.notFound("Song");
    await songRepository.remove(songId);
  },
};
