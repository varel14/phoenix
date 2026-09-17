import { useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { radii, spacing } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import { useArtistStats, useMyArtist } from "@/hooks/use-library";
import { useFavoriteIds } from "@/hooks/use-catalog";
import { useArtistSongs, useArtistVideos } from "@/hooks/use-library";
import { artistsApi } from "@/services/api/artists-api";
import { useQueryClient } from "@tanstack/react-query";
import { AppText, Button, ContextMenu, EmptyView, ErrorView, LoadingView } from "@/components/ui";
import { InteractiveRow } from "@/components/media/rows";
import { playerService } from "@/services/media/player-service";
import { queryKeys } from "@/constants/query-keys";
import { formatCount } from "@/utils/format";

export default function StudioScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const myArtist = useMyArtist();
  const stats = useArtistStats(myArtist.data?.id);
  const { ids: favoriteIds } = useFavoriteIds();
  const songs = useArtistSongs(myArtist.data?.id ?? "");
  const videos = useArtistVideos(myArtist.data?.id ?? "");

  if (myArtist.isLoading) return <LoadingView />;
  if (myArtist.isError) {
    return <ErrorView message={(myArtist.error as Error)?.message} onRetry={() => void myArtist.refetch()} />;
  }
  if (!myArtist.data) {
    return <ErrorView message="You do not have an artist profile yet." />;
  }

  const artist = myArtist.data;
  const songList = songs.data?.data ?? [];
  const videoList = videos.data?.data ?? [];

  function confirmRemove(kind: "SONG" | "VIDEO", mediaId: string, title: string) {
    Alert.alert(`Delete ${kind.toLowerCase()}`, `"${title}" will be permanently removed.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          const remove = kind === "SONG"
            ? artistsApi.removeSong(artist.id, mediaId)
            : artistsApi.removeVideo(artist.id, mediaId);
          void remove.then(() => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.artistSongs(artist.id) });
            void queryClient.invalidateQueries({ queryKey: queryKeys.artistVideos(artist.id) });
            void queryClient.invalidateQueries({ queryKey: queryKeys.artistStats(artist.id) });
          });
        },
      },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 180 }}>
      <View style={{ padding: spacing.lg, gap: spacing.sm }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <AppText onPress={() => router.back()} style={{ color: colors.primary, fontSize: 22, paddingRight: spacing.md }}>
            ←
          </AppText>
          <View style={{ flex: 1 }}>
            <AppText variant="title">Studio Créateur</AppText>
            <AppText variant="caption">{artist.name}</AppText>
          </View>
          <ContextMenu
            actions={[
              {
                label: "Edit profile",
                icon: "pencil",
                onPress: () => router.push({ pathname: "/studio/edit-profile", params: { name: artist.name, bio: artist.bio ?? "" } }),
              },
            ]}
          />
        </View>

        {stats.data ? (
          <View style={statsGrid}>
            <StatBox label="Écoutes" value={formatCount(stats.data.plays)} />
            <StatBox label="Vues" value={formatCount(stats.data.views)} />
            <StatBox label="Téléchargements" value={formatCount(stats.data.downloads)} />
            <StatBox label="Abonnés" value={formatCount(stats.data.subscribers)} />
          </View>
        ) : (
          <LoadingView label="Loading stats…" />
        )}

        <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Button label="＋ Publish song" onPress={() => router.push("/studio/song-form")} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="＋ Publish video" variant="secondary" onPress={() => router.push("/studio/video-form")} />
          </View>
        </View>
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <AppText variant="heading" style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.sm }}>
          Mes titres ({songList.length})
        </AppText>
        {songList.length === 0 ? (
          <EmptyView title="No songs yet" subtitle="Publish your first song to see it here." />
        ) : (
          songList.map((song) => (
            <View key={song.id}>
              <InteractiveRow
                media={song}
                mediaType="SONG"
                isFavorite={favoriteIds.has(song.id)}
                onPlay={() => void playerService.playQueue(songList, songList.indexOf(song))}
                menuActions={[
                  {
                    label: "Edit",
                    icon: "pencil",
                    onPress: () =>
                      router.push({
                        pathname: "/studio/song-form",
                        params: { songId: song.id, title: song.title, audioUrl: song.audioUrl, genre: song.genre ?? "", albumName: song.albumName ?? "" },
                      }),
                  },
                  { label: "Delete", icon: "trash-outline", destructive: true, onPress: () => confirmRemove("SONG", song.id, song.title) },
                ]}
              />
            </View>
          ))
        )}
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <AppText variant="heading" style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.sm }}>
          Mes vidéos ({videoList.length})
        </AppText>
        {videoList.length === 0 ? (
          <EmptyView title="No videos yet" subtitle="Publish your first video to see it here." />
        ) : (
          videoList.map((video) => (
            <View key={video.id}>
              <InteractiveRow
                media={video}
                mediaType="VIDEO"
                isFavorite={favoriteIds.has(video.id)}
                onPlay={() => router.push(`/video/${video.id}`)}
                menuActions={[
                  {
                    label: "Edit",
                    icon: "pencil",
                    onPress: () =>
                      router.push({
                        pathname: "/studio/video-form",
                        params: { videoId: video.id, title: video.title, videoUrl: video.videoUrl, description: video.description ?? "" },
                      }),
                  },
                  { label: "Delete", icon: "trash-outline", destructive: true, onPress: () => confirmRemove("VIDEO", video.id, video.title) },
                ]}
              />
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.md, alignItems: "center", gap: 4 }}>
      <AppText variant="heading" style={{ color: colors.accent }}>
        {value}
      </AppText>
      <AppText variant="small">{label.toUpperCase()}</AppText>
    </View>
  );
}

const statsGrid = {
  flexDirection: "row" as const,
  flexWrap: "wrap" as const,
  gap: spacing.sm,
  marginTop: spacing.md,
};