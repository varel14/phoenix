import type { DownloadRecord, FavoriteRecord, MediaType, Playlist, PlaylistItem, Song } from "@/types/api";
import { apiFetch, getPaginated } from "./api-client";

// -- Playlists ---------------------------------------------------------------

export const playlistsApi = {
  async list(page = 1, limit = 50) {
    return getPaginated<Playlist>("/api/v1/playlists", { page, limit });
  },

  async create(body: { name: string; description?: string | null; isPublic?: boolean }) {
    const result = await apiFetch<{ data: Playlist }>("/api/v1/playlists", { method: "POST", body });
    return result.data;
  },

  async getById(id: string) {
    const result = await apiFetch<{ data: Playlist }>(`/api/v1/playlists/${id}`);
    return result.data;
  },

  async update(id: string, body: { name?: string; description?: string | null; isPublic?: boolean }) {
    const result = await apiFetch<{ data: Playlist }>(`/api/v1/playlists/${id}`, { method: "PATCH", body });
    return result.data;
  },

  async remove(id: string) {
    return apiFetch<{ data: { removed: boolean } }>(`/api/v1/playlists/${id}`, { method: "DELETE" });
  },

  async listItems(id: string, page = 1, limit = 100) {
    return getPaginated<PlaylistItem>(`/api/v1/playlists/${id}/items`, { page, limit });
  },

  async addItem(id: string, songId: string) {
    const result = await apiFetch<{ data: PlaylistItem }>(`/api/v1/playlists/${id}/items`, {
      method: "POST",
      body: { songId },
    });
    return result.data;
  },

  async removeItem(id: string, itemId: string) {
    return apiFetch<{ data: { removed: boolean } }>(`/api/v1/playlists/${id}/items/${itemId}`, {
      method: "DELETE",
    });
  },
};

// -- Favorites ---------------------------------------------------------------

export const favoritesApi = {
  async list(mediaType?: MediaType, page = 1, limit = 50) {
    return getPaginated<FavoriteRecord>("/api/v1/favorites", { mediaType, page, limit });
  },

  async create(mediaType: MediaType, mediaId: string) {
    const body = mediaType === "SONG" ? { mediaType, songId: mediaId } : { mediaType, videoId: mediaId };
    return apiFetch<{ data: FavoriteRecord }>("/api/v1/favorites", { method: "POST", body });
  },

  async remove(favoriteId: string) {
    return apiFetch<{ data: { removed: boolean } }>(`/api/v1/favorites/${favoriteId}`, {
      method: "DELETE",
    });
  },
};

// -- Download records (server-side metadata) ----------------------------------

export const downloadsApi = {
  async list(mediaType?: MediaType, page = 1, limit = 50) {
    return getPaginated<DownloadRecord>("/api/v1/downloads", { mediaType, page, limit });
  },

  async register(mediaType: MediaType, mediaId: string) {
    const body = mediaType === "SONG" ? { mediaType, songId: mediaId } : { mediaType, videoId: mediaId };
    return apiFetch<{ data: DownloadRecord }>("/api/v1/downloads", { method: "POST", body, ignoreUnauthorized: true });
  },

  async remove(recordId: string) {
    return apiFetch<{ data: { removed: boolean } }>(`/api/v1/downloads/${recordId}`, {
      method: "DELETE",
    });
  },
};

// -- Playback events ----------------------------------------------------------

export interface QueuedEvent {
  clientEventId: string;
  eventType: "PLAY" | "VIEW" | "DOWNLOAD";
  mediaType: MediaType;
  songId?: string;
  videoId?: string;
  occurredAt: string;
}

export const eventsApi = {
  async track(event: QueuedEvent) {
    return apiFetch<{ data: { clientEventId: string; status: "ACCEPTED" | "DUPLICATE" } }>(
      "/api/v1/events/playback",
      { method: "POST", body: event, ignoreUnauthorized: true },
    );
  },

  async syncBatch(events: QueuedEvent[]) {
    return apiFetch<{ data: { accepted: number; duplicates: number; invalid: Array<{ clientEventId: string; reason: string }> } }>(
      "/api/v1/events/batch",
      { method: "POST", body: { events }, ignoreUnauthorized: true },
    );
  },
};

export type { Song };
