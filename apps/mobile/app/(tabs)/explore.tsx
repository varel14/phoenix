import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { colors, radii, spacing } from "@/theme";
import {
  useDebouncedValue,
  useFavoriteIds,
  useSongSearch,
  useSongs,
  useVideoSearch,
  useVideos,
} from "@/hooks/use-catalog";
import { AppText, EmptyView, ErrorView, Input, LoadingView } from "@/components/ui";
import { InteractiveRow } from "@/components/media/rows";
import type { Song, Video } from "@/types/api";
import { playerService } from "@/services/media/player-service";

type Tab = "SONGS" | "VIDEOS";

export default function ExploreScreen() {
  const [tab, setTab] = useState<Tab>("SONGS");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim());
  const searching = debouncedSearch.length > 0;

  const songs = useSongs({ limit: 30, sort: "playCount", order: "desc" });
  const videos = useVideos({ limit: 20, sort: "viewCount", order: "desc" });
  const songResults = useSongSearch(debouncedSearch, searching);
  const videoResults = useVideoSearch(debouncedSearch, searching);
  const { ids: favoriteIds } = useFavoriteIds();

  interface ActiveList {
    data: Array<Song | Video>;
    isLoading: boolean;
    isError: boolean;
    refetch: () => void;
    error: Error | null;
  }

  const active = useMemo<ActiveList>(() => {
    if (tab === "SONGS") {
      return {
        data: (searching ? songResults.data?.data : songs.data?.data) ?? [],
        isLoading: searching ? songResults.isLoading : songs.isLoading,
        isError: searching ? songResults.isError : songs.isError,
        refetch: (): void => {
          if (searching) void songResults.refetch();
          else void songs.refetch();
        },
        error: (searching ? songResults.error : songs.error) as Error | null,
      };
    }
    return {
      data: (searching ? videoResults.data?.data : videos.data?.data) ?? [],
      isLoading: searching ? videoResults.isLoading : videos.isLoading,
      isError: searching ? videoResults.isError : videos.isError,
      refetch: () => (searching ? void videoResults.refetch() : void videos.refetch()),
      error: (searching ? videoResults.error : videos.error) as Error | null,
    };
  }, [tab, searching, songs, videos, songResults, videoResults]);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.md }}>
        <AppText variant="title">Explore</AppText>
        <Input placeholder="Search songs, videos, artists…" value={search} onChangeText={setSearch} />
        <View style={segmentWrap}>
          <SegmentButton label="Music" active={tab === "SONGS"} onPress={() => setTab("SONGS")} />
          <SegmentButton label="Videos" active={tab === "VIDEOS"} onPress={() => setTab("VIDEOS")} />
        </View>
      </View>

      {active.isLoading ? (
        <LoadingView />
      ) : active.isError ? (
        <ErrorView message={active.error?.message} onRetry={active.refetch} />
      ) : active.data.length === 0 ? (
        <EmptyView
          title={searching ? "No results" : "Nothing here yet"}
          subtitle={searching ? `Nothing matches “${debouncedSearch}”.` : "Content will appear as artists publish."}
        />
      ) : (
        <ScrollView contentContainerStyle={{ paddingVertical: spacing.md, paddingBottom: 180 }}>
          {tab === "SONGS"
            ? active.data.map((media) => (
                <InteractiveRow
                  key={media.id}
                  media={media}
                  mediaType="SONG"
                  isFavorite={favoriteIds.has(media.id)}
                  onPlay={() => {
                    const songQueue = active.data as Song[];
                    void playerService.playQueue(songQueue, songQueue.indexOf(media as Song));
                  }}
                />
              ))
            : active.data.map((media) => (
                <InteractiveRow
                  key={media.id}
                  media={media}
                  mediaType="VIDEO"
                  isFavorite={favoriteIds.has(media.id)}
                  onPlay={() => router.push(`/video/${media.id}`)}
                />
              ))}
        </ScrollView>
      )}
    </View>
  );
}

function SegmentButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[segmentButton, active && { backgroundColor: colors.primary }]}
    >
      <AppText style={{ color: active ? "#FFFFFF" : colors.textMuted, fontWeight: "700", fontSize: 14 }}>
        {label}
      </AppText>
    </Pressable>
  );
}

const segmentWrap = {
  flexDirection: "row" as const,
  backgroundColor: colors.surface,
  borderRadius: radii.md,
  padding: 3,
  gap: 3,
};

const segmentButton = {
  flex: 1,
  height: 36,
  borderRadius: radii.sm,
  alignItems: "center" as const,
  justifyContent: "center" as const,
};
