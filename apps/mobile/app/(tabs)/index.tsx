import { Pressable, ScrollView, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { radii, spacing } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import { useFavoriteIds, useSongs, useVideos } from "@/hooks/use-catalog";
import { useArtists } from "@/hooks/use-library";
import { AppText, ErrorView, LoadingView } from "@/components/ui";
import { InteractiveRow } from "@/components/media/rows";
import { Artwork } from "@/components/media/artwork";
import { playerService } from "@/services/media/player-service";

export default function HomeScreen() {
  const { colors, gradients } = useTheme();
  const songs = useSongs({ limit: 10, sort: "publishedAt", order: "desc" });
  const videos = useVideos({ limit: 5, sort: "viewCount", order: "desc" });
  const artists = useArtists();
  const { ids: favoriteIds } = useFavoriteIds();

  if (songs.isLoading || videos.isLoading || artists.isLoading) {
    return <LoadingView label="Loading your music…" />;
  }
  if (songs.isError) {
    return <ErrorView message={(songs.error as Error)?.message} onRetry={() => void songs.refetch()} />;
  }

  const newSongs = songs.data?.data ?? [];
  const heroSong = newSongs[0];

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 180 }}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.md }}>
        <AppText variant="title">Accueil</AppText>
        <AppText variant="bodyMuted" style={{ marginTop: 2 }}>
          Fresh for you today
        </AppText>
      </View>

      {/* Gradient "Écouter" hero card per mockup */}
      {heroSong ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => void playerService.playQueue(newSongs, 0)}
          style={{ marginHorizontal: spacing.lg, marginBottom: spacing.xl }}
        >
          <LinearGradient
            colors={gradients.brand}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: radii.lg, padding: spacing.xl, gap: spacing.sm }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.xs,
              }}
            >
              <Ionicons name="sparkles" size={14} color={colors.onGradientMuted} />
              <AppText variant="small" color={colors.onGradientMuted} style={{ letterSpacing: 1.5 }}>
                ÉCOUTER
              </AppText>
            </View>
            <AppText variant="title" color={colors.onPrimary} numberOfLines={2}>
              {heroSong.title}
            </AppText>
            <AppText color={colors.onGradientMuted} numberOfLines={1}>
              {heroSong.artist.name}
            </AppText>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: radii.full,
                  backgroundColor: "rgba(255,255,255,0.22)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="play" size={18} color="#FFFFFF" />
              </View>
              <AppText color={colors.onPrimary} style={{ fontWeight: "700" }}>
                Lecture
              </AppText>
            </View>
          </LinearGradient>
        </Pressable>
      ) : null}

      {/* Chuyassi Emmanuel Pay / Exchange entry */}
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/pay")}
        style={{ marginHorizontal: spacing.lg, marginBottom: spacing.xl }}
      >
        <LinearGradient
          colors={gradients.premium}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: radii.lg, padding: spacing.xl, gap: 6 }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
            <Ionicons name="card" size={14} color="#3D2500" />
            <AppText variant="small" color="#3D2500" style={{ letterSpacing: 1.5 }}>
              CHUYASSI EMMANUEL PAY
            </AppText>
          </View>
          <AppText variant="heading" color="#2A1A00">
            Payer / Échanger
          </AppText>
          <AppText color="#4A3000">Frais scolaires, factures, services administratifs — réglez tout depuis l'application.</AppText>
        </LinearGradient>
      </Pressable>

      <Section title="New releases">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
          {newSongs.map((song) => (
            <Artwork
              key={song.id}
              uri={song.thumbnailUrl}
              seed={song.id}
              label={song.title}
              size={120}
              radius={12}
            />
          ))}
        </ScrollView>
      </Section>

      <Section title="Popular right now">
        {newSongs.slice(0, 5).map((song) => (
          <InteractiveRow
            key={song.id}
            media={song}
            mediaType="SONG"
            isFavorite={favoriteIds.has(song.id)}
            onPlay={() => void playerService.playQueue(newSongs, newSongs.indexOf(song))}
          />
        ))}
      </Section>

      <Section title="Artistes à suivre">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
          {(artists.data?.data ?? []).slice(0, 8).map((artist) => (
            <ArtistPill key={artist.id} id={artist.id} name={artist.name} avatarUrl={artist.avatarUrl} />
          ))}
        </ScrollView>
      </Section>
    </ScrollView>
  );
}

function ArtistPill({ id, name, avatarUrl }: { id: string; name: string; avatarUrl: string | null }) {
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push(`/artist/${id}`)} style={{ width: 88, alignItems: "center", gap: spacing.xs }}>
      <Artwork uri={avatarUrl} seed={id} label={name} size={80} radius={40} />
      <AppText variant="caption" numberOfLines={1} style={{ textAlign: "center" }}>
        {name}
      </AppText>
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: spacing.xl }}>
      <AppText variant="heading" style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
        {title}
      </AppText>
      {children}
    </View>
  );
}
