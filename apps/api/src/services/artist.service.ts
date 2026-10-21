import { Prisma } from "./../generated/prisma/client.js";
import {
  artistRepository,
  type ArtistDetail,
  type ArtistWithCounts,
} from "../repositories/artist.repository.js";
import { followRepository } from "../repositories/follow.repository.js";
import { songRepository } from "../repositories/song.repository.js";
import { videoRepository } from "../repositories/video.repository.js";
import { AppError } from "../lib/errors.js";
import { deleteStoredObject } from "../lib/object-storage.js";
import { pruneUndefined } from "../lib/prune.js";
import { buildPagination, type PaginationMeta } from "../lib/responses.js";
import type { SongWithArtist } from "../types/media.js";
import type { VideoWithArtist } from "../types/media.js";
import type {
  CreateArtistBody,
  UpdateArtistBody,
} from "../validators/artist.schema.js";
import type {
  CreateSongBody,
  UpdateSongBody,
} from "../validators/song.schema.js";
import type {
  CreateVideoBody,
  UpdateVideoBody,
} from "../validators/video.schema.js";

export interface ArtistStats {
  /** Total song plays (legacy field). */
  plays: number;
  /** Total video views (legacy field). */
  views: number;
  /** Song + video downloads (legacy field). */
  downloads: number;
  /** Follower count (legacy field). */
  subscribers: number;
  /** Songs + videos added to favorites. */
  favorites: number;
  /** Number of published songs. */
  songs: number;
  /** Number of published videos. */
  videos: number;
  topSongs: Array<{
    id: string;
    title: string;
    playCount: number;
    downloadCount: number;
    favorites: number;
  }>;
  topVideos: Array<{
    id: string;
    title: string;
    viewCount: number;
    downloadCount: number;
  }>;
  /** One entry per day for the last 30 days (inclusive of today). */
  daily: Array<{ date: string; plays: number; views: number }>;
  /** Distinct listeners across all songs (lifetime, from playback events). */
  uniqueListeners: number;
  /** Money earned from paid song downloads (1 FCFA each), in XOF. */
  downloadRevenue: number;
  /** Every published song with its activity/popularity breakdown. */
  songStats: Array<{
    id: string;
    title: string;
    thumbnailUrl: string | null;
    durationSec: number | null;
    publishedAt: Date;
    playCount: number;
    downloadCount: number;
    favorites: number;
    uniqueListeners: number;
    plays30d: number;
  }>;
}

/** Ensures the artist exists AND belongs to the acting user. */
async function requireOwnedArtist(artistId: string, userId: string) {
  const artist = await artistRepository.findByIdRef(artistId);
  if (!artist) throw AppError.notFound("Artist");
  if (artist.userId !== userId) {
    // Do not reveal other artists' resources; 404 rather than 403.
    throw AppError.notFound("Artist");
  }
  return artist;
}

