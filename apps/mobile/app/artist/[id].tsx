import { ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colors, radii, spacing } from "@/theme";
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
      <View style={{ backgroundColor: colors.surface, paddingBottom: spacing.lg }}>
        <View style={{ height: 140, backgroundColor: colors.surfaceElevated, borderBottomLeftRadius: radii.lg, borderBottomRightRadius: radii.lg }}>
          {data.bannerUrl ? <Artwork uri={data.bannerUrl} seed={`${data.id}-banner`} label={data.name} size={140} radius={0} /> : null}
        </View>
        <View style={{ paddingHorizontal: spacing.lg, marginTop: -40, gap: spacing.xs }}>
          <Artwork uri={data.avatarUrl} seed={data.id} label={data.name} size={80} radius={40} />
          <AppText variant="title" style={{ marginTop: spacing.sm }}>
            {data.name} {data.isVerified ? "✔" : ""}
          </AppText>
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
                  label={data.isFollowing ? "Following ✓" : "Follow"}
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
            <AppText variant="heading">Songs</AppText>
            <AppText onPress={() => void playerService.playQueue(songList, 0)} style={{ color: colors.primary, fontWeight: "700" }}>
              ▶ Play all
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
            Videos
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
