import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { colors, layout, radii, spacing } from "@/theme";
import { formatDuration } from "@/utils/format";
import { playerService } from "@/services/media/player-service";
import { selectCurrentSong, usePlayerStore } from "@/stores/player-store";
import { AppText, IconButton } from "@/components/ui";
import { ProgressBar } from "@/components/ui";
import { Artwork } from "@/components/media/artwork";

/** Global mini player docked above the tab bar; opens Now Playing on tap. */
export function MiniPlayer() {
  const router = useRouter();
  const song = usePlayerStore(selectCurrentSong);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const status = usePlayerStore((state) => state.status);
  const currentTime = usePlayerStore((state) => state.currentTime);
  const duration = usePlayerStore((state) => state.duration);

  if (!song || status === "idle") return null;

  return (
    <View style={styles.wrapper}>
      <ProgressBar progress={duration > 0 ? currentTime / duration : 0} />
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push(`/song/${song.id}`)}
        style={({ pressed }) => [styles.bar, pressed && { opacity: 0.85 }]}
      >
        <Artwork uri={song.thumbnailUrl} seed={song.id} label={song.title} size={44} radius={radii.sm} />
        <View style={styles.meta}>
          <AppText variant="subheading" numberOfLines={1} style={{ fontSize: 14 }}>
            {song.title}
          </AppText>
          <AppText variant="caption" numberOfLines={1}>
            {song.artist.name} · {formatDuration(currentTime)} / {formatDuration(duration)}
          </AppText>
        </View>
        <IconButton
          glyph={isPlaying ? "❚❚" : "▶"}
          size={20}
          onPress={() => playerService.togglePlay()}
          accessibilityLabel={isPlaying ? "Pause" : "Play"}
        />
        <IconButton glyph="▶▶" size={16} onPress={() => playerService.next()} accessibilityLabel="Next" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.playerBar,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  bar: {
    height: layout.miniPlayerHeight,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  meta: {
    flex: 1,
    gap: 2,
  },
});
