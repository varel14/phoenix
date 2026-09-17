import { playlistRepository, type PlaylistItemWithSong, type PlaylistWithCounts } from "../repositories/playlist.repository.js";
import { songRepository } from "../repositories/song.repository.js";
import { AppError } from "../lib/errors.js";
import { pruneUndefined } from "../lib/prune.js";
import { buildPagination, type PaginationMeta } from "../lib/responses.js";
import type { AddPlaylistItemBody, CreatePlaylistBody, UpdatePlaylistBody } from "../validators/playlist.schema.js";

/** Loads the playlist only if the user owns it; 404 otherwise (no existence leak). */
async function requireOwnedPlaylist(playlistId: string, userId: string) {
  const playlist = await playlistRepository.findByIdRef(playlistId);
  if (!playlist || playlist.userId !== userId) throw AppError.notFound("Playlist");
  return playlist;
}

export const playlistService = {
  async listMine(userId: string, page: number, limit: number): Promise<{ playlists: PlaylistWithCounts[]; pagination: PaginationMeta }> {
    const [playlists, total] = await Promise.all([
      playlistRepository.findManyByUser(userId, page, limit),
      playlistRepository.countByUser(userId),
    ]);
    return { playlists, pagination: buildPagination(page, limit, total) };
  },

  /**
   * Owners see their playlists always; everyone else only when public.
   * Private playlists of other users return 404.
   */
  async getById(playlistId: string, userId: string): Promise<PlaylistWithCounts> {
    const playlist = await playlistRepository.findById(playlistId);
    if (!playlist || (playlist.userId !== userId && !playlist.isPublic)) {
      throw AppError.notFound("Playlist");
    }
    return playlist;
  },

  async create(userId: string, body: CreatePlaylistBody): Promise<PlaylistWithCounts> {
    const playlist = await playlistRepository.create(userId, {
      name: body.name,
      description: body.description ?? null,
      isPublic: body.isPublic,
    });
    return { ...playlist, _count: { items: 0 } };
  },

  async update(playlistId: string, userId: string, body: UpdatePlaylistBody): Promise<PlaylistWithCounts> {
    await requireOwnedPlaylist(playlistId, userId);
    await playlistRepository.update(playlistId, pruneUndefined(body));
    const updated = await playlistRepository.findById(playlistId);
    if (!updated) throw AppError.notFound("Playlist");
    return updated;
  },

  async remove(playlistId: string, userId: string): Promise<void> {
    await requireOwnedPlaylist(playlistId, userId);
    await playlistRepository.remove(playlistId);
  },

  async addItem(playlistId: string, userId: string, body: AddPlaylistItemBody): Promise<PlaylistItemWithSong> {
    await requireOwnedPlaylist(playlistId, userId);

    const song = await songRepository.findByIdForArtist(body.songId);
    if (!song) throw AppError.notFound("Song");

    const existing = await playlistRepository.findItemBySong(playlistId, body.songId);
    if (existing) throw AppError.conflict("This song is already in the playlist");

    return playlistRepository.addItem(playlistId, body.songId, await playlistRepository.nextPosition(playlistId));
  },

  async removeItem(playlistId: string, itemId: string, userId: string): Promise<void> {
    await requireOwnedPlaylist(playlistId, userId);
    const item = await playlistRepository.findItem(playlistId, itemId);
    if (!item) throw AppError.notFound("Playlist item");
    await playlistRepository.removeItem(itemId);
  },

  async listItems(
    playlistId: string,
    userId: string,
    page: number,
    limit: number,
  ): Promise<{ items: PlaylistItemWithSong[]; pagination: PaginationMeta }> {
    await playlistService.getById(playlistId, userId); // visibility rules apply
    const [items, total] = await Promise.all([
      playlistRepository.listItems(playlistId, page, limit),
      playlistRepository.countItems(playlistId),
    ]);
    return { items, pagination: buildPagination(page, limit, total) };
  },
};