export const artistService = {
  async list(query: {
    q?: string | undefined;
    page: number;
    limit: number;
  }): Promise<{ artists: ArtistWithCounts[]; pagination: PaginationMeta }> {
    const [artists, total] = await Promise.all([
      artistRepository.findMany(query),
      artistRepository.countMany(query.q),
    ]);
    return {
      artists,
      pagination: buildPagination(query.page, query.limit, total),
    };
  },

  async getById(
    id: string,
    userId?: string | undefined,
  ): Promise<ArtistDetail & { isFollowing?: boolean }> {
    const artist = await artistRepository.findById(id);
    if (!artist) throw AppError.notFound("Artist");
    if (userId) {
      const isFollowing = await followRepository.isFollowing(userId, id);
      return { ...artist, isFollowing };
    }
    return artist;
  },

  async getByUserId(userId: string) {
    return artistRepository.findByUserId(userId);
  },

  /** Any user can claim an artist profile; their role is upgraded to ARTIST. */
  async becomeArtist(userId: string, body: CreateArtistBody) {
    const existing = await artistRepository.findByUserId(userId);
    if (existing) throw AppError.conflict("You already have an artist profile");
    return artistRepository.createWithRoleUpgrade(userId, pruneUndefined(body));
  },

  async update(artistId: string, userId: string, body: UpdateArtistBody) {
    await requireOwnedArtist(artistId, userId);
    return artistRepository.update(artistId, pruneUndefined(body));
  },

  // -- Publishing ------------------------------------------------------------

  async publishSong(
    artistId: string,
    userId: string,
    body: CreateSongBody,
  ): Promise<SongWithArtist> {
    await requireOwnedArtist(artistId, userId);
    return songRepository.create(artistId, pruneUndefined(body));
  },

  async updateSong(
    artistId: string,
    songId: string,
    userId: string,
    body: UpdateSongBody,
  ): Promise<SongWithArtist> {
    await requireOwnedArtist(artistId, userId);
    const song = await songRepository.findByIdForArtist(songId);
    if (!song || song.artistId !== artistId) throw AppError.notFound("Song");
    return songRepository.update(songId, pruneUndefined(body));
  },

  async removeSong(
    artistId: string,
    songId: string,
    userId: string,
  ): Promise<void> {
    await requireOwnedArtist(artistId, userId);
    const song = await songRepository.findByIdForArtist(songId);
    if (!song || song.artistId !== artistId) throw AppError.notFound("Song");
    await songRepository.remove(songId);
    // Best-effort storage cleanup; the catalog row is already gone.
    if (song.storageKey) await deleteStoredObject(song.storageKey);
  },

  async publishVideo(
    artistId: string,
    userId: string,
    body: CreateVideoBody,
  ): Promise<VideoWithArtist> {
    await requireOwnedArtist(artistId, userId);
    return videoRepository.create(artistId, pruneUndefined(body));
  },

  async updateVideo(
    artistId: string,
    videoId: string,
    userId: string,
    body: UpdateVideoBody,
  ): Promise<VideoWithArtist> {
    await requireOwnedArtist(artistId, userId);
    const video = await videoRepository.findByIdRef(videoId);
    if (!video || video.artistId !== artistId) throw AppError.notFound("Video");
    return videoRepository.update(videoId, pruneUndefined(body));
  },

  async removeVideo(
    artistId: string,
    videoId: string,
    userId: string,
  ): Promise<void> {
    await requireOwnedArtist(artistId, userId);
    const video = await videoRepository.findByIdRef(videoId);
    if (!video || video.artistId !== artistId) throw AppError.notFound("Video");
    await videoRepository.remove(videoId);
    if (video.storageKey) await deleteStoredObject(video.storageKey);
  },

  // -- Catalog listings ------------------------------------------------------

  async listArtistSongs(
    artistId: string,
    page: number,
    limit: number,
  ): Promise<{ songs: SongWithArtist[]; pagination: PaginationMeta }> {
    const artist = await artistRepository.findByIdRef(artistId);
    if (!artist) throw AppError.notFound("Artist");
    const [songs, total] = await Promise.all([
      artistRepository.listArtistSongs(artistId, page, limit),
      artistRepository.countArtistSongs(artistId),
    ]);
    return { songs, pagination: buildPagination(page, limit, total) };
  },

  async listArtistVideos(
    artistId: string,
    page: number,
    limit: number,
  ): Promise<{ videos: VideoWithArtist[]; pagination: PaginationMeta }> {
    const artist = await artistRepository.findByIdRef(artistId);
    if (!artist) throw AppError.notFound("Artist");
    const [videos, total] = await Promise.all([
      artistRepository.listArtistVideos(artistId, page, limit),
      artistRepository.countArtistVideos(artistId),
    ]);
    return { videos, pagination: buildPagination(page, limit, total) };
  },

  // -- Follows ---------------------------------------------------------------

  async follow(userId: string, artistId: string): Promise<void> {
    const artist = await artistRepository.findByIdRef(artistId);
    if (!artist) throw AppError.notFound("Artist");
    if (artist.userId === userId) {
      throw AppError.badRequest("You cannot follow your own artist profile");
    }
    try {
      await followRepository.follow(userId, artistId);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw AppError.conflict("You are already following this artist");
      }
      throw error;
    }
  },

  async unfollow(userId: string, artistId: string): Promise<void> {
    const removed = await followRepository.unfollow(userId, artistId);
    if (removed === 0) throw AppError.notFound("Follow");
  },

  async listFollowing(userId: string, page: number, limit: number) {
    const [follows, total] = await Promise.all([
      followRepository.listByUser(userId, page, limit),
      followRepository.countByUser(userId),
    ]);
    return { follows, pagination: buildPagination(page, limit, total) };
  },

  // -- Stats -----------------------------------------------------------------

  async stats(artistId: string, userId: string): Promise<ArtistStats> {
    await requireOwnedArtist(artistId, userId);
    return artistRepository.stats(artistId);
  },
};
