import { Pressable, ScrollView, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { glows, radii, spacing, withAlpha } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import {
  useFavoriteIds,
  useSongs,
  useToggleFavorite,
  useVideos,
} from "@/hooks/use-catalog";
import { useArtists } from "@/hooks/use-library";
import { AppText, ErrorView, LoadingView } from "@/components/ui";
import { InteractiveRow } from "@/components/media/rows";
import { Artwork } from "@/components/media/artwork";
import { playerService } from "@/services/media/player-service";
import { useAuthStore } from "@/stores/auth-store";
import type { Song } from "@/types/api";

const WEEKDAYS = [
  "dimanche",
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
];
const MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

export default function HomeScreen() {
  const { colors } = useTheme();
  const user = useAuthStore((state) => state.user);
  const songs = useSongs({ limit: 10, sort: "publishedAt", order: "desc" });
  const videos = useVideos({ limit: 5, sort: "viewCount", order: "desc" });
  const popular = useSongs({ limit: 8, sort: "playCount", order: "desc" });
  const artists = useArtists();
  const { ids: favoriteIds } = useFavoriteIds();
  const toggleFavorite = useToggleFavorite();

  if (
    songs.isLoading ||
    videos.isLoading ||
    popular.isLoading ||
    artists.isLoading
  ) {
    return <LoadingView label="Loading your music…" />;
  }
  if (songs.isError) {
    return (
      <ErrorView
        message={(songs.error as Error)?.message}
        onRetry={() => void songs.refetch()}
      />
    );
  }

  const newSongs = songs.data?.data ?? [];
  const popularSongs = popular.data?.data ?? [];

  const now = new Date();
  const greeting = now.getHours() < 18 ? "Bonjour" : "Bonsoir";
  const dateLabel = `${WEEKDAYS[now.getDay()]} ${now.getDate()} ${MONTHS[now.getMonth()]}`;
  const firstName = user?.name.split(/\s+/)[0];

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 180 }}>
      {/* Spotify-style greeting header */}
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.xl,
          paddingBottom: spacing.lg,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
          }}
        >
          <View style={{ flex: 1 }}>
            <AppText variant="small" style={{ letterSpacing: 1.5 }}>
              {dateLabel.toUpperCase()}
            </AppText>
            <AppText variant="title" style={{ marginTop: 2 }} numberOfLines={1}>
              {greeting}
              {firstName ? `, ${firstName}` : ""} ✨
            </AppText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Portefeuille"
            onPress={() => router.push("/pay")}
            style={({ pressed }) => ({
              width: 44,
              height: 44,
              borderRadius: radii.full,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.85 : 1,
              transform: [{ scale: pressed ? 0.96 : 1 }],
            })}
          >
            <Ionicons name="wallet-outline" size={20} color={colors.text} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            onPress={() => router.push("/notifications")}
            style={({ pressed }) => ({
              width: 44,
              height: 44,
              borderRadius: radii.full,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.85 : 1,
              transform: [{ scale: pressed ? 0.96 : 1 }],
            })}
          >
            <Ionicons
              name="notifications-outline"
              size={20}
              color={colors.text}
            />
          </Pressable>
        </View>
      </View>

      {/* Popular songs as square cards, Spotify cover style */}
      {popularSongs.length > 0 ? (
        <Section title="Tendances">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: spacing.lg,
              gap: spacing.md,
            }}
          >
            {popularSongs.map((song, index) => (
              <SongCard
                key={song.id}
                song={song}
                onPress={() =>
                  void playerService.playQueue(popularSongs, index)
                }
              />
            ))}
          </ScrollView>
        </Section>
      ) : null}

      {/* Quick actions: pay shortcuts */}
      <Section title="Actions rapides">
        <View
          style={{
            flexDirection: "row",
            gap: spacing.xs,
            marginHorizontal: spacing.lg,
          }}
        >
          <QuickAction
            label="Biblio"
            accessibilityLabel="Bibliothèque"
            icon="library-outline"
            onPress={() => router.push("/library")}
          />
          <QuickAction
            label="Payer"
            icon="card"
            highlighted
            onPress={() => router.push("/pay")}
          />
          <QuickAction
            label="Reçus"
            accessibilityLabel="Mes transactions"
            icon="receipt-outline"
            onPress={() => router.push("/pay/transactions")}
          />
          <QuickAction
            label="Panier"
            icon="cart-outline"
            onPress={() => router.push("/boutique/cart")}
          />
          <QuickAction
            label="Premium"
            icon="diamond-outline"
            onPress={() => router.push("/premium")}
          />
        </View>
      </Section>

      {/* Albums: featured gradient banner + cover carousel */}
      {newSongs.length > 0 ? (
        <Section
          title="Nouveautés"
          action={{
            label: "Tout voir",
            onPress: () => router.push("/explore"),
          }}
        >
          <FeaturedRelease
            song={newSongs[0]}
            isFavorite={favoriteIds.has(newSongs[0].id)}
            onPlay={() => void playerService.playQueue(newSongs, 0)}
            onToggleFavorite={() =>
              toggleFavorite.mutate({
                mediaType: "SONG",
                mediaId: newSongs[0].id,
                favorite: !favoriteIds.has(newSongs[0].id),
              })
            }
          />
          {newSongs.length > 1 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: spacing.lg,
                gap: spacing.md,
              }}
            >
              {newSongs.slice(1).map((song) => (
                <AlbumCard
                  key={song.id}
                  song={song}
                  onPress={() =>
                    void playerService.playQueue(
                      newSongs,
                      newSongs.indexOf(song),
                    )
                  }
                />
              ))}
            </ScrollView>
          ) : null}
        </Section>
      ) : null}

      <Section title="Popular right now">
        {newSongs.slice(0, 5).map((song) => (
          <InteractiveRow
            key={song.id}
            media={song}
            mediaType="SONG"
            isFavorite={favoriteIds.has(song.id)}
            onPlay={() =>
              void playerService.playQueue(newSongs, newSongs.indexOf(song))
            }
          />
        ))}
      </Section>

      <Section title="Artistes à suivre">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            gap: spacing.md,
          }}
        >
          {(artists.data?.data ?? []).slice(0, 8).map((artist) => (
            <ArtistPill
              key={artist.id}
              id={artist.id}
              name={artist.name}
              avatarUrl={artist.avatarUrl}
            />
          ))}
        </ScrollView>
      </Section>
    </ScrollView>
  );
}

