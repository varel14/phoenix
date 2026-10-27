import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
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
import { artworkGradient, formatCount } from "@/utils/format";
import { bestFieldScore } from "@/utils/fuzzy";
import type { Song, Video } from "@/types/api";
import { playerService } from "@/services/media/player-service";

interface AlbumGroup {
  key: string;
  name: string;
  artist: string;
  artworkUri: string | null;
  seed: string;
  tracks: Song[];
}

interface TopResult {
  kind: "SONG" | "ARTIST";
  title: string;
  subtitle: string;
  imageUri: string | null;
  seed: string;
}

/** Melon/Spotify-style Explore: browse-first discovery with grouped, typo-tolerant search. */
export default function ExploreScreen() {
  const { colors } = useTheme();
  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(search.trim());
  const searching = debouncedSearch.length > 0;

  const newSongs = useSongs({ limit: 12, sort: "publishedAt", order: "desc" });
  const songPool = useSongs({ limit: 200, sort: "playCount", order: "desc" });
  const videos = useVideos({ limit: 50, sort: "viewCount", order: "desc" });
  const artistsBrowse = useArtists();
  const artistSearchApi = useArtists(searching ? debouncedSearch : undefined);
  const songApiResults = useSongSearch(debouncedSearch, searching);
  const videoApiResults = useVideoSearch(debouncedSearch, searching);
  const { ids: favoriteIds } = useFavoriteIds();

  const newSongList = newSongs.data?.data ?? [];
  const pool = songPool.data?.data ?? [];
  const videoList = videos.data?.data ?? [];
  const artistList = artistsBrowse.data?.data ?? [];

  const genres = useMemo(() => {
    const counts = new Map<string, number>();
    for (const song of pool) {
      const g = song.genre?.trim();
      if (g) counts.set(g, (counts.get(g) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  }, [pool]);

  const albums = useMemo<AlbumGroup[]>(() => {
    const groups = new Map<string, AlbumGroup>();
    for (const song of pool) {
      if (!song.albumName) continue;
      const key = `${song.artist.name}::${song.albumName}`;
      const group = groups.get(key);
      if (group) group.tracks.push(song);
      else
        groups.set(key, {
          key,
          name: song.albumName,
          artist: song.artist.name,
          artworkUri: song.thumbnailUrl,
          seed: song.id,
          tracks: [song],
        });
    }
    return [...groups.values()].filter((group) => group.tracks.length > 1);
  }, [pool]);

  // --- Search: API results first, then fuzzy pool matches so typos/accent drift still hit ---
  const songResults = useMemo(() => {
    if (!searching) return [];
    const api = songApiResults.data?.data ?? [];
    const apiIds = new Set(api.map((song) => song.id));
    const fuzzy = pool
      .filter((song) => !apiIds.has(song.id))
      .map((song) => ({ song, score: bestFieldScore(debouncedSearch, [song.title, song.artist.name, song.albumName]) }))
      .filter((match) => match.score >= 0.42)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map((match) => match.song);
    return [...api, ...fuzzy];
  }, [searching, debouncedSearch, songApiResults.data, pool]);

  const videoResults = useMemo(() => {
    if (!searching) return [];
    const api = videoApiResults.data?.data ?? [];
    const apiIds = new Set(api.map((video) => video.id));
    const fuzzy = videoList
      .filter((video) => !apiIds.has(video.id))
      .map((video) => ({ video, score: bestFieldScore(debouncedSearch, [video.title, video.artist.name]) }))
      .filter((match) => match.score >= 0.42)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((match) => match.video);
    return [...api, ...fuzzy];
  }, [searching, debouncedSearch, videoApiResults.data, videoList]);

  const artistResults = useMemo(() => {
    if (!searching) return [];
    const api = artistSearchApi.data?.data ?? [];
    const apiIds = new Set(api.map((artist) => artist.id));
    const fuzzy = artistList
      .filter((artist) => !apiIds.has(artist.id))
      .map((artist) => ({ artist, score: bestFieldScore(debouncedSearch, [artist.name]) }))
      .filter((match) => match.score >= 0.42)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((match) => match.artist);
    return [...api, ...fuzzy];
  }, [searching, debouncedSearch, artistSearchApi.data, artistList]);

  const topResult = useMemo<TopResult | null>(() => {
    if (!searching) return null;
    const candidates: Array<TopResult & { id: string; score: number }> = [];
    const apiSongIds = new Set((songApiResults.data?.data ?? []).map((song) => song.id));
    for (const song of songResults) {
      candidates.push({
        kind: "SONG",
        id: song.id,
        title: song.title,
        subtitle: `Titre · ${song.artist.name}`,
        imageUri: song.thumbnailUrl,
        seed: song.id,
        score: apiSongIds.has(song.id) ? 1 : bestFieldScore(debouncedSearch, [song.title, song.artist.name, song.albumName]),
      });
    }
    const apiArtistIds = new Set((artistSearchApi.data?.data ?? []).map((artist) => artist.id));
    for (const artist of artistResults) {
      candidates.push({
        kind: "ARTIST",
        id: artist.id,
        title: artist.name,
        subtitle: "Artiste",
        imageUri: artist.avatarUrl,
        seed: artist.id,
        score: apiArtistIds.has(artist.id) ? 1 : bestFieldScore(debouncedSearch, [artist.name]),
      });
    }
    if (candidates.length === 0) return null;
    const { id, ...rest } = candidates.reduce((best, c) => (c.score > best.score ? c : best));
    void id;
    return rest;
  }, [searching, debouncedSearch, songResults, artistResults, songApiResults.data, artistSearchApi.data]);

  const searchLoading =
    searching && (songApiResults.isLoading || videoApiResults.isLoading || artistSearchApi.isLoading);

  const genreSongs = useMemo(() => {
    if (searching || !genre) return [];
    return pool.filter((song) => song.genre?.trim() === genre);
  }, [searching, genre, pool]);

  if (!searching && (newSongs.isLoading || songPool.isLoading || videos.isLoading || artistsBrowse.isLoading)) {
    return <LoadingView label="Chargement de l'explorateur…" />;
  }
  if (songPool.isError) {
    return <ErrorView message={(songPool.error as Error)?.message} onRetry={() => void songPool.refetch()} />;
  }

  const noResults =
    searching && !searchLoading && songResults.length === 0 && artistResults.length === 0 && videoResults.length === 0;

  return (
    <ScrollView contentContainerStyle={{ paddingTop: spacing.lg, paddingBottom: 180 }} stickyHeaderIndices={[1]}>
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
        <AppText variant="title">Explorer</AppText>
      </View>
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.md,
          backgroundColor: colors.background,
        }}
      >
        <View>
          <Input
            placeholder="Artiste, titres, albums…"
            value={search}
            onChangeText={setSearch}
            style={search.length > 0 ? { paddingRight: 44 } : undefined}
          />
          {search.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Effacer la recherche"
              onPress={() => setSearch("")}
              style={{ position: "absolute", right: 12, top: 12, width: 24, height: 24 }}
            >
              <Ionicons name="close-circle" size={22} color={colors.textFaint} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {searching ? (
        searchLoading ? (
          <LoadingView label="Recherche…" />
        ) : noResults ? (
          <EmptyView
            title="Aucun résultat"
            subtitle={`Rien ne correspond à « ${debouncedSearch} ». Vérifiez l'orthographe ou essayez quelques lettres du nom.`}
          />
        ) : (
          <View style={{ gap: spacing.xl, paddingBottom: spacing.xl }}>
            {topResult ? (
              <View>
                <AppText variant="heading" style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
                  Meilleur résultat
                </AppText>
                <TopResultCard
                  result={topResult}
                  onPress={() => {
                    if (topResult.kind === "ARTIST") router.push(`/artist/${topResult.seed}`);
                    else {
                      const index = songResults.findIndex((song) => song.id === topResult.seed);
                      void playerService.playQueue(songResults, Math.max(0, index));
                    }
                  }}
                />
              </View>
            ) : null}
            {artistResults.length > 0 ? (
              <View>
                <AppText variant="heading" style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
                  Artistes
                </AppText>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}
                >
                  {artistResults.map((artist) => (
                    <ArtistPill key={artist.id} id={artist.id} name={artist.name} avatarUrl={artist.avatarUrl} />
                  ))}
                </ScrollView>
              </View>
            ) : null}
            {songResults.length > 0 ? (
              <View>
                <AppText variant="heading" style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
                  Titres
                </AppText>
                {songResults.map((song) => (
                  <InteractiveRow
                    key={song.id}
                    media={song}
                    mediaType="SONG"
                    isFavorite={favoriteIds.has(song.id)}
                    onPlay={() => void playerService.playQueue(songResults, songResults.indexOf(song))}
                  />
                ))}
              </View>
            ) : null}
            {videoResults.length > 0 ? (
              <View>
                <AppText variant="heading" style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
                  Vidéos
                </AppText>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}
                >
                  {videoResults.map((video) => (
                    <VideoCard key={video.id} video={video} />
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </View>
        )
      ) : genre ? (
        <View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retour aux catégories"
            onPress={() => setGenre(null)}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.sm,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Ionicons name="chevron-back" size={20} color={colors.text} />
            <AppText variant="caption">Toutes les catégories</AppText>
          </Pressable>
          <AppText variant="heading" style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
            {genre}
          </AppText>
          {genreSongs.map((song) => (
            <InteractiveRow
              key={song.id}
              media={song}
              mediaType="SONG"
              isFavorite={favoriteIds.has(song.id)}
              onPlay={() => void playerService.playQueue(genreSongs, genreSongs.indexOf(song))}
            />
          ))}
        </View>
      ) : (
        <View style={{ gap: spacing.xl }}>
          {genres.length > 0 ? (
            <View>
              <AppText variant="heading" style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
                Parcourir les genres
              </AppText>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md, paddingHorizontal: spacing.lg }}>
                {genres.map((name) => (
                  <GenreTile key={name} name={name} onPress={() => setGenre(name)} />
                ))}
              </View>
            </View>
          ) : null}

          {newSongList.length > 0 ? (
            <View>
              <AppText variant="heading" style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
                Nouveautés
              </AppText>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}
              >
                {newSongList.map((song, index) => (
                  <SongCard
                    key={song.id}
                    song={song}
                    onPress={() => void playerService.playQueue(newSongList, index)}
                  />
                ))}
              </ScrollView>
            </View>
          ) : null}

          {artistList.length > 0 ? (
            <View>
              <AppText variant="heading" style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
                Artistes à découvrir
              </AppText>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}
              >
                {artistList.map((artist) => (
                  <ArtistPill key={artist.id} id={artist.id} name={artist.name} avatarUrl={artist.avatarUrl} />
                ))}
              </ScrollView>
            </View>
          ) : null}

          {albums.length > 0 ? (
            <View>
              <AppText variant="heading" style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
                Albums en vedette
              </AppText>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}
              >
                {albums.map((album) => (
                  <SongCard
                    key={album.key}
                    song={
                      {
                        id: album.seed,
                        title: album.name,
                        artist: { name: album.artist },
                        thumbnailUrl: album.artworkUri,
                      } as Song
                    }
                    onPress={() => void playerService.playQueue(album.tracks, 0)}
                  />
                ))}
              </ScrollView>
            </View>
          ) : null}

          {videoList.length > 0 ? (
            <View>
              <AppText variant="heading" style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
                Clips populaires
              </AppText>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}
              >
                {videoList.slice(0, 12).map((video) => (
                  <VideoCard key={video.id} video={video} />
                ))}
              </ScrollView>
            </View>
          ) : null}
        </View>
      )}
    </ScrollView>
  );
}

