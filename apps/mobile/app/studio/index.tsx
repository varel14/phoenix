import { useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { radii, spacing } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import {
  useArtistStats,
  useMyArtist,
  useArtistSongs,
  useArtistVideos,
  invalidateStudioQueries,
} from "@/hooks/use-library";
import { useFavoriteIds } from "@/hooks/use-catalog";
import { artistsApi } from "@/services/api/artists-api";
import {
  AppText,
  Button,
  ContextMenu,
  EmptyView,
  ErrorView,
  LoadingView,
} from "@/components/ui";
import { Artwork } from "@/components/media/artwork";
import { InteractiveRow } from "@/components/media/rows";
import { playerService } from "@/services/media/player-service";
import { formatCount } from "@/utils/format";
import { formatMoney } from "@/utils/money";
import type { ArtistStats } from "@/types/api";

export default function StudioScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const myArtist = useMyArtist();
  const stats = useArtistStats(myArtist.data?.id);
  const { ids: favoriteIds } = useFavoriteIds();
  const songs = useArtistSongs(myArtist.data?.id ?? "");
  const videos = useArtistVideos(myArtist.data?.id ?? "");
  const [chartMetric, setChartMetric] = useState<"plays" | "views">("plays");

  if (myArtist.isLoading) return <LoadingView />;
  if (myArtist.isError) {
    return (
      <ErrorView
        message={(myArtist.error as Error)?.message}
        onRetry={() => void myArtist.refetch()}
      />
    );
  }
  if (!myArtist.data) {
    return <ErrorView message="Vous n'avez pas encore de profil artiste." />;
  }

  const artist = myArtist.data;
  const songList = songs.data?.data ?? [];
  const videoList = videos.data?.data ?? [];
  const statsData = stats.data;

  function confirmRemove(
    kind: "SONG" | "VIDEO",
    mediaId: string,
    title: string,
  ) {
    Alert.alert(
      `Supprimer ${kind === "SONG" ? "le titre" : "la vidéo"}`,
      `"${title}" sera définitivement supprimé.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: () => {
            const remove =
              kind === "SONG"
                ? artistsApi.removeSong(artist.id, mediaId)
                : artistsApi.removeVideo(artist.id, mediaId);
            void remove
              .then(() => invalidateStudioQueries(artist.id, queryClient, kind))
              .catch(() =>
                Alert.alert("Erreur", "La suppression a échoué. Réessayez."),
              );
          },
        },
      ],
    );
  }

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 180 }}>
      <View style={{ padding: spacing.lg, gap: spacing.sm }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <AppText
            onPress={() => router.back()}
            style={{
              color: colors.primary,
              fontSize: 22,
              paddingRight: spacing.md,
            }}
          >
            ←
          </AppText>
          <View style={{ flex: 1 }}>
            <AppText variant="title">Studio Créateur</AppText>
            <AppText variant="caption">{artist.name}</AppText>
          </View>
          <ContextMenu
            actions={[
              {
                label: "Modifier le profil",
                icon: "pencil",
                onPress: () =>
                  router.push({
                    pathname: "/studio/edit-profile",
                    params: { name: artist.name, bio: artist.bio ?? "" },
                  }),
              },
            ]}
          />
        </View>

        {statsData ? (
          <>
            {/* Aggregate analytics */}
            <View style={statsGrid}>
              <StatBox
                label="Écoutes"
                value={formatCount(statsData.plays)}
                icon="headset-outline"
              />
              <StatBox
                label="Vues"
                value={formatCount(statsData.views)}
                icon="videocam-outline"
              />
              <StatBox
                label="Téléch."
                value={formatCount(statsData.downloads)}
                icon="cloud-download-outline"
              />
              <StatBox
                label="Auditeurs"
                value={formatCount(statsData.uniqueListeners)}
                icon="people-outline"
              />
              <StatBox
                label="Revenus"
                value={formatMoney(statsData.downloadRevenue, "XOF")}
                icon="wallet-outline"
              />
              <StatBox
                label="Favoris"
                value={formatCount(statsData.favorites)}
                icon="heart-outline"
              />
            </View>

            {/* 30-day trend */}
            <TrendChart
              daily={statsData.daily}
              metric={chartMetric}
              onMetricChange={setChartMetric}
            />

            {/* Per-song activity & popularity */}
            {statsData.songStats.length > 0 ? (
              <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
                <AppText variant="subheading">Activité par titre</AppText>
                <SongActivityTable songStats={statsData.songStats} />
              </View>
            ) : null}
          </>
        ) : (
          <LoadingView label="Chargement des statistiques…" />
        )}

        <View
          style={{
            flexDirection: "row",
            gap: spacing.sm,
            marginTop: spacing.sm,
          }}
        >
          <View style={{ flex: 1 }}>
            <Button
              label="＋ Publier un titre"
              onPress={() => router.push("/studio/song-form")}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label="＋ Publier une vidéo"
              variant="secondary"
              onPress={() => router.push("/studio/video-form")}
            />
          </View>
        </View>
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <AppText
          variant="heading"
          style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.sm }}
        >
          Mes titres ({songList.length})
        </AppText>
        {songList.length === 0 ? (
          <EmptyView
            title="Aucun titre"
            subtitle="Publiez votre premier titre pour le voir ici."
          />
        ) : (
          songList.map((song) => (
            <View key={song.id}>
              <InteractiveRow
                media={song}
                mediaType="SONG"
                isFavorite={favoriteIds.has(song.id)}
                onPlay={() =>
                  void playerService.playQueue(songList, songList.indexOf(song))
                }
                subtitleOverride={`${formatCount(song.playCount)} écoutes · ${formatCount(song.downloadCount)} téléch.`}
                menuActions={[
                  {
                    label: "Modifier",
                    icon: "pencil",
                    onPress: () =>
                      router.push({
                        pathname: "/studio/song-form",
                        params: {
                          songId: song.id,
                          title: song.title,
                          audioUrl: song.audioUrl,
                          genre: song.genre ?? "",
                          albumName: song.albumName ?? "",
                          thumbnailUrl: song.thumbnailUrl ?? "",
                          isDownloadable: String(song.isDownloadable),
                        },
                      }),
                  },
                  {
                    label: "Supprimer",
                    icon: "trash-outline",
                    destructive: true,
                    onPress: () => confirmRemove("SONG", song.id, song.title),
                  },
                ]}
              />
            </View>
          ))
        )}
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <AppText
          variant="heading"
          style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.sm }}
        >
          Mes vidéos ({videoList.length})
        </AppText>
        {videoList.length === 0 ? (
          <EmptyView
            title="Aucune vidéo"
            subtitle="Publiez votre première vidéo pour la voir ici."
          />
        ) : (
          videoList.map((video) => (
            <View key={video.id}>
              <InteractiveRow
                media={video}
                mediaType="VIDEO"
                isFavorite={favoriteIds.has(video.id)}
                onPlay={() => router.push(`/video/${video.id}`)}
                subtitleOverride={`${formatCount(video.viewCount)} vues · ${formatCount(video.downloadCount)} téléch.`}
                menuActions={[
                  {
                    label: "Modifier",
                    icon: "pencil",
                    onPress: () =>
                      router.push({
                        pathname: "/studio/video-form",
                        params: {
                          videoId: video.id,
                          title: video.title,
                          videoUrl: video.videoUrl,
                          description: video.description ?? "",
                          thumbnailUrl: video.thumbnailUrl ?? "",
                          isDownloadable: String(video.isDownloadable),
                        },
                      }),
                  },
                  {
                    label: "Supprimer",
                    icon: "trash-outline",
                    destructive: true,
                    onPress: () =>
                      confirmRemove("VIDEO", video.id, video.title),
                  },
                ]}
              />
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function StatBox({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexBasis: "30%",
        flexGrow: 1,
        backgroundColor: colors.surface,
        borderRadius: radii.lg,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.sm,
        alignItems: "center",
        gap: 4,
      }}
    >
      <AppText variant="heading" style={{ color: colors.accent }}>
        {value}
      </AppText>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Ionicons name={icon} size={12} color={colors.textFaint} />
        <AppText variant="small">{label.toUpperCase()}</AppText>
      </View>
    </View>
  );
}

/** Last-30-days bar chart with a plays/views toggle. */
function TrendChart({
  daily,
  metric,
  onMetricChange,
}: {
  daily: Array<{ date: string; plays: number; views: number }>;
  metric: "plays" | "views";
  onMetricChange: (metric: "plays" | "views") => void;
}) {
  const { colors } = useTheme();
  const values = daily.map((day) => day[metric]);
  const max = Math.max(1, ...values);
  const total = values.reduce((sum, value) => sum + value, 0);
  const label = metric === "plays" ? "écoutes" : "vues";

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: radii.lg,
        padding: spacing.lg,
        gap: spacing.md,
        marginTop: spacing.sm,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ flex: 1 }}>
          <AppText variant="subheading">Activité — 30 derniers jours</AppText>
          <AppText variant="caption">
            {formatCount(total)} {label} sur la période
          </AppText>
        </View>
        <View style={{ flexDirection: "row", gap: spacing.xs }}>
          {(["plays", "views"] as const).map((option) => (
            <AppText
              key={option}
              onPress={() => onMetricChange(option)}
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: metric === option ? colors.primary : colors.textFaint,
                overflow: "hidden",
                borderRadius: radii.full,
                paddingHorizontal: spacing.sm,
                paddingVertical: 4,
                backgroundColor:
                  metric === option ? colors.primaryTint : "transparent",
              }}
            >
              {option === "plays" ? "Écoutes" : "Vues"}
            </AppText>
          ))}
        </View>
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          gap: 2,
          height: 72,
        }}
      >
        {daily.map((day) => {
          const value = day[metric];
          const height = Math.max(
            value > 0 ? 6 : 2,
            Math.round((value / max) * 72),
          );
          return (
            <View
              key={day.date}
              style={{
                flex: 1,
                height,
                borderRadius: 2,
                backgroundColor:
                  value > 0 ? colors.primary : colors.surfaceHighlight,
              }}
            />
          );
        })}
      </View>
      <AppText variant="caption" color={colors.textFaint}>
        il y a 30 jours … aujourd'hui
      </AppText>
    </View>
  );
}

const statsGrid = {
  flexDirection: "row" as const,
  flexWrap: "wrap" as const,
  gap: spacing.sm,
  marginTop: spacing.md,
};

/** Per-song popularity ranking: plays, 30-day momentum, listeners, downloads. */
function SongActivityTable({
  songStats,
}: {
  songStats: ArtistStats["songStats"];
}) {
  const { colors } = useTheme();
  const maxPlays = Math.max(1, ...songStats.map((song) => song.playCount));

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: radii.lg,
        padding: spacing.md,
        gap: spacing.sm,
      }}
    >
      {songStats.map((song, index) => {
        const popularity = song.playCount / maxPlays;
        return (
          <View key={song.id} style={{ gap: 6 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
              }}
            >
              <AppText
                style={{
                  color: colors.textFaint,
                  fontSize: 13,
                  fontWeight: "700",
                  width: 18,
                }}
              >
                {index + 1}
              </AppText>
              <Artwork
                uri={song.thumbnailUrl}
                seed={song.id}
                label={song.title}
                size={36}
                radius={radii.sm}
              />
              <View style={{ flex: 1 }}>
                <AppText
                  numberOfLines={1}
                  style={{
                    fontSize: 14,
                    fontWeight: "600",
                    color: colors.text,
                  }}
                >
                  {song.title}
                </AppText>
                <AppText
                  variant="small"
                  color={colors.textFaint}
                  numberOfLines={1}
                >
                  {formatCount(song.playCount)} écoutes ·{" "}
                  {formatCount(song.uniqueListeners)} auditeurs ·{" "}
                  {formatCount(song.downloadCount)} téléch.
                  {song.favorites > 0
                    ? ` · ${formatCount(song.favorites)} ♥`
                    : ""}
                </AppText>
              </View>
              <View
                style={{
                  backgroundColor:
                    song.plays30d > 0
                      ? colors.primaryTint
                      : colors.surfaceHighlight,
                  borderRadius: radii.full,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 3,
                }}
              >
                <AppText
                  style={{
                    fontSize: 10,
                    fontWeight: "700",
                    color:
                      song.plays30d > 0 ? colors.primary : colors.textFaint,
                  }}
                >
                  +{formatCount(song.plays30d)} / 30j
                </AppText>
              </View>
            </View>
            {/* Popularity bar relative to the artist's most played track. */}
            <View
              style={{
                height: 4,
                borderRadius: radii.full,
                backgroundColor: colors.surfaceHighlight,
                marginLeft: 30,
              }}
            >
              <View
                style={{
                  height: 4,
                  width: `${Math.max(song.playCount > 0 ? 6 : 0, Math.round(popularity * 100))}%`,
                  borderRadius: radii.full,
                  backgroundColor: colors.primary,
                }}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}
