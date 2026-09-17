import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { radii, spacing } from "@/theme";
import { useTheme, useThemeModeStore, type ThemeMode } from "@/theme/theme-provider";
import { useAuthStore } from "@/stores/auth-store";
import { useBecomeArtist, useFollowing, useMyArtist } from "@/hooks/use-library";
import { AppText, Button, Input, LoadingView } from "@/components/ui";
import { Artwork } from "@/components/media/artwork";

const THEME_OPTIONS: Array<{ value: ThemeMode; label: string; icon: React.ComponentProps<typeof Ionicons>["name"] }> = [
  { value: "system", label: "Système", icon: "phone-portrait-outline" },
  { value: "dark", label: "Sombre", icon: "moon-outline" },
  { value: "light", label: "Clair", icon: "sunny-outline" },
];

export default function ProfileScreen() {
  const router = useRouter();
  const { colors, gradients } = useTheme();
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const isSigningOut = useAuthStore((state) => state.isSigningOut);
  const myArtist = useMyArtist();
  const following = useFollowing();

  if (!user) return null;

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 180, gap: spacing.xl }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.lg }}>
        <Artwork uri={user.image} seed={user.id} label={user.name} size={72} radius={36} />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="heading">{user.name}</AppText>
          <AppText variant="bodyMuted">{user.email}</AppText>
          <AppText variant="small" style={{ color: user.role === "ARTIST" ? colors.accent : colors.textFaint }}>
            {user.role === "ARTIST" ? "COMPTE CRÉATEUR" : "AUDITEUR"}
          </AppText>
        </View>
      </View>

      {/* Premium entry per mockup (Abonnements) */}
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/premium")}
        style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
      >
        <View
          style={{
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: colors.gold,
            backgroundColor: colors.surface,
            padding: spacing.lg,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
          }}
        >
          <Ionicons name="star" size={24} color={colors.gold} />
          <View style={{ flex: 1 }}>
            <AppText variant="subheading" color={colors.gold}>
              Phoenix Premium
            </AppText>
            <AppText variant="caption">Abonnement — musique et vidéos sans limites</AppText>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.gold} />
        </View>
      </Pressable>

      <AppearanceCard />

      {myArtist.data ? (
        <Button
          label="Ouvrir le Studio Créateur"
          onPress={() => router.push("/studio")}
        />
      ) : (
        <BecomeArtistCard />
      )}

      <View style={{ gap: spacing.sm }}>
        <AppText variant="heading">Following</AppText>
        {following.isLoading ? (
          <LoadingView />
        ) : (following.data?.data ?? []).length === 0 ? (
          <AppText variant="bodyMuted">You are not following any artists yet.</AppText>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {(following.data?.data ?? []).map((follow) => (
              <Pressable
                key={follow.id}
                accessibilityRole="button"
                onPress={() => router.push(`/artist/${follow.artist.id}`)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                  backgroundColor: colors.surface,
                  borderRadius: radii.lg,
                  padding: spacing.md,
                }}
              >
                <Artwork uri={follow.artist.avatarUrl} seed={follow.artist.id} label={follow.artist.name} size={44} radius={22} />
                <AppText variant="subheading">{follow.artist.name}</AppText>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <Button label={isSigningOut ? "Signing out…" : "Sign out"} variant="secondary" onPress={() => void signOut()} loading={isSigningOut} />

      <View style={{ alignItems: "center", gap: spacing.xs, paddingTop: spacing.sm }}>
        <AppText variant="small">PHOENIX</AppText>
        <View style={{ width: 40, height: 4, borderRadius: radii.full, backgroundColor: gradients.brand[1] }} />
      </View>
    </ScrollView>
  );
}

function AppearanceCard() {
  const { colors } = useTheme();
  const mode = useThemeModeStore((state) => state.mode);
  const setMode = useThemeModeStore((state) => state.setMode);

  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.md }}>
      <AppText variant="heading">Apparence</AppText>
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        {THEME_OPTIONS.map((option) => {
          const active = mode === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              onPress={() => setMode(option.value)}
              style={{
                flex: 1,
                alignItems: "center",
                gap: spacing.xs,
                paddingVertical: spacing.md,
                borderRadius: radii.md,
                backgroundColor: active ? colors.primaryTint : "transparent",
                borderWidth: 1,
                borderColor: active ? colors.primary : colors.border,
              }}
            >
              <Ionicons name={option.icon} size={20} color={active ? colors.primary : colors.textMuted} />
              <AppText variant="caption" color={active ? colors.primary : colors.textMuted}>
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function BecomeArtistCard() {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const becomeArtist = useBecomeArtist();

  const refresh = useAuthStore((state) => state.refresh);

  if (!open) {
    return (
      <View style={{ backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <Ionicons name="rocket-outline" size={22} color={colors.primary} />
          <AppText variant="heading">Passez au compte Créateur</AppText>
        </View>
        <AppText variant="bodyMuted">
          L'abonnement Creator débloque votre espace artiste :
        </AppText>
        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Ionicons name="cloud-upload-outline" size={16} color={colors.success} />
            <AppText variant="body">Publiez vos musiques et vos vidéos</AppText>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Ionicons name="stats-chart-outline" size={16} color={colors.success} />
            <AppText variant="body">Suivez les statistiques d'écoute de vos titres</AppText>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Ionicons name="people-outline" size={16} color={colors.success} />
            <AppText variant="body">Faites-vous suivre par vos fans</AppText>
          </View>
        </View>
        <Button label="Devenir Créateur" onPress={() => setOpen(true)} />
      </View>
    );
  }

  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.md }}>
      <AppText variant="heading">Créez votre profil Créateur</AppText>
      <Input placeholder="Artist name" value={name} onChangeText={setName} />
      <Input placeholder="Short bio (optional)" value={bio} onChangeText={setBio} multiline />
      <Button
        label="Create profile"
        loading={becomeArtist.isPending}
        onPress={() =>
          becomeArtist.mutate(
            { name: name.trim(), bio: bio.trim() || null },
            {
              onSuccess: () => {
                void refresh();
                setOpen(false);
              },
            },
          )
        }
      />
      <Button label="Cancel" variant="ghost" onPress={() => setOpen(false)} />
    </View>
  );
}