function TopResultCard({ result, onPress }: { result: TopResult; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ouvrir ${result.title}`}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        marginHorizontal: spacing.lg,
        backgroundColor: colors.surface,
        borderRadius: radii.lg,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
        opacity: pressed ? 0.85 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <Artwork uri={result.imageUri} seed={result.seed} label={result.title} size={72} radius={radii.md} />
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="subheading" numberOfLines={1}>
          {result.title}
        </AppText>
        <AppText variant="caption" numberOfLines={1}>
          {result.subtitle}
        </AppText>
      </View>
      <Ionicons
        name={result.kind === "ARTIST" ? "person-circle-outline" : "musical-notes"}
        size={22}
        color={colors.primary}
      />
    </Pressable>
  );
}

/** Spotify-style genre tile — deterministic brand-family gradient per genre. */
function GenreTile({ name, onPress }: { name: string; onPress: () => void }) {
  const gradient = artworkGradient(name);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Explorer le genre ${name}`}
      onPress={onPress}
      style={({ pressed }) => ({
        width: "47.5%",
        height: 84,
        opacity: pressed ? 0.85 : 1,
        transform: [{ scale: pressed ? 0.96 : 1 }],
      })}
    >
      <LinearGradient
        colors={[gradient.from, gradient.to]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          flex: 1,
          borderRadius: radii.md,
          padding: spacing.md,
          justifyContent: "space-between",
          overflow: "hidden",
        }}
      >
        <AppText variant="subheading" color="#FFFFFF" numberOfLines={2} style={{ paddingRight: spacing.sm }}>
          {name}
        </AppText>
        <Ionicons
          name="musical-notes"
          size={28}
          color="rgba(255,255,255,0.85)"
          style={{ position: "absolute", right: -6, bottom: -8, transform: [{ rotate: "20deg" }] }}
        />
      </LinearGradient>
    </Pressable>
  );
}

