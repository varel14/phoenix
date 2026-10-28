import { useEffect, useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Line,
  Path,
  Stop,
} from "react-native-svg";
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
import { useAuthStore } from "@/stores/auth-store";
import { artistsApi } from "@/services/api/artists-api";
import {
  AppText,
  Button,
  ContextMenu,
  EmptyView,
  ErrorView,
  IconButton,
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

  // The studio is reached from the profile tab only — bounce anyone who
  // lands here by deep link without a creator account.
  const isArtist = useAuthStore((state) => state.user?.role === "ARTIST");
  useEffect(() => {
    if (!isArtist) router.replace("/(tabs)/profile");
  }, [isArtist, router]);

  if (!isArtist || myArtist.isLoading) return <LoadingView />;
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
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.xl,
          paddingBottom: spacing.md,
        }}
      >
        <IconButton
          icon="chevron-back"
          onPress={() => router.back()}
          accessibilityLabel="Retour"
        />
        <View style={{ flex: 1 }}>
          <AppText variant="title">Studio Créateur</AppText>
          <AppText variant="caption" color={colors.textFaint}>
            {artist.name}
          </AppText>
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
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
          {/* KPI grid — the four numbers that matter first */}
          <View style={styles.kpiGrid}>
            <StatCard
              label="Écoutes"
              value={formatCount(statsData.plays)}
              icon="headset-outline"
            />
            <StatCard
              label="Vues"
              value={formatCount(statsData.views)}
              icon="videocam-outline"
            />
            <StatCard
              label="Téléch."
              value={formatCount(statsData.downloads)}
              icon="cloud-download-outline"
            />
            <StatCard
              label="Revenus"
              value={formatMoney(statsData.downloadRevenue, "XOF")}
              icon="wallet-outline"
            />
          </View>

          {/* 30-day trend */}
          <ActivityCard
            daily={statsData.daily}
            metric={chartMetric}
            onMetricChange={setChartMetric}
            audience={{
              listeners: statsData.uniqueListeners,
              favorites: statsData.favorites,
              subscribers: statsData.subscribers,
            }}
          />

          {/* Per-song activity & popularity */}
          {statsData.songStats.length > 0 ? (
            <TopTracksCard songStats={statsData.songStats} />
          ) : null}

          {/* Publish */}
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
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
      ) : (
        <LoadingView label="Chargement des statistiques…" />
      )}

      <View style={{ marginTop: spacing.xl }}>
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

const styles = {
  kpiGrid: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: spacing.sm,
  },
};

/** KPI tile: tinted icon + label on top, big number below. */
function StatCard({
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
        flexBasis: "47%",
        flexGrow: 1,
        backgroundColor: colors.surface,
        borderRadius: radii.xl,
        borderWidth: 1,
        borderColor: colors.hairline,
        padding: spacing.lg,
        gap: 10,
      }}
    >
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}
      >
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: radii.sm,
            backgroundColor: colors.primaryTint,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name={icon} size={18} color={colors.primary} />
        </View>
        <AppText variant="small" color={colors.textMuted}>
          {label}
        </AppText>
      </View>
      <AppText
        numberOfLines={1}
        adjustsFontSizeToFit
        style={{ fontSize: 24, fontWeight: "800", letterSpacing: -0.5 }}
      >
        {value}
      </AppText>
    </View>
  );
}

