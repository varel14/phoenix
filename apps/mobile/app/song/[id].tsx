import { Pressable, ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, layout, radii, spacing } from "@/theme";
import { formatDuration } from "@/utils/format";
import { playerService } from "@/services/media/player-service";
import { selectCurrentSong, usePlayerStore } from "@/stores/player-store";
import { AppText, ErrorView, IconButton, LoadingView } from "@/components/ui";
import { Artwork } from "@/components/media/artwork";
import { InteractiveRow } from "@/components/media/rows";
import { useFavoriteIds } from "@/hooks/use-catalog";
import type { Song } from "@/types/api";

export default function NowPlayingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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

  // Deep link: a song screen opened without the player running it.
  const displayed: Song | null = song ?? null;
  void params;

  if (!displayed) {
    return <ErrorView message="Nothing is playing right now." onRetry={() => router.back()} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
        <IconButton glyph="↓" size={24} onPress={() => router.back()} accessibilityLabel="Close player" />
        <AppText variant="caption" style={{ flex: 1, textAlign: "center" }}>
          {isOffline ? "PLAYING OFFLINE" : "NOW PLAYING"}
        </AppText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ alignItems: "center", padding: spacing.xl }}>
          <Artwork uri={displayed.thumbnailUrl} seed={displayed.id} label={displayed.title} size={layout.artworkLarge} radius={radii.lg} />
          <AppText variant="title" style={{ marginTop: spacing.xl, textAlign: "center" }}>
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
            <IconButton glyph="▶▶" size={26} onPress={() => playerService.previous()} accessibilityLabel="Previous" style={{ transform: [{ scaleX: -1 }] }} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isPlaying ? "Pause" : "Play"}
              onPress={() => playerService.togglePlay()}
              style={{
                width: 76,
                height: 76,
                borderRadius: radii.full,
                backgroundColor: colors.primary,
                alignItems: "center",
                justifyContent: "center",
                opacity: status === "loading" ? 0.6 : 1,
              }}
            >
              <AppText style={{ color: "#FFFFFF", fontSize: 30 }}>{isPlaying ? "❚❚" : "▶"}</AppText>
            </Pressable>
            <IconButton glyph="▶▶" size={26} onPress={() => playerService.next()} accessibilityLabel="Next" />
          </View>

          {status === "loading" ? <LoadingView label="Buffering…" /> : null}
          {status === "error" ? <AppText style={{ color: colors.danger, textAlign: "center" }}>{error ?? "Playback error"}</AppText> : null}
        </View>

        {queue.length > 1 ? (
          <View style={{ marginTop: spacing.xl }}>
            <AppText variant="heading" style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.sm }}>
              Queue
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
        <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.surfaceHighlight, overflow: "hidden" }}>
          <View
            style={{
              height: 4,
              width: duration > 0 ? `${Math.min(100, (currentTime / duration) * 100)}%` : "0%",
              backgroundColor: colors.primary,
            }}
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
