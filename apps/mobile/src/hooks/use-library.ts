import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { artistsApi } from "@/services/api/artists-api";
import { favoritesApi, playlistsApi } from "@/services/api/library-api";
import { queryKeys } from "@/constants/query-keys";
import type { MediaType } from "@/types/api";

export function usePlaylists() {
  return useQuery({ queryKey: queryKeys.playlists(), queryFn: () => playlistsApi.list() });
}

export function usePlaylist(id: string) {
  return useQuery({ queryKey: queryKeys.playlist(id), queryFn: () => playlistsApi.getById(id) });
}

export function usePlaylistItems(id: string) {
  return useQuery({ queryKey: queryKeys.playlistItems(id), queryFn: () => playlistsApi.listItems(id) });
}

export function usePlaylistMutations() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["playlists"] });
    void queryClient.invalidateQueries({ queryKey: ["playlist"] });
  };

  const create = useMutation({
    mutationFn: playlistsApi.create,
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; description?: string | null; isPublic?: boolean }) =>
      playlistsApi.update(id, body),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: playlistsApi.remove,
    onSuccess: invalidate,
  });

  const addItem = useMutation({
    mutationFn: ({ playlistId, songId }: { playlistId: string; songId: string }) =>
      playlistsApi.addItem(playlistId, songId),
    onSuccess: (_data, variables) => {
      invalidate();
      void queryClient.invalidateQueries({ queryKey: queryKeys.playlistItems(variables.playlistId) });
    },
  });

  const removeItem = useMutation({
    mutationFn: ({ playlistId, itemId }: { playlistId: string; itemId: string }) =>
      playlistsApi.removeItem(playlistId, itemId),
    onSuccess: (_data, variables) => {
      invalidate();
      void queryClient.invalidateQueries({ queryKey: queryKeys.playlistItems(variables.playlistId) });
    },
  });

  return { create, update, remove, addItem, removeItem };
}

export function useFavorites(mediaType?: MediaType) {
  return useQuery({
    queryKey: queryKeys.favorites(mediaType),
    queryFn: () => favoritesApi.list(mediaType),
  });
}

export function useArtists(q?: string) {
  return useQuery({ queryKey: queryKeys.artists(q), queryFn: () => artistsApi.list(q) });
}

export function useArtist(id: string) {
  return useQuery({ queryKey: queryKeys.artist(id), queryFn: () => artistsApi.getById(id) });
}

export function useArtistSongs(id: string) {
  return useQuery({
    queryKey: queryKeys.artistSongs(id),
    queryFn: () => artistsApi.listSongs(id),
    enabled: Boolean(id),
  });
}

export function useArtistVideos(id: string) {
  return useQuery({
    queryKey: queryKeys.artistVideos(id),
    queryFn: () => artistsApi.listVideos(id),
    enabled: Boolean(id),
  });
}

export function useFollowArtist(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (follow: boolean) => (follow ? artistsApi.follow(id) : artistsApi.unfollow(id)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.artist(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.following() });
    },
  });
}

export function useFollowing() {  return useQuery({
    queryKey: queryKeys.following(),
    queryFn: () =>
      import("@/services/api/api-client").then(({ getPaginated }) =>
        getPaginated<{
          id: string;
          artist: { id: string; name: string; avatarUrl: string | null; isVerified: boolean; bio: string | null };
        }>("/api/v1/artists/following/list", { page: 1, limit: 100 }),
      ),
  });
}

export function useArtistStats(artistId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.artistStats(artistId ?? "none"),
    queryFn: () => artistsApi.stats(artistId!),
    enabled: Boolean(artistId),
  });
}

export function useMyArtist() {
  return useQuery({
    queryKey: queryKeys.myArtist(),
    queryFn: async () => {
      // Imported lazily to avoid a require cycle with the API client.
      const { apiFetch } = await import("@/services/api/api-client");
      const result = await apiFetch<{ data: { id: string; name: string; bio: string | null; avatarUrl: string | null; bannerUrl: string | null } | null }>(
        "/api/v1/artists/me",
        { ignoreUnauthorized: true },
      );
      return result.data;
    },
  });
}

export function useBecomeArtist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: { name: string; bio?: string | null }) =>
      import("@/services/api/api-client").then(({ apiFetch }) =>
        apiFetch<{ data: { id: string } }>("/api/v1/artists", { method: "POST", body }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.myArtist() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.me() });
    },
  });
}
