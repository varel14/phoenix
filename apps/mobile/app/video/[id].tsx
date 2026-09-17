import { useEffect } from "react";
import { ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colors, spacing } from "@/theme";
import { useFavoriteIds, useVideo, useVideos } from "@/hooks/use-catalog";
import { useToggleFavorite } from "@/hooks/use-catalog";
import { trackEvent } from "@/services/events/event-queue";
import { AppText, ErrorView, IconButton, LoadingView } from "@/components/ui";
import { InteractiveRow } from "@/components/media/rows";
import { VideoHero, VideoPreview } from "@/components/video/video-card";
import { formatCount, formatDuration } from "@/utils/format";

export default function VideoDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const video = useVideo(id);
  const related = useVideos({ limit: 6, sort: "viewCount", order: "desc" });
  const { ids: favoriteIds } = useFavoriteIds();
  const toggleFavorite = useToggleFavorite();

  // Count a view once per visit (offline-safe, idempotent on the server).
  useEffect(() => {
    if (video.data) {
      trackEvent({ eventType: "VIEW", mediaType: "VIDEO", videoId: video.data.id });
    }
  }, [video.data?.id]);

  if (video.isLoading) return <LoadingView label="Loading video…" />;
  if (video.isError || !video.data) {
    return <ErrorView message={(video.error as Error)?.message} onRetry={() => void video.refetch()} />;
  }

  const data = video.data;
  const relatedVideos = (related.data?.data ?? []).filter((candidate) => candidate.id !== data.id).slice(0, 2);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <IconButton
        glyph="←"
        size={26}
        onPress={() => router.back()}
        accessibilityLabel="Back"
        style={{ position: "absolute", top: spacing.xl, left: spacing.md, zIndex: 10 }}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <VideoHero video={data} />

        <View style={{ padding: spacing.lg, gap: spacing.xs }}>
          <AppText variant="heading">{data.title}</AppText>
          <AppText variant="caption">
            {data.artist.name} · {formatCount(data.viewCount)} views · {formatDuration(data.durationSec)}
          </AppText>
          {data.description ? <AppText variant="bodyMuted" style={{ marginTop: spacing.sm }}>{data.description}</AppText> : null}
        </View>

        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
          <AppText
            onPress={() => toggleFavorite.mutate({ mediaType: "VIDEO", mediaId: data.id, favorite: !favoriteIds.has(data.id) })}
            style={{ color: favoriteIds.has(data.id) ? colors.favorite : colors.textMuted, fontWeight: "700" }}
          >
            {favoriteIds.has(data.id) ? "♥ In favorites" : "♡ Add to favorites"}
          </AppText>
        </View>

        {relatedVideos.length > 0 ? (
          <View style={{ gap: spacing.md, marginBottom: spacing.xl }}>
            <AppText variant="heading" style={{ paddingHorizontal: spacing.lg }}>
              Up next
            </AppText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
              {relatedVideos.map((candidate) => (
                <VideoPreview key={candidate.id} video={candidate} onPress={() => router.push(`/video/${candidate.id}`)} />
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={{ marginTop: spacing.md }}>
          <AppText variant="heading" style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.sm }}>
            More videos
          </AppText>
          {(related.data?.data ?? [])
            .filter((candidate) => candidate.id !== data.id && !relatedVideos.some((preview) => preview.id === candidate.id))
            .slice(0, 5)
            .map((candidate) => (
              <InteractiveRow
                key={candidate.id}
                media={candidate}
                mediaType="VIDEO"
                isFavorite={favoriteIds.has(candidate.id)}
                onPlay={() => router.push(`/video/${candidate.id}`)}
              />
            ))}
        </View>
      </ScrollView>
    </View>
  );
}
