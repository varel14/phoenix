import type { Song, Video } from "@/types/api";
import { apiFetch, getPaginated } from "./api-client";

export interface SongListParams {
  page?: number;
  limit?: number;
  sort?: "publishedAt" | "playCount" | "title";
  order?: "asc" | "desc";
  artistId?: string;
  genre?: string;
}

export const songsApi = {
  async list(params: SongListParams = {}) {
    return getPaginated<Song>("/api/v1/songs", params);
  },

  async search(q: string, page = 1, limit = 20) {
    return getPaginated<Song>("/api/v1/songs/search", { q, page, limit });
  },

  async getById(id: string) {
    const result = await apiFetch<{ data: Song }>(`/api/v1/songs/${id}`);
    return result.data;
  },

  async favorite(id: string) {
    return apiFetch<{ data: unknown }>(`/api/v1/songs/${id}/favorite`, { method: "POST" });
  },

  async unfavorite(id: string) {
    return apiFetch<{ data: { removed: boolean } }>(`/api/v1/songs/${id}/favorite`, { method: "DELETE" });
  },
};

export interface VideoListParams {
  page?: number;
  limit?: number;
  sort?: "publishedAt" | "viewCount" | "title";
  order?: "asc" | "desc";
  artistId?: string;
}

export const videosApi = {
  async list(params: VideoListParams = {}) {
    return getPaginated<Video>("/api/v1/videos", params);
  },

  async search(q: string, page = 1, limit = 20) {
    return getPaginated<Video>("/api/v1/videos/search", { q, page, limit });
  },

  async getById(id: string) {
    const result = await apiFetch<{ data: Video }>(`/api/v1/videos/${id}`);
    return result.data;
  },

  async favorite(id: string) {
    return apiFetch<{ data: unknown }>(`/api/v1/videos/${id}/favorite`, { method: "POST" });
  },

  async unfavorite(id: string) {
    return apiFetch<{ data: { removed: boolean } }>(`/api/v1/videos/${id}/favorite`, { method: "DELETE" });
  },
};
