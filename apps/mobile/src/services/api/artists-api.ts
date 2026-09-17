import type { ArtistDetail, ArtistStats, ArtistWithCounts, Song, Video } from "@/types/api";
import { apiFetch, getPaginated } from "./api-client";

export const artistsApi = {
  async list(q?: string, page = 1, limit = 20) {
    return getPaginated<ArtistWithCounts>("/api/v1/artists", { q, page, limit });
  },

  async getById(id: string): Promise<ArtistDetail> {
    const result = await apiFetch<{ data: ArtistDetail }>(`/api/v1/artists/${id}`);
    return result.data;
  },

  async update(id: string, body: { name?: string; bio?: string | null; avatarUrl?: string | null; bannerUrl?: string | null }) {
    const result = await apiFetch<{ data: ArtistWithCounts }>(`/api/v1/artists/${id}`, {
      method: "PATCH",
      body,
    });
    return result.data;
  },

  async listSongs(id: string, page = 1, limit = 20) {
    return getPaginated<Song>(`/api/v1/artists/${id}/songs`, { page, limit });
  },

  async listVideos(id: string, page = 1, limit = 20) {
    return getPaginated<Video>(`/api/v1/artists/${id}/videos`, { page, limit });
  },

  async follow(id: string) {
    return apiFetch<{ data: { following: boolean } }>(`/api/v1/artists/${id}/follow`, { method: "POST" });
  },

  async unfollow(id: string) {
    return apiFetch<{ data: { following: boolean } }>(`/api/v1/artists/${id}/follow`, { method: "DELETE" });
  },

  async stats(id: string): Promise<ArtistStats> {
    const result = await apiFetch<{ data: ArtistStats }>(`/api/v1/artists/${id}/stats`);
    return result.data;
  },

  // -- Publishing (artist only) --------------------------------------------

  async publishSong(artistId: string, body: SongPublishBody) {
    const result = await apiFetch<{ data: Song }>(`/api/v1/artists/${artistId}/songs`, { method: "POST", body });
    return result.data;
  },

  async updateSong(artistId: string, songId: string, body: SongPublishBody) {
    const result = await apiFetch<{ data: Song }>(`/api/v1/artists/${artistId}/songs/${songId}`, {
      method: "PATCH",
      body,
    });
    return result.data;
  },

  async removeSong(artistId: string, songId: string) {
    return apiFetch<{ data: { removed: boolean } }>(`/api/v1/artists/${artistId}/songs/${songId}`, {
      method: "DELETE",
    });
  },

  async publishVideo(artistId: string, body: VideoPublishBody) {
    const result = await apiFetch<{ data: Video }>(`/api/v1/artists/${artistId}/videos`, {
      method: "POST",
      body,
    });
    return result.data;
  },

  async updateVideo(artistId: string, videoId: string, body: VideoPublishBody) {
    const result = await apiFetch<{ data: Video }>(`/api/v1/artists/${artistId}/videos/${videoId}`, {
      method: "PATCH",
      body,
    });
    return result.data;
  },

  async removeVideo(artistId: string, videoId: string) {
    return apiFetch<{ data: { removed: boolean } }>(`/api/v1/artists/${artistId}/videos/${videoId}`, {
      method: "DELETE",
    });
  },
};

export interface SongPublishBody {
  title: string;
  audioUrl: string;
  thumbnailUrl?: string | null;
  genre?: string | null;
  albumName?: string | null;
  mimeType?: string | null;
  durationSec?: number | null;
  fileSizeBytes?: number | null;
  isDownloadable?: boolean;
}

export interface VideoPublishBody {
  title: string;
  videoUrl: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  mimeType?: string | null;
  durationSec?: number | null;
  fileSizeBytes?: number | null;
  isDownloadable?: boolean;
}
