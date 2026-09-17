import { Pressable, ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { layout, radii, spacing } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import { formatDuration } from "@/utils/format";
import { playerService } from "@/services/media/player-service";
import { selectCurrentSong, usePlayerStore } from "@/stores/player-store";
import { AppText, ErrorView, IconButton, LoadingView } from "@/components/ui";
import { Artwork } from "@/components/media/artwork";
import { InteractiveRow } from "@/components/media/rows";
import { useFavoriteIds, useToggleFavorite } from "@/hooks/use-catalog";
import type { Song } from "@/types/api";

export default function NowPlayingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, gradients } = useTheme();
  const params = useLocalSearchParams<{ id: string }>();
  const song = usePlayerStore(selectCurrentSong);
  const queue = usePlayerStore((state) => state.queue);
  const index = usePlayerStore((state) => state.index);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const status = usePlayerStore((state) => state.status);
  const error = usePlayerStore((state) => state.error);
  const currentTime = usePlayerStore((state) => state.currentTime);
  const duration = usePlayerStore((state) => state.duration);
  const isOffline = usePlayerStore((state) => state.isOfflinePlayback);
  const { ids: favoriteIds } = useFavoriteIds();
  const toggleFavorite = useToggleFavorite();

  // Deep link: a song screen opened without the player running it.
  const displayed: Song | null = song ?? null;
  void params;

  if (!displayed) {
    return <ErrorView message="Nothing is playing right now." onRetry={() => router.back()} />;
  }

  const isFavorite = favoriteIds.has(displayed.id);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <LinearGradient
        colors={gradients.brandDeep}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
        <IconButton icon="chevron-down" size={26} onPress={() => router.back()} accessibilityLabel="Close player" />
        <AppText variant="caption" color={colors.onGradientMuted} style={{ flex: 1, textAlign: "center", letterSpacing: 2 }}>
          {isOffline ? "LECTURE HORS LIGNE" : "EN LECTURE"}
        </AppText>
        <IconButton
          icon={isFavorite ? "heart" : "heart-outline"}
          size={22}
          color={isFavorite ? colors.favorite : colors.text}
          onPress={() => toggleFavorite.mutate({ mediaType: "SONG", mediaId: displayed.id, favorite: !isFavorite })}
          accessibilityLabel={isFavorite ? "Remove from favorites" : "Add to favorites"}
        />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} style={{ flex: 1 }}>
        <View style={{ alignItems: "center", padding: spacing.xl }}>
          <Artwork uri={displayed.thumbnailUrl} seed={displayed.id} label={displayed.title} size={layout.artworkLarge} radius={radii.lg} />
          <AppText variant="title" color={colors.text} style={{ marginTop: spacing.xl, textAlign: "center" }}>
            {displayed.title}
          </AppText>
          <AppText variant="bodyMuted" style={{ marginTop: spacing.xs }}>
            {displayed.artist.name}
            {displayed.genre ? ` · ${displayed.genre}` : ""}
          </AppText>
        </View>

        <View style={{ paddingHorizontal: spacing.xl, gap: spacing.md }}>
          <SeekBar currentTime={currentTime} duration={duration} onSeek={(seconds) => playerService.seek(seconds)} />

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xl }}>
            <IconButton
              icon="play-skip-back"
              size={28}
              onPress={() => playerService.previous()}
              accessibilityLabel="Previous"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isPlaying ? "Pause" : "Play"}
              onPress={() => playerService.togglePlay()}
              style={{ opacity: status === "loading" ? 0.6 : 1 }}
            >
              <LinearGradient
                colors={gradients.brand}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  width: 76,
                  height: 76,
                  borderRadius: radii.full,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name={isPlaying ? "pause" : "play"} size={30} color="#FFFFFF" />
              </LinearGradient>
            </Pressable>
            <IconButton
              icon="play-skip-forward"
              size={28}
              onPress={() => playerService.next()}
              accessibilityLabel="Next"
            />
          </View>

          {status === "loading" ? <LoadingView label="Buffering…" /> : null}
          {status === "error" ? <AppText style={{ color: colors.danger, textAlign: "center" }}>{error ?? "Playback error"}</AppText> : null}
        </View>

        {queue.length > 1 ? (
          <View style={{ marginTop: spacing.xl }}>
            <AppText variant="heading" style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.sm }}>
              File d'attente
            </AppText>
            {queue.map((queueSong, queueIndex) => (
              <View key={`${queueSong.id}-${queueIndex}`} style={{ opacity: queueIndex === index ? 1 : 0.7 }}>
                <InteractiveRow
                  media={queueSong}
                  mediaType="SONG"
                  isFavorite={favoriteIds.has(queueSong.id)}
                  onPlay={() => void playerService.playQueue(queue, queueIndex)}
                />
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function SeekBar({
  currentTime,
  duration,
  onSeek,
}: {
  currentTime: number;
  duration: number;
  onSeek: (seconds: number) => void;
}) {
  const { colors, gradients } = useTheme();
  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;
  return (
    <View style={{ gap: 4 }}>
      <Pressable
        accessibilityLabel="Seek"
        onPress={(event) => {
          const width = event.nativeEvent.locationX;
          if (duration > 0) onSeek((width / 320) * duration);
        }}
        style={{ height: 20, justifyContent: "center" }}
      >
        <View style={{ height: 5, borderRadius: radii.full, backgroundColor: colors.surfaceHighlight, overflow: "hidden" }}>
          <LinearGradient
            colors={gradients.brand}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ height: 5, width: `${Math.round(progress * 100)}%`, borderRadius: radii.full }}
          />
        </View>
      </Pressable>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <AppText variant="small">{formatDuration(currentTime)}</AppText>
        <AppText variant="small">{formatDuration(duration)}</AppText>
      </View>
    </View>
  );
}
