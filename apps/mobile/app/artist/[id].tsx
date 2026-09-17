import { ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { radii, spacing } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import { useFavoriteIds } from "@/hooks/use-catalog";
import { useArtist, useArtistSongs, useArtistVideos, useFollowArtist } from "@/hooks/use-library";
import { AppText, Button, ErrorView, LoadingView } from "@/components/ui";
import { Artwork } from "@/components/media/artwork";
import { InteractiveRow } from "@/components/media/rows";
import { playerService } from "@/services/media/player-service";
import { formatCount } from "@/utils/format";
import { useAuthStore } from "@/stores/auth-store";

export default function ArtistDetailScreen() {
  const router = useRouter();
  const { colors, gradients } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((state) => state.user);
  const artist = useArtist(id);
  const songs = useArtistSongs(id);
  const videos = useArtistVideos(id);
  const { ids: favoriteIds } = useFavoriteIds();
  const follow = useFollowArtist(id);

  if (artist.isLoading) return <LoadingView />;
  if (artist.isError || !artist.data) {
    return <ErrorView message={(artist.error as Error)?.message} onRetry={() => void artist.refetch()} />;
  }

  const data = artist.data;
  const songList = songs.data?.data ?? [];
  const videoList = videos.data?.data ?? [];
  const isOwnProfile = user && data.userId === user.id;

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 180 }}>
      {/* Gradient header with banner + avatar, per mockup artist profile. */}
      <View>
        <LinearGradient
          colors={gradients.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ height: 170, borderBottomLeftRadius: radii.lg, borderBottomRightRadius: radii.lg, justifyContent: "flex-end" }}
        >
          {data.bannerUrl ? (
            <Artwork uri={data.bannerUrl} seed={`${data.id}-banner`} label={data.name} size={170} radius={0} />
          ) : (
            <View style={{ padding: spacing.lg }}>
              <Ionicons name="flame" size={44} color="rgba(255,255,255,0.35)" />
            </View>
          )}
        </LinearGradient>
        <View style={{ paddingHorizontal: spacing.lg, marginTop: -36, gap: spacing.xs }}>
          <Artwork uri={data.avatarUrl} seed={data.id} label={data.name} size={80} radius={40} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.sm }}>
            <AppText variant="title">{data.name}</AppText>
            {data.isVerified ? <Ionicons name="checkmark-circle" size={20} color={colors.accent} /> : null}
          </View>
          {data.bio ? <AppText variant="bodyMuted">{data.bio}</AppText> : null}
          <AppText variant="caption">
            {formatCount(data._count.followers)} followers · {data._count.songs} songs · {data._count.videos} videos
          </AppText>

          {isOwnProfile ? (
            <View style={{ marginTop: spacing.md }}>
              <Button label="Manage in artist studio" onPress={() => router.push("/studio")} />
            </View>
          ) : (
            <View style={{ marginTop: spacing.md, flexDirection: "row", gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Button
                  label={data.isFollowing ? "Following ✓" : "Suivre"}
                  variant={data.isFollowing ? "secondary" : "primary"}
                  loading={follow.isPending}
                  onPress={() => follow.mutate(!data.isFollowing)}
                />
              </View>
            </View>
          )}
        </View>
      </View>

      {songList.length > 0 ? (
        <View style={{ marginTop: spacing.lg }}>
          <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.sm, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <AppText variant="heading">Titres populaires</AppText>
            <AppText onPress={() => void playerService.playQueue(songList, 0)} style={{ color: colors.accent, fontWeight: "700" }}>
              ▶ Tout écouter
            </AppText>
          </View>
          {songList.map((song) => (
            <InteractiveRow
              key={song.id}
              media={song}
              mediaType="SONG"
              isFavorite={favoriteIds.has(song.id)}
              onPlay={() => void playerService.playQueue(songList, songList.indexOf(song))}
            />
          ))}
        </View>
      ) : null}

      {videoList.length > 0 ? (
        <View style={{ marginTop: spacing.lg }}>
          <AppText variant="heading" style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.sm }}>
            Vidéos
          </AppText>
          {videoList.map((video) => (
            <InteractiveRow
              key={video.id}
              media={video}
              mediaType="VIDEO"
              isFavorite={favoriteIds.has(video.id)}
              onPlay={() => router.push(`/video/${video.id}`)}
            />
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}