function ActivityCard({
  daily,
  metric,
  onMetricChange,
  audience,
}: {
  daily: ArtistStats["daily"];
  metric: "plays" | "views";
  onMetricChange: (metric: "plays" | "views") => void;
  audience: { listeners: number; favorites: number; subscribers: number };
}) {
  const { colors } = useTheme();
  const values = daily.map((day) => day[metric]);
  const total = values.reduce((sum, value) => sum + value, 0);
  const average = values.length > 0 ? Math.round(total / values.length) : 0;
  const label = metric === "plays" ? "écoutes" : "vues";

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: radii.xl,
        borderWidth: 1,
        borderColor: colors.hairline,
        padding: spacing.lg,
        gap: spacing.md,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ flex: 1 }}>
          <AppText variant="subheading">Activité</AppText>
          <AppText variant="caption" color={colors.textFaint}>
            30 derniers jours
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
                paddingVertical: 5,
                backgroundColor:
                  metric === option ? colors.primaryTint : "transparent",
              }}
            >
              {option === "plays" ? "Écoutes" : "Vues"}
            </AppText>
          ))}
        </View>
      </View>

      {/* Total / average strip */}
      <View
        style={{
          flexDirection: "row",
          borderWidth: 1,
          borderColor: colors.hairline,
          borderRadius: radii.lg,
          padding: spacing.md,
        }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="heading">{formatCount(total)}</AppText>
          <AppText variant="caption" color={colors.textFaint}>
            Total {label}
          </AppText>
        </View>
        <View
          style={{
            width: 1,
            backgroundColor: colors.hairline,
            marginHorizontal: spacing.md,
          }}
        />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="heading">{formatCount(average)}</AppText>
          <AppText variant="caption" color={colors.textFaint}>
            Moy. / jour
          </AppText>
        </View>
      </View>

      <AreaChart values={values} />
      <ChartXLabels values={daily.map((day) => day.date)} />

      {/* Audience meta */}
      <AppText variant="caption" color={colors.textFaint}>
        {formatCount(audience.listeners)} auditeurs ·{" "}
        {formatCount(audience.favorites)} favoris ·{" "}
        {formatCount(audience.subscribers)} abonnés
      </AppText>
    </View>
  );
}

/**
 * Smooth gradient area chart of the 30-day series, with a dashed marker on
 * the most recent point — pure react-native-svg, no chart dependency.
 */
function AreaChart({ values }: { values: number[] }) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const height = 150;
  const padTop = 12;
  const padBottom = 6;

  const max = Math.max(1, ...values);
  const points = values.map((value, i) => ({
    x: values.length > 1 ? (i / (values.length - 1)) * width : 0,
    y: padTop + (1 - value / max) * (height - padTop - padBottom),
  }));
  const line = smoothPath(points);
  const last = points[points.length - 1];
  const area =
    line && points.length > 1
      ? `${line} L ${last.x} ${height} L ${points[0].x} ${height} Z`
      : "";

  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{ height }}
    >
      {width > 0 && area ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.primary} stopOpacity="0.28" />
              <Stop offset="1" stopColor={colors.primary} stopOpacity="0.02" />
            </LinearGradient>
          </Defs>
          <Path d={area} fill="url(#areaFill)" />
          <Path
            d={line}
            fill="none"
            stroke={colors.primary}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
          {/* Marker on the latest day */}
          <Line
            x1={last.x}
            y1={0}
            x2={last.x}
            y2={height}
            stroke={colors.textFaint}
            strokeWidth={1}
            strokeDasharray="3 4"
          />
          <Circle
            cx={last.x}
            cy={last.y}
            r={5}
            fill={colors.primary}
            stroke={colors.surface}
            strokeWidth={2.5}
          />
        </Svg>
      ) : null}
    </View>
  );
}

/** Five date ticks under the chart (first day, weekly steps, today). */
function ChartXLabels({ values }: { values: string[] }) {
  const { colors } = useTheme();
  if (values.length === 0) return null;
  const ticks = [0, 7, 14, 21, values.length - 1].filter(
    (tick, index, all) => all.indexOf(tick) === index,
  );
  const format = (iso: string) =>
    new Date(iso).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
    });

  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      {ticks.map((tick) => (
        <AppText key={tick} variant="caption" color={colors.textFaint}>
          {format(values[tick])}
        </AppText>
      ))}
    </View>
  );
}

/** Catmull-Rom → cubic bézier: gentle curves through every data point. */
function smoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length < 2) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

/** Ranked tracks with momentum badges, in a single card. */
function TopTracksCard({ songStats }: { songStats: ArtistStats["songStats"] }) {
  const { colors } = useTheme();
  const maxPlays = Math.max(1, ...songStats.map((song) => song.playCount));

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: radii.xl,
        borderWidth: 1,
        borderColor: colors.hairline,
        padding: spacing.lg,
        gap: spacing.md,
      }}
    >
      <AppText variant="subheading">Titres en vue</AppText>
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
                  {formatCount(song.uniqueListeners)} auditeurs
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
