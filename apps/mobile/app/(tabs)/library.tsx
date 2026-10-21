import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { radii, spacing } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import { useFavorites, usePlaylistItems, usePlaylistMutations, usePlaylists } from "@/hooks/use-library";
import { useFavoriteIds } from "@/hooks/use-catalog";
import { AppText, Button, ContextMenu, EmptyView, ErrorView, IconButton, Input, LoadingView } from "@/components/ui";
import { InteractiveRow } from "@/components/media/rows";
import { Artwork } from "@/components/media/artwork";
import { playerService } from "@/services/media/player-service";
import { useDownloadsStore } from "@/services/downloads/download-manager";
import { formatDuration } from "@/utils/format";
import type { Song } from "@/types/api";

type Section = "FAVORITES" | "PLAYLISTS" | "MUSIC" | "VIDEOS";

export default function LibraryScreen() {
  const [section, setSection] = useState<Section>("FAVORITES");

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.md }}>
        <AppText variant="title">Bibliothèque</AppText>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm, paddingVertical: spacing.md }}>
        <Chip label="Favorites" active={section === "FAVORITES"} onPress={() => setSection("FAVORITES")} />
        <Chip label="Playlists" active={section === "PLAYLISTS"} onPress={() => setSection("PLAYLISTS")} />
        <Chip label="Downloaded music" active={section === "MUSIC"} onPress={() => setSection("MUSIC")} />
        <Chip label="Downloaded videos" active={section === "VIDEOS"} onPress={() => setSection("VIDEOS")} />
      </ScrollView>

      {section === "FAVORITES" ? <FavoritesSection /> : null}
      {section === "PLAYLISTS" ? <PlaylistsSection /> : null}
      {section === "MUSIC" ? <DownloadsSection mediaType="SONG" /> : null}
      {section === "VIDEOS" ? <DownloadsSection mediaType="VIDEO" /> : null}
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        paddingHorizontal: spacing.md,
        height: 34,
        borderRadius: radii.md,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: active ? colors.primary : colors.primaryTint,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
      }}
    >
      <AppText style={{ color: active ? "#FFFFFF" : colors.textMuted, fontWeight: "600", fontSize: 13 }}>{label}</AppText>
    </Pressable>
  );
}

function FavoritesSection() {
  const router = useRouter();
  const favorites = useFavorites();
  const { ids: favoriteIds } = useFavoriteIds();

  if (favorites.isLoading) return <LoadingView />;
  if (favorites.isError) {
    return <ErrorView message={(favorites.error as Error)?.message} onRetry={() => void favorites.refetch()} />;
  }

  const records = favorites.data?.data ?? [];
  if (records.length === 0) {
    return (
      <EmptyView
        title="No favorites yet"
        subtitle="Tap the heart on any song or video and it will live here."
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 180 }}>
      {records.map((record) => {
        if (record.song) {
          return (
            <InteractiveRow
              key={record.id}
              media={record.song}
              mediaType="SONG"
              isFavorite={favoriteIds.has(record.song.id)}
              onPlay={() => {
                const songs = records.map((r) => r.song).filter(Boolean) as Song[];
                void playerService.playQueue(songs, songs.findIndex((s) => s.id === record.song!.id));
              }}
            />
          );
        }
        if (record.video) {
          return (
            <InteractiveRow
              key={record.id}
              media={record.video}
              mediaType="VIDEO"
              isFavorite={favoriteIds.has(record.video.id)}
              onPlay={() => router.push(`/video/${record.video!.id}`)}
            />
          );
        }
        return null;
      })}
    </ScrollView>
  );
}

