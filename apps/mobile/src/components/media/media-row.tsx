import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { radii, spacing } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import { formatCount, formatDuration } from "@/utils/format";
import { AppText, ContextMenu, type MenuAction, IconButton } from "@/components/ui";
import { Artwork } from "./artwork";
import type { MediaType, Song, Video } from "@/types/api";

interface MediaRowProps {
  media: Song | Video;
  mediaType: MediaType;
  isFavorite: boolean;
  onPlay: () => void;
  onToggleFavorite: () => void;
  menuActions?: MenuAction[];
  subtitleOverride?: string;
  right?: React.ReactNode;
}

/** Shared list row for songs and videos: artwork, title, meta, heart, ⋮. */
export function MediaRow({
  media,
  mediaType,
  isFavorite,
  onPlay,
  onToggleFavorite,
  menuActions,
  subtitleOverride,
  right,
}: MediaRowProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const isSong = mediaType === "SONG";
  const song = media as Song;
  const video = media as Video;

  const subtitle =
    subtitleOverride ??
    `${media.artist.name} · ${formatDuration(isSong ? song.durationSec : video.durationSec)} · ${formatCount(
      isSong ? song.playCount : video.viewCount,
    )} ${isSong ? "plays" : "views"}`;

  const defaultActions: MenuAction[] = [
    { label: isFavorite ? "Remove from favorites" : "Add to favorites", icon: isFavorite ? "heart-dislike-outline" : "heart-outline", onPress: onToggleFavorite },
    ...(menuActions ?? []),
    {
      label: "View artist",
      icon: "person-circle-outline",
      onPress: () => router.push(`/artist/${media.artistId}`),
    },
  ];

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPlay}
      style={({ pressed }) => [row, pressed && { backgroundColor: colors.surface }]}
    >
      <Artwork uri={media.thumbnailUrl} seed={media.id} label={media.title} size={56} radius={radii.sm} />
      <View style={styles.textColumn}>
        <AppText variant="subheading" numberOfLines={1} style={styles.title}>
          {media.title}
        </AppText>
        <AppText variant="caption" numberOfLines={1}>
          {subtitle}
        </AppText>
      </View>
      <View style={styles.actions}>
        {right}
        <IconButton
          icon={isFavorite ? "heart" : "heart-outline"}
          color={isFavorite ? colors.favorite : colors.textMuted}
          onPress={onToggleFavorite}
          accessibilityLabel={isFavorite ? "Remove from favorites" : "Add to favorites"}
        />
        <ContextMenu actions={defaultActions} />
      </View>
    </Pressable>
  );
}

const row = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: spacing.md,
  paddingHorizontal: spacing.lg,
  paddingVertical: spacing.sm + 2,
  borderRadius: radii.md,
};

const styles = StyleSheet.create({
  textColumn: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 15,
  },
  actions: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
  },
});
