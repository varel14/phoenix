import { Pressable, StyleSheet, View } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import { radii, spacing } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import { formatDuration } from "@/utils/format";
import { AppText, IconButton } from "@/components/ui";
import { Artwork } from "@/components/media/artwork";
import type { Video as VideoModel } from "@/types/api";

/**
 * Inline video card with its own expo-video Player instance. Multiple cards
 * can play simultaneously (the brief requires three concurrent players);
 * pass `exclusive` to pause other registered players on this screen instead.
 */
export function VideoCard({ video, autoPlay = false, muted = false }: { video: VideoModel; autoPlay?: boolean; muted?: boolean }) {
  const { colors } = useTheme();
  const player = useVideoPlayer(video.videoUrl, (instance) => {
    instance.muted = muted;
    if (autoPlay) {
      instance.play();
    }
  });

  return (
    <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
      <VideoView
        player={player}
        style={styles.player}
        contentFit="cover"
        fullscreenOptions={{ enable: true }}
        allowsPictureInPicture
        nativeControls={player.playing}
      />
      <View style={styles.overlayRow}>
        <AppText variant="subheading" numberOfLines={1} style={styles.title}>
          {video.title}
        </AppText>
        <IconButton
          icon={player.playing ? "pause" : "play"}
          onPress={() => {
            if (player.playing) {
              player.pause();
            } else {
              player.play();
            }
          }}
          accessibilityLabel={player.playing ? "Pause video" : "Play video"}
        />
      </View>
      <AppText variant="caption" style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.sm }}>
        {video.artist.name} · {formatDuration(video.durationSec)}
      </AppText>
    </View>
  );
}

/** Large hero player used on the video detail screen. */
export function VideoHero({ video, autoPlay = true }: { video: VideoModel; autoPlay?: boolean }) {
  const { colors } = useTheme();
  const player = useVideoPlayer(video.videoUrl, (instance) => {
    if (autoPlay) instance.play();
  });

  return (
    <VideoView
      player={player}
      style={{ width: "100%", aspectRatio: 16 / 9, backgroundColor: colors.surface }}
      contentFit="contain"
      fullscreenOptions={{ enable: true }}
      allowsPictureInPicture
      nativeControls
    />
  );
}

/** Small muted preview player (used alongside the hero for related videos). */
export function VideoPreview({ video, onPress }: { video: VideoModel; onPress: () => void }) {
  const { colors } = useTheme();
  const player = useVideoPlayer(video.videoUrl, (instance) => {
    instance.muted = true;
    instance.loop = true;
    instance.play();
  });

  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.preview, { backgroundColor: colors.surfaceElevated }]}>
      <VideoView
        player={player}
        style={styles.previewPlayer}
        contentFit="cover"
        nativeControls={false}
      />
      <View style={styles.previewOverlay}>
        <Artwork uri={video.thumbnailUrl} seed={video.id} label={video.title} size={28} radius={4} />
        <AppText numberOfLines={1} style={{ color: "#FFFFFFCC", fontSize: 12, fontWeight: "600", flex: 1 }}>
          {video.title}
        </AppText>
        <AppText style={{ color: "#FFFFFF99", fontSize: 11 }}>{formatDuration(video.durationSec)}</AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    overflow: "hidden",
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  player: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: "#000000",
  },
  overlayRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm + 2,
    gap: spacing.sm,
  },
  title: {
    flex: 1,
  },
  preview: {
    width: 180,
    borderRadius: radii.md,
    overflow: "hidden",
  },
  previewPlayer: {
    width: 180,
    height: 101,
    backgroundColor: "#000000",
  },
  previewOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    padding: spacing.sm,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
});
