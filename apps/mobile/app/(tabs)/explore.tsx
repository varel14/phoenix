import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { radii, spacing } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import {
  useDebouncedValue,
  useFavoriteIds,
  useSongSearch,
  useSongs,
  useVideoSearch,
  useVideos,
} from "@/hooks/use-catalog";
import { useArtists } from "@/hooks/use-library";
import { AppText, EmptyView, ErrorView, Input, LoadingView } from "@/components/ui";
import { InteractiveRow } from "@/components/media/rows";
import { Artwork } from "@/components/media/artwork";
import { formatCount } from "@/utils/format";
import type { ArtistWithCounts, Song, Video } from "@/types/api";
import { playerService } from "@/services/media/player-service";

type Tab = "ARTISTS" | "SONGS" | "VIDEOS";

/** Mockup "Artistes" screen: search + artist cards, plus music/video discovery. */
export default function ExploreScreen() {
  const { colors } = useTheme();
  const [tab, setTab] = useState<Tab>("ARTISTS");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim());
  const searching = debouncedSearch.length > 0;

  const artists = useArtists();
  const songs = useSongs({ limit: 30, sort: "playCount", order: "desc" });
  const videos = useVideos({ limit: 20, sort: "viewCount", order: "desc" });
  const songResults = useSongSearch(debouncedSearch, searching);
  const videoResults = useVideoSearch(debouncedSearch, searching);
  const { ids: favoriteIds } = useFavoriteIds();

  const artistList = useMemo(() => {
    const list = artists.data?.data ?? [];
    if (!searching) return list;
    const needle = debouncedSearch.toLowerCase();
    return list.filter((artist) => artist.name.toLowerCase().includes(needle));
  }, [artists.data, searching, debouncedSearch]);

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
    if (tab === "VIDEOS") {
      return {
        data: (searching ? videoResults.data?.data : videos.data?.data) ?? [],
        isLoading: searching ? videoResults.isLoading : videos.isLoading,
        isError: searching ? videoResults.isError : videos.isError,
        refetch: () => (searching ? void videoResults.refetch() : void videos.refetch()),
        error: (searching ? videoResults.error : videos.error) as Error | null,
      };
    }
    return { data: [], isLoading: false, isError: false, refetch: () => {}, error: null };
  }, [tab, searching, songs, videos, songResults, videoResults]);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.md }}>
        <AppText variant="title">Artistes</AppText>
        <Input placeholder="Rechercher artistes, musiques, vidéos…" value={search} onChangeText={setSearch} />
        <View
          style={{
            flexDirection: "row",
            backgroundColor: colors.primaryTint,
            borderRadius: radii.full,
            padding: 3,
            gap: 3,
          }}
        >
          <SegmentButton label="Artistes" active={tab === "ARTISTS"} onPress={() => setTab("ARTISTS")} />
          <SegmentButton label="Musique" active={tab === "SONGS"} onPress={() => setTab("SONGS")} />
          <SegmentButton label="Vidéos" active={tab === "VIDEOS"} onPress={() => setTab("VIDEOS")} />
        </View>
      </View>

      {tab === "ARTISTS" ? (
        artists.isLoading ? (
          <LoadingView />
        ) : artists.isError ? (
          <ErrorView message={(artists.error as Error)?.message} onRetry={() => void artists.refetch()} />
        ) : artistList.length === 0 ? (
          <EmptyView
            title={searching ? "No results" : "Nothing here yet"}
            subtitle={searching ? `Nothing matches “${debouncedSearch}”.` : "Content will appear as artists publish."}
          />
        ) : (
          <ScrollView contentContainerStyle={{ paddingVertical: spacing.md, paddingBottom: 180, paddingHorizontal: spacing.lg, gap: spacing.sm }}>
            {artistList.map((artist: ArtistWithCounts) => (
              <ArtistCard key={artist.id} artist={artist} />
            ))}
          </ScrollView>
        )
      ) : active.isLoading ? (
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

function ArtistCard({ artist }: { artist: ArtistWithCounts }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/artist/${artist.id}`)}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          backgroundColor: colors.surface,
          borderRadius: radii.lg,
          padding: spacing.md,
          borderWidth: 1,
          borderColor: colors.border,
        },
        pressed && { opacity: 0.8 },
      ]}
    >
      <Artwork uri={artist.avatarUrl} seed={artist.id} label={artist.name} size={56} radius={28} />
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="subheading" numberOfLines={1}>
          {artist.name}
        </AppText>
        <AppText variant="caption" numberOfLines={1}>
          {formatCount(artist._count.followers)} followers · {artist._count.songs} titres
        </AppText>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
    </Pressable>
  );
}

function SegmentButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        flex: 1,
        height: 36,
        borderRadius: radii.full,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: active ? colors.primary : "transparent",
      }}
    >
      <AppText style={{ color: active ? "#FFFFFF" : colors.textMuted, fontWeight: "700", fontSize: 13 }}>
        {label}
      </AppText>
    </Pressable>
  );
}
