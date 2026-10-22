import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { songsApi, videosApi, type SongListParams, type VideoListParams } from "@/services/api/catalog-api";
import { queryKeys } from "@/constants/query-keys";
import type { MediaType, Song, Video } from "@/types/api";
import { favoritesApi } from "@/services/api/library-api";

export function useSongs(params: SongListParams = {}) {
  return useQuery({
    queryKey: queryKeys.songs(params),
    queryFn: () => songsApi.list(params),
  });
}

export function useSongSearch(query: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.songSearch(query),
    queryFn: () => songsApi.search(query),
    enabled: enabled && query.trim().length > 0,
  });
}

export function useSong(id: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.song(id),
    queryFn: () => songsApi.getById(id),
    enabled: options.enabled ?? id.length > 0,
  });
}

export function useVideos(params: VideoListParams = {}) {
  return useQuery({
    queryKey: queryKeys.videos(params),
    queryFn: () => videosApi.list(params),
  });
}

export function useVideoSearch(query: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.videoSearch(query),
    queryFn: () => videosApi.search(query),
    enabled: enabled && query.trim().length > 0,
  });
}

export function useVideo(id: string) {
  return useQuery({ queryKey: queryKeys.video(id), queryFn: () => videosApi.getById(id) });
}

/**
 * Favorite set for quick heart-state lookups across lists.
 */
export function useFavoriteIds() {
  const queryClient = useQueryClient();

  const favoritesQuery = useQuery({
    // Distinct key: useFavorites() caches paginated API responses under
    // ["favorites", ...] — sharing this key with the Set would corrupt it.
    queryKey: queryKeys.favoriteIds(),
    queryFn: async () => {
      const [songs, videos] = await Promise.all([
        favoritesApi.list("SONG", 1, 500),
        favoritesApi.list("VIDEO", 1, 500),
      ]);
      const ids = new Set<string>();
      for (const record of songs.data) if (record.songId) ids.add(record.songId);
      for (const record of videos.data) if (record.videoId) ids.add(record.videoId);
      return ids;
    },
  });

  const setFavorite = (mediaType: MediaType, mediaId: string, favorite: boolean) => {
    queryClient.setQueryData<Set<string>>(queryKeys.favoriteIds(), (current) => {
      const next = new Set(current ?? []);
      const key = mediaType === "SONG" ? mediaId : mediaId;
      if (favorite) next.add(key);
      else next.delete(key);
      return next;
    });
    void queryClient.invalidateQueries({ queryKey: queryKeys.favoriteIds() });
    void queryClient.invalidateQueries({ queryKey: ["favorites"] });
  };

  // instanceof guard: never trust cached shape for method calls.
  return {
    ids: favoritesQuery.data instanceof Set ? favoritesQuery.data : new Set<string>(),
    isLoading: favoritesQuery.isLoading,
    setFavorite,
  };
}

/** Optimistic favorite toggle for songs and videos. */
export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ mediaType, mediaId, favorite }: { mediaType: MediaType; mediaId: string; favorite: boolean }) => {
      if (mediaType === "SONG") {
        return favorite ? songsApi.favorite(mediaId) : songsApi.unfavorite(mediaId);
      }
      return favorite ? videosApi.favorite(mediaId) : videosApi.unfavorite(mediaId);
    },
    onMutate: async ({ mediaType, mediaId, favorite }) => {
      const key = queryKeys.favoriteIds();
      // Kill any in-flight refetch first — it would otherwise land after the
      // optimistic write and paint stale server state over the new heart.
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Set<string>>(key);
      queryClient.setQueryData<Set<string>>(key, (current) => {
        const next = new Set(current ?? []);
        if (favorite) next.add(mediaId);
        else next.delete(mediaId);
        return next;
      });
      return { previous, key };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(context.key, context.previous);
      }
    },
    onSettled: () => {
      // The ids Set stays as the heart source of truth (rolled back on error);
      // only revalidate the favorited-content lists against the server.
      void queryClient.invalidateQueries({ queryKey: ["favorites"] });
    },
  });
}

/** Adjust cached play/view counts after event tracking (visual feedback only). */
export function useCountBump() {
  const queryClient = useQueryClient();
  return (mediaType: MediaType, mediaId: string) => {
    if (mediaType === "SONG") {
      queryClient.setQueryData<Song>(queryKeys.song(mediaId), (song) =>
        song ? { ...song, playCount: song.playCount + 1 } : song,
      );
    } else {
      queryClient.setQueryData<Video>(queryKeys.video(mediaId), (video) =>
        video ? { ...video, viewCount: video.viewCount + 1 } : video,
      );
    }
  };
}

/** Debounce helper for search inputs. */
export function useDebouncedValue<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