function PlaylistsSection() {
  const { colors } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const playlists = usePlaylists();
  const { create, remove } = usePlaylistMutations();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  if (playlists.isLoading) return <LoadingView />;
  if (playlists.isError) {
    return <ErrorView message={(playlists.error as Error)?.message} onRetry={() => void playlists.refetch()} />;
  }

  const items = playlists.data?.data ?? [];

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 180, paddingHorizontal: spacing.lg, gap: spacing.sm }}>
      {creating ? (
        <View style={{ gap: spacing.sm, backgroundColor: colors.surface, padding: spacing.md, borderRadius: radii.lg }}>
          <Input placeholder="Playlist name" value={name} onChangeText={setName} autoFocus />
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Button
                label="Create"
                loading={create.isPending}
                onPress={() => {
                  if (!name.trim()) return;
                  create.mutate(
                    { name: name.trim() },
                    {
                      onSuccess: () => {
                        setCreating(false);
                        setName("");
                        void queryClient.invalidateQueries();
                      },
                    },
                  );
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="Cancel" variant="secondary" onPress={() => setCreating(false)} />
            </View>
          </View>
        </View>
      ) : (
        <Button label="＋ Nouvelle playlist" variant="secondary" onPress={() => setCreating(true)} />
      )}

      {items.map((playlist) => (
        <Pressable
          key={playlist.id}
          accessibilityRole="button"
          onPress={() => router.push(`/playlist/${playlist.id}`)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
            backgroundColor: colors.surface,
            borderRadius: radii.lg,
            padding: spacing.md,
          }}
        >
          <Artwork uri={null} seed={playlist.id} label={playlist.name} size={52} radius={radii.sm} />
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="subheading" numberOfLines={1}>{playlist.name}</AppText>
            <AppText variant="caption">
              {playlist._count.items} {playlist._count.items === 1 ? "song" : "songs"} ·{" "}
              {playlist.isPublic ? "Public" : "Private"}
            </AppText>
          </View>
          <ContextMenu
            actions={[
              {
                label: "Delete playlist",
                icon: "trash-outline",
                destructive: true,
                onPress: () => remove.mutate(playlist.id),
              },
            ]}
          />
        </Pressable>
      ))}
      {items.length === 0 && !creating ? (
        <EmptyView title="No playlists" subtitle="Create your first playlist to group songs." />
      ) : null}
    </ScrollView>
  );
}

function DownloadsSection({ mediaType }: { mediaType: "SONG" | "VIDEO" }) {
  const { colors } = useTheme();
  const router = useRouter();
  const library = useDownloadsStore((state) => state.library);
  const hydrated = useDownloadsStore((state) => state.hydrated);
  const remove = useDownloadsStore((state) => state.remove);
  const items = library.filter((entry) => entry.mediaType === mediaType);

  if (!hydrated) return <LoadingView label="Checking downloads…" />;

  if (items.length === 0) {
    return (
      <EmptyView
        title={mediaType === "SONG" ? "No downloaded music" : "No downloaded videos"}
        subtitle="Use the ⋮ menu on any item to save it for offline."
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 180 }}>
      {items.map((entry) => (
        <View key={entry.fileUri} style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2, gap: spacing.md }}>
          <Pressable
            accessibilityRole="button"
            style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.md }}
            onPress={() => {
              if (mediaType === "SONG") {
                void playerService.playQueue(
                  items.map((localEntry) => ({
                    id: localEntry.mediaId,
                    title: localEntry.title,
                    artist: { id: "", name: localEntry.artistName, avatarUrl: null, isVerified: false },
                    artistId: "",
                    audioUrl: localEntry.sourceUrl,
                    thumbnailUrl: localEntry.artworkUrl,
                    durationSec: localEntry.durationSec,
                    playCount: 0,
                    publishedAt: localEntry.downloadedAt,
                    isDownloadable: true,
                    genre: null,
                    albumName: null,
                    mimeType: null,
                    fileSizeBytes: null,
                    downloadCount: 0,
                  })),
                  items.findIndex((candidate) => candidate.fileUri === entry.fileUri),
                );
              } else {
                router.push(`/video/${entry.mediaId}`);
              }
            }}
          >
            <Artwork uri={entry.artworkUrl} seed={entry.mediaId} label={entry.title} size={56} radius={8} />
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="subheading" numberOfLines={1}>{entry.title}</AppText>
              <AppText variant="caption" numberOfLines={1}>
                {entry.artistName} · {formatDuration(entry.durationSec)} · offline
              </AppText>
            </View>
          </Pressable>
          <IconButton
            icon="trash-outline"
            size={20}
            color={colors.danger}
            onPress={() => void remove(mediaType, entry.mediaId)}
            accessibilityLabel="Delete download"
          />
        </View>
      ))}
    </ScrollView>
  );
}
