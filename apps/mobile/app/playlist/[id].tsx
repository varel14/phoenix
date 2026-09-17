import { useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { colors, radii, spacing } from "@/theme";
import { usePlaylist, usePlaylistItems, usePlaylistMutations } from "@/hooks/use-library";
import { useFavoriteIds } from "@/hooks/use-catalog";
import { AppText, Button, ContextMenu, ErrorView, Input, LoadingView } from "@/components/ui";
import { InteractiveRow } from "@/components/media/rows";
import { playerService } from "@/services/media/player-service";

export default function PlaylistDetailScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const playlist = usePlaylist(id);
  const items = usePlaylistItems(id);
  const { update, remove, removeItem } = usePlaylistMutations();
  const { ids: favoriteIds } = useFavoriteIds();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState("");

  if (playlist.isLoading || items.isLoading) return <LoadingView />;
  if (playlist.isError || !playlist.data) {
    return <ErrorView message={(playlist.error as Error)?.message} onRetry={() => void playlist.refetch()} />;
  }

  const data = playlist.data;
  const songs = (items.data?.data ?? []).map((item) => item.song);

  function confirmDelete() {
    Alert.alert("Delete playlist", `"${data.name}" will be removed. This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          remove.mutate(data.id, { onSuccess: () => router.back() });
        },
      },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <AppText onPress={() => router.back()} style={{ color: colors.primary, fontSize: 22 }}>
            ←
          </AppText>
          <View style={{ flex: 1 }}>
            <AppText variant="title">{data.name}</AppText>
            <AppText variant="caption">
              {data._count.items} {data._count.items === 1 ? "song" : "songs"} · {data.isPublic ? "Public" : "Private"}
            </AppText>
          </View>
          <ContextMenu
            actions={[
              { label: "Rename", glyph: "✎", onPress: () => setRenaming(true) },
              { label: "Delete playlist", glyph: "🗑", destructive: true, onPress: confirmDelete },
            ]}
          />
        </View>

        {renaming ? (
          <View style={{ gap: spacing.sm }}>
            <Input value={name} onChangeText={setName} placeholder="New name" autoFocus />
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Button
                  label="Save"
                  loading={update.isPending}
                  onPress={() =>
                    update.mutate(
                      { id: data.id, name: name.trim() },
                      { onSuccess: () => setRenaming(false) },
                    )
                  }
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button label="Cancel" variant="secondary" onPress={() => setRenaming(false)} />
              </View>
            </View>
          </View>
        ) : null}

        {songs.length > 0 ? (
          <Button label="▶ Play all" onPress={() => void playerService.playQueue(songs, 0)} />
        ) : null}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 180 }}>
        {(items.data?.data ?? []).map((item) => (
          <Pressable key={item.id}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={{ flex: 1 }}>
                <InteractiveRow
                  media={item.song}
                  mediaType="SONG"
                  isFavorite={favoriteIds.has(item.song.id)}
                  onPlay={() => void playerService.playQueue(songs, songs.findIndex((s) => s.id === item.song.id))}
                />
              </View>
              <AppText
                onPress={() =>
                  removeItem.mutate(
                    { playlistId: data.id, itemId: item.id },
                    {
                      onSuccess: () => {
                        void queryClient.invalidateQueries({ queryKey: ["playlist", data.id] });
                      },
                    },
                  )
                }
                style={{ color: colors.textFaint, paddingHorizontal: spacing.md, fontSize: 18 }}
              >
                ✕
              </AppText>
            </View>
          </Pressable>
        ))}
        {songs.length === 0 ? (
          <AppText variant="bodyMuted" style={{ textAlign: "center", padding: spacing.xl }}>
            Add songs from any ⋮ menu → “Add to playlist”.
          </AppText>
        ) : null}
      </ScrollView>
    </View>
  );
}