function SongCard({ song, onPress }: { song: Song; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Écouter ${song.title}`}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 116,
        gap: spacing.sm,
        opacity: pressed ? 0.8 : 1,
        transform: [{ scale: pressed ? 0.96 : 1 }],
      })}
    >
      <Artwork
        uri={song.thumbnailUrl}
        seed={song.id}
        label={song.title}
        size={116}
        radius={12}
      />
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

/** Reference-style banner: brand gradient, eyebrow, play + favorite discs, cover right. */
function FeaturedRelease({
  song,
  isFavorite,
  onPlay,
  onToggleFavorite,
}: {
  song: Song;
  isFavorite: boolean;
  onPlay: () => void;
  onToggleFavorite: () => void;
}) {
  const { colors, gradients } = useTheme();
  const disc = {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: withAlpha(colors.onPrimary, 0.14),
  };
  return (
    <LinearGradient
      colors={gradients.brand}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        marginHorizontal: spacing.lg,
        marginBottom: spacing.md,
        padding: spacing.lg,
        borderRadius: radii.xl,
        overflow: "hidden",
        boxShadow: glows.brand,
      }}
    >
      <View style={{ flex: 1, gap: spacing.md }}>
        <View style={{ gap: 2 }}>
          <AppText
            variant="small"
            style={{
              color: withAlpha(colors.onPrimary, 0.66),
              letterSpacing: 1.4,
            }}
          >
            NOUVELLE SORTIE
          </AppText>
          <AppText
            variant="subheading"
            numberOfLines={1}
            style={{ color: colors.onPrimary, fontSize: 19, fontWeight: "800" }}
          >
            {song.title}
          </AppText>
          <AppText
            variant="small"
            numberOfLines={1}
            style={{ color: withAlpha(colors.onPrimary, 0.74) }}
          >
            {song.artist.name}
          </AppText>
        </View>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Écouter ${song.title}`}
            onPress={onPlay}
            style={({ pressed }) => [
              disc,
              pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] },
            ]}
          >
            <Ionicons
              name="play"
              size={20}
              color={colors.onPrimary}
              style={{ marginLeft: 2 }}
            />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"
            }
            onPress={onToggleFavorite}
            style={({ pressed }) => [
              disc,
              pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] },
            ]}
          >
            <Ionicons
              name={isFavorite ? "heart" : "heart-outline"}
              size={20}
              color={colors.onPrimary}
            />
          </Pressable>
        </View>
      </View>
      {/* 22px banner radius − 16px padding = 6px inner radius, concentric */}
      <Artwork
        uri={song.thumbnailUrl}
        seed={song.id}
        label={song.title}
        size={92}
        radius={radii.sm}
      />
    </LinearGradient>
  );
}

