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
import { useArtists, useFollowArtist, useFollowing } from "@/hooks/use-library";
import {
  AppText,
  EmptyView,
  ErrorView,
  Input,
  LoadingView,
} from "@/components/ui";
import { InteractiveRow } from "@/components/media/rows";
import { Artwork } from "@/components/media/artwork";
import { formatCount } from "@/utils/format";
import type { ArtistWithCounts, Song, Video } from "@/types/api";
import { playerService } from "@/services/media/player-service";

type Tab = "ARTISTS" | "SONGS" | "ALBUMS" | "VIDEOS";

/** Album grouping (albums have no dedicated model — tracks carry albumName). */
interface AlbumGroup {
  key: string;
  name: string;
  artist: string;
  artworkUri: string | null;
  seed: string;
  tracks: Song[];
}

/** Explore: search across titres, albums, artistes and vidéos. */
export default function ExploreScreen() {
  const { colors } = useTheme();
  const [tab, setTab] = useState<Tab>("SONGS");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim());
  const searching = debouncedSearch.length > 0;

  const artists = useArtists(debouncedSearch);
  const songs = useSongs({ limit: 30, sort: "playCount", order: "desc" });
  const videos = useVideos({ limit: 20, sort: "viewCount", order: "desc" });
  const songResults = useSongSearch(debouncedSearch, searching);
  const videoResults = useVideoSearch(debouncedSearch, searching);
  const { ids: favoriteIds } = useFavoriteIds();
  const following = useFollowing();
  const followedArtistIds = useMemo(
    () => new Set((following.data?.data ?? []).map((entry) => entry.artist.id)),
    [following.data],
  );

  const songList = useMemo(
    () => (searching ? songResults.data?.data : songs.data?.data) ?? [],
    [searching, songResults.data, songs.data],
  );

  const albums = useMemo<AlbumGroup[]>(() => {
    const groups = new Map<string, AlbumGroup>();
    for (const song of songList) {
      if (!song.albumName) continue;
      const key = `${song.artist.name}::${song.albumName}`;
      const group = groups.get(key);
      if (group) {
        group.tracks.push(song);
      } else {
        groups.set(key, {
          key,
          name: song.albumName,
          artist: song.artist.name,
          artworkUri: song.thumbnailUrl,
          seed: song.id,
          tracks: [song],
        });
      }
    }
    return [...groups.values()].filter((group) => group.tracks.length > 1);
  }, [songList]);

  interface ActiveList {
    data: Array<Song | Video>;
    isLoading: boolean;
    isError: boolean;
    refetch: () => void;
    error: Error | null;
  }

  const active = useMemo<ActiveList>(() => {
    if (tab === "SONGS" || tab === "ALBUMS") {
      return {
        data: songList,
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
        refetch: () =>
          searching ? void videoResults.refetch() : void videos.refetch(),
        error: (searching ? videoResults.error : videos.error) as Error | null,
      };
    }
    return {
      data: [],
      isLoading: false,
      isError: false,
      refetch: () => {},
      error: null,
    };
  }, [tab, searching, songs, videos, songResults, videoResults, songList]);

  return (
    <View style={{ flex: 1 }}>
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          gap: spacing.md,
        }}
      >
        <AppText variant="title">Explorer</AppText>
        <Input
          placeholder="Rechercher musiques, albums, artistes…"
          value={search}
          onChangeText={setSearch}
        />
        <View
          style={{
            flexDirection: "row",
            backgroundColor: colors.primaryTint,
            borderRadius: radii.md,
            padding: 3,
            gap: 3,
          }}
        >
          <SegmentButton
            label="Titres"
            active={tab === "SONGS"}
            onPress={() => setTab("SONGS")}
          />
          <SegmentButton
            label="Albums"
            active={tab === "ALBUMS"}
            onPress={() => setTab("ALBUMS")}
          />
          <SegmentButton
            label="Artistes"
            active={tab === "ARTISTS"}
            onPress={() => setTab("ARTISTS")}
          />
          <SegmentButton
            label="Vidéos"
            active={tab === "VIDEOS"}
            onPress={() => setTab("VIDEOS")}
          />
        </View>
      </View>

      {tab === "ARTISTS" ? (
        artists.isLoading ? (
          <LoadingView />
        ) : artists.isError ? (
          <ErrorView
            message={(artists.error as Error)?.message}
            onRetry={() => void artists.refetch()}
          />
        ) : (artists.data?.data ?? []).length === 0 ? (
          <EmptyView
            title={searching ? "Aucun résultat" : "Rien pour le moment"}
            subtitle={
              searching
                ? `Aucun artiste ne correspond à « ${debouncedSearch} ».`
                : "Les artistes apparaîtront dès leur inscription."
            }
          />
        ) : (
          <ScrollView
            contentContainerStyle={{
              paddingVertical: spacing.md,
              paddingBottom: 180,
              paddingHorizontal: spacing.lg,
              gap: spacing.sm,
            }}
          >
            {(artists.data?.data ?? []).map((artist: ArtistWithCounts) => (
              <ArtistCard
                key={artist.id}
                artist={artist}
                isFollowing={followedArtistIds.has(artist.id)}
              />
            ))}
          </ScrollView>
        )
      ) : active.isLoading ? (
        <LoadingView />
      ) : active.isError ? (
        <ErrorView message={active.error?.message} onRetry={active.refetch} />
      ) : active.data.length === 0 ? (
        <EmptyView
          title={searching ? "Aucun résultat" : "Rien pour le moment"}
          subtitle={
            searching
              ? `Rien ne correspond à « ${debouncedSearch} ».`
              : "Le contenu apparaîtra dès sa publication."
          }
        />
      ) : tab === "ALBUMS" ? (
        <ScrollView
          contentContainerStyle={{
            paddingVertical: spacing.md,
            paddingBottom: 180,
            paddingHorizontal: spacing.lg,
            gap: spacing.md,
          }}
        >
          {albums.map((album) => (
            <AlbumCard
              key={album.key}
              album={album}
              onPress={() => void playerService.playQueue(album.tracks, 0)}
            />
          ))}
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingVertical: spacing.md,
            paddingBottom: 180,
          }}
        >
          {tab === "SONGS"
            ? active.data.map((media) => (
                <InteractiveRow
                  key={media.id}
                  media={media}
                  mediaType="SONG"
                  isFavorite={favoriteIds.has(media.id)}
                  onPlay={() => {
                    const songQueue = active.data as Song[];
                    void playerService.playQueue(
                      songQueue,
                      songQueue.indexOf(media as Song),
                    );
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

function ArtistCard({
  artist,
  isFollowing,
}: {
  artist: ArtistWithCounts;
  isFollowing: boolean;
}) {
  const { colors } = useTheme();
  const toggleFollow = useFollowArtist(artist.id);
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
      <Artwork
        uri={artist.avatarUrl}
        seed={artist.id}
        label={artist.name}
        size={56}
        radius={28}
      />
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="subheading" numberOfLines={1}>
          {artist.name}
        </AppText>
        <AppText variant="caption" numberOfLines={1}>
          {formatCount(artist._count.followers)} followers ·{" "}
          {artist._count.songs} titres
        </AppText>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          isFollowing ? "Ne plus suivre" : "Suivre cet artiste"
        }
        onPress={() => toggleFollow.mutate(!isFollowing)}
        style={({ pressed }) => ({
          paddingHorizontal: spacing.md,
          height: 32,
          borderRadius: radii.sm + 2,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: isFollowing ? colors.border : colors.primary,
          backgroundColor: isFollowing ? "transparent" : colors.primaryTint,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <AppText
          style={{
            fontSize: 11,
            fontWeight: "700",
            color: isFollowing ? colors.textMuted : colors.primary,
          }}
        >
          {isFollowing ? "Abonné(e)" : "Suivre"}
        </AppText>
      </Pressable>
    </Pressable>
  );
}

function AlbumCard({
  album,
  onPress,
}: {
  album: AlbumGroup;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Écouter l'album ${album.name}`}
      onPress={onPress}
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
      <Artwork
        uri={album.artworkUri}
        seed={album.seed}
        label={album.name}
        size={56}
        radius={radii.md}
      />
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="subheading" numberOfLines={1}>
          {album.name}
        </AppText>
        <AppText variant="caption" numberOfLines={1}>
          {album.artist} · {album.tracks.length} titres
        </AppText>
      </View>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: radii.full,
          backgroundColor: colors.primaryTint,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons
          name="play"
          size={16}
          color={colors.primary}
          style={{ marginLeft: 2 }}
        />
      </View>
    </Pressable>
  );
}

function SegmentButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        flex: 1,
        height: 36,
        borderRadius: radii.sm + 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: active ? colors.primary : "transparent",
      }}
    >
      <AppText
        style={{
          color: active ? "#FFFFFF" : colors.textMuted,
          fontWeight: "700",
          fontSize: 13,
        }}
      >
        {label}
      </AppText>
    </Pressable>
  );
}