function SongCard({ song, onPress }: { song: Song; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Écouter ${song.title}`}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 120,
        gap: spacing.sm,
        opacity: pressed ? 0.8 : 1,
        transform: [{ scale: pressed ? 0.96 : 1 }],
      })}
    >
      <Artwork uri={song.thumbnailUrl} seed={song.id} label={song.title} size={120} radius={12} />
      <View style={{ gap: 2 }}>
        <AppText variant="caption" numberOfLines={1}>
          {song.title}
        </AppText>
        <AppText variant="small" numberOfLines={1}>
          {song.artist.name}
        </AppText>
      </View>
    </Pressable>
  );
}

function ArtistPill({ id, name, avatarUrl }: { id: string; name: string; avatarUrl: string | null }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Voir l'artiste ${name}`}
      onPress={() => router.push(`/artist/${id}`)}
      style={{ width: 88, alignItems: "center", gap: spacing.xs }}
    >
      <Artwork uri={avatarUrl} seed={id} label={name} size={80} radius={40} />
      <AppText variant="caption" numberOfLines={1} style={{ textAlign: "center" }}>
        {name}
      </AppText>
    </Pressable>
  );
}

function VideoCard({ video }: { video: Video }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Regarder ${video.title}`}
      onPress={() => router.push(`/video/${video.id}`)}
      style={({ pressed }) => ({
        width: 150,
        gap: spacing.sm,
        opacity: pressed ? 0.8 : 1,
        transform: [{ scale: pressed ? 0.96 : 1 }],
      })}
    >
      <Artwork uri={video.thumbnailUrl} seed={video.id} label={video.title} size={150} radius={12} />
      <View style={{ gap: 2 }}>
        <AppText variant="caption" numberOfLines={1}>
          {video.title}
        </AppText>
        <AppText variant="small" numberOfLines={1}>
          {formatCount(video.viewCount)} vues
        </AppText>
      </View>
    </Pressable>
  );
}
