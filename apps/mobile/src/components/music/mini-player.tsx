import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { layout, radii, spacing } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import { formatDuration } from "@/utils/format";
import { playerService } from "@/services/media/player-service";
import { selectCurrentSong, usePlayerStore } from "@/stores/player-store";
import { AppText, IconButton } from "@/components/ui";
import { Artwork } from "@/components/media/artwork";

/** Global mini player docked above the tab bar; opens Now Playing on tap. */
export function MiniPlayer() {
  const router = useRouter();
  const { colors, gradients } = useTheme();
  const song = usePlayerStore(selectCurrentSong);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const status = usePlayerStore((state) => state.status);
  const currentTime = usePlayerStore((state) => state.currentTime);
  const duration = usePlayerStore((state) => state.duration);

  if (!song || status === "idle") return null;

  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <View
      style={{
        backgroundColor: colors.playerBar,
        borderTopWidth: 1,
        borderTopColor: colors.border,
      }}
    >
      {/* Brand-gradient progress line across the top of the bar. */}
      <View style={{ height: 3, backgroundColor: colors.surfaceHighlight }}>
        <LinearGradient
          colors={gradients.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ height: 3, width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%` }}
        />
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push(`/song/${song.id}`)}
        style={({ pressed }) => [
          {
            height: layout.miniPlayerHeight,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
            paddingHorizontal: spacing.md,
          },
          pressed && { opacity: 0.85 },
        ]}
      >
        <Artwork uri={song.thumbnailUrl} seed={song.id} label={song.title} size={44} radius={radii.sm} />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="subheading" numberOfLines={1} style={{ fontSize: 14 }}>
            {song.title}
          </AppText>
          <AppText variant="caption" numberOfLines={1}>
            {song.artist.name} · {formatDuration(currentTime)} / {formatDuration(duration)}
          </AppText>
        </View>
        <IconButton
          icon={isPlaying ? "pause" : "play"}
          size={20}
          color={colors.text}
          onPress={() => playerService.togglePlay()}
          accessibilityLabel={isPlaying ? "Pause" : "Play"}
        />
        <IconButton icon="play-skip-forward" size={18} color={colors.textMuted} onPress={() => playerService.next()} accessibilityLabel="Next" />
      </Pressable>
    </View>
  );
}