function AlbumCard({ song, onPress }: { song: Song; onPress: () => void }) {
  const { colors, gradients, shadows } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Écouter ${song.title}`}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 140,
        gap: spacing.sm,
        opacity: pressed ? 0.85 : 1,
        transform: [{ scale: pressed ? 0.96 : 1 }],
      })}
    >
      <View style={{ borderRadius: radii.lg, boxShadow: shadows.card }}>
        <Artwork
          uri={song.thumbnailUrl}
          seed={song.id}
          label={song.title}
          size={140}
          radius={radii.lg}
        />
        <View
          style={{
            position: "absolute",
            right: spacing.sm,
            bottom: spacing.sm,
            width: 36,
            height: 36,
            borderRadius: radii.full,
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          <LinearGradient
            colors={gradients.brand}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              flex: 1,
              width: "100%",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons
              name="play"
              size={15}
              color={colors.onPrimary}
              style={{ marginLeft: 1 }}
            />
          </LinearGradient>
        </View>
      </View>
      <View style={{ gap: 2 }}>
        <AppText
          numberOfLines={1}
          style={{ fontSize: 13, fontWeight: "600", color: colors.text }}
        >
          {song.title}
        </AppText>
        <AppText variant="small" numberOfLines={1}>
          {song.artist.name}
        </AppText>
      </View>
    </Pressable>
  );
}

function QuickAction({
  label,
  icon,
  highlighted,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  highlighted?: boolean;
  accessibilityLabel?: string;
  onPress: () => void;
}) {
  const { colors, gradients } = useTheme();
  const tile = {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: "center",
        gap: spacing.sm,
        paddingVertical: spacing.sm,
        borderRadius: radii.md,
        backgroundColor: pressed ? colors.surfaceHighlight : "transparent",
        opacity: pressed ? 0.9 : 1,
        transform: [{ scale: pressed ? 0.96 : 1 }],
      })}
    >
      {highlighted ? (
        <LinearGradient
          colors={gradients.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={tile}
        >
          <Ionicons name={icon} size={20} color={colors.onPrimary} />
        </LinearGradient>
      ) : (
        <View style={{ ...tile, backgroundColor: colors.primaryTint }}>
          <Ionicons name={icon} size={20} color={colors.primary} />
        </View>
      )}
      <AppText variant="small" color={colors.text} numberOfLines={1}>
        {label}
      </AppText>
    </Pressable>
  );
}

function ArtistPill({
  id,
  name,
  avatarUrl,
}: {
  id: string;
  name: string;
  avatarUrl: string | null;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/artist/${id}`)}
      style={{ width: 68, alignItems: "center", gap: spacing.xs }}
    >
      <Artwork uri={avatarUrl} seed={id} label={name} size={60} radius={30} fallback="brand" />
      <AppText
        variant="caption"
        numberOfLines={1}
        style={{ textAlign: "center" }}
      >
        {name}
      </AppText>
    </Pressable>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: { label: string; onPress: () => void };
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: spacing.xl }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: spacing.lg,
          marginBottom: spacing.md,
        }}
      >
        <AppText
          variant="subheading"
          style={{ flex: 1, fontWeight: "700" }}
        >
          {title}
        </AppText>
        {action ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={action.label}
            onPress={action.onPress}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 2,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <AppText
              style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}
            >
              {action.label}
            </AppText>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}
