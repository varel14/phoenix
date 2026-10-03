import { useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, Switch, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { radii, spacing } from "@/theme";
import { useTheme, useThemeModeStore, type ThemeMode } from "@/theme/theme-provider";
import { useAuthStore } from "@/stores/auth-store";
import { usePreferencesStore, type AudioQuality } from "@/stores/preferences-store";
import { useFollowing, useMyArtist, useArtistStats } from "@/hooks/use-library";
import { useQuery } from "@tanstack/react-query";
import { subscriptionsApi } from "@/services/api/subscriptions-api";
import { queryKeys } from "@/constants/query-keys";
import { AppText, LoadingView } from "@/components/ui";
import { Artwork } from "@/components/media/artwork";
import { BecomeArtistModal } from "@/components/profile/become-artist-modal";
import { formatCount } from "@/utils/format";
import { formatMoney } from "@/utils/money";
import type { ArtistStats } from "@/types/api";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

const THEME_OPTIONS: Array<{ value: ThemeMode; label: string; icon: IconName }> = [
  { value: "system", label: "Système", icon: "phone-portrait-outline" },
  { value: "dark", label: "Sombre", icon: "moon-outline" },
  { value: "light", label: "Clair", icon: "sunny-outline" },
];

const QUALITY_OPTIONS: Array<{ value: AudioQuality; label: string }> = [
  { value: "AUTO", label: "Automatique" },
  { value: "HIGH", label: "Haute qualité" },
  { value: "DATA_SAVER", label: "Économie" },
];

export default function ProfileScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const isSigningOut = useAuthStore((state) => state.isSigningOut);
  const myArtist = useMyArtist();
  const stats = useArtistStats(myArtist.data?.id);
  const following = useFollowing();
  const subscriptionQuery = useQuery({
    queryKey: queryKeys.subscription(),
    queryFn: () => subscriptionsApi.getStatus(),
    retry: false,
  });
  const subscriptionActive = subscriptionQuery.data?.subscription?.status === "ACTIVE";
  const audioQuality = usePreferencesStore((state) => state.audioQuality);
  const setAudioQuality = usePreferencesStore((state) => state.setAudioQuality);
  const wifiOnlyDownloads = usePreferencesStore((state) => state.wifiOnlyDownloads);
  const setWifiOnlyDownloads = usePreferencesStore((state) => state.setWifiOnlyDownloads);
  const pushNotifications = usePreferencesStore((state) => state.pushNotifications);
  const setPushNotifications = usePreferencesStore((state) => state.setPushNotifications);
  const [creatorModalOpen, setCreatorModalOpen] = useState(false);

  if (!user) return null;

  const isArtist = user.role === "ARTIST";
  const qualityLabel = QUALITY_OPTIONS.find((option) => option.value === audioQuality)?.label ?? "Automatique";

  function cycleAudioQuality() {
    const index = QUALITY_OPTIONS.findIndex((option) => option.value === audioQuality);
    setAudioQuality(QUALITY_OPTIONS[(index + 1) % QUALITY_OPTIONS.length].value);
  }

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 180, gap: spacing.xl }}>
      {/* Identity header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.lg }}>
        <Artwork uri={user.image} seed={user.id} label={user.name} size={72} radius={36} />
        <View style={{ flex: 1, gap: 6 }}>
          <AppText variant="heading">{user.name}</AppText>
          <AppText variant="bodyMuted">{user.email}</AppText>
          <View
            style={{
              alignSelf: "flex-start",
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              backgroundColor: isArtist ? colors.primaryTint : colors.surfaceHighlight,
              borderRadius: radii.full,
              paddingHorizontal: spacing.sm,
              paddingVertical: 3,
            }}
          >
            <Ionicons name={isArtist ? "mic" : "headset-outline"} size={11} color={isArtist ? colors.primary : colors.textFaint} />
            <AppText
              variant="small"
              style={{ color: isArtist ? colors.primary : colors.textFaint, letterSpacing: 1 }}
            >
              {isArtist ? "COMPTE CRÉATEUR" : "AUDITEUR"}
            </AppText>
          </View>
        </View>
      </View>

      {/* Premium entry */}
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
              Premium
            </AppText>
            <AppText variant="caption">
              {subscriptionActive
                ? "Abonnement actif — musiques téléchargées hors connexion"
                : `Abonnement — ${formatMoney(
                    subscriptionQuery.data?.pricing.monthlyPrice ?? 2500,
                    subscriptionQuery.data?.pricing.currency,
                  )}/mois, téléchargements hors connexion`}
            </AppText>
          </View>
          {subscriptionActive ? (
            <View
              style={{
                backgroundColor: colors.gold,
                borderRadius: radii.full,
                paddingHorizontal: spacing.sm,
                paddingVertical: 3,
              }}
            >
              <AppText style={{ color: "#201500", fontSize: 10, fontWeight: "800" }}>ACTIF</AppText>
            </View>
          ) : (
            <Ionicons name="chevron-forward" size={18} color={colors.gold} />
          )}
        </View>
      </Pressable>

      {/* Preferences */}
      <SectionCard title="Préférences">
        <AppText variant="caption" style={{ marginBottom: spacing.sm }}>
          APPARENCE
        </AppText>
        <AppearanceSegmented />
        <Divider />

        <SettingsRow
          icon="musical-notes-outline"
          label="Qualité audio"
          sublabel="Streaming et lecture"
          onPress={cycleAudioQuality}
          right={<RowValue>{qualityLabel}</RowValue>}
        />
        <Divider />

        <SettingsRow
          icon="cloud-download-outline"
          label="Télécharger en Wi-Fi uniquement"
          right={
            <Switch
              value={wifiOnlyDownloads}
              onValueChange={setWifiOnlyDownloads}
              trackColor={{ false: colors.surfaceHighlight, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          }
        />
        <Divider />

        <SettingsRow
          icon="notifications-outline"
          label="Notifications"
          sublabel="Nouveautés de vos artistes"
          right={
            <Switch
              value={pushNotifications}
              onValueChange={setPushNotifications}
              trackColor={{ false: colors.surfaceHighlight, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          }
        />
      </SectionCard>

      {/* Creator space — subtle row that opens the full-screen onboarding */}
      <SectionCard title="Créateur">
        {isArtist ? (
          <>
            <SettingsRow
              icon="rocket-outline"
              label="Ouvrir le Studio Créateur"
              onPress={() => router.push("/studio")}
              right={<RowValue chevron />}
            />
            {myArtist.data ? (
              <>
                <Divider />
                <SettingsRow
                  icon="pencil-outline"
                  label="Modifier le profil artiste"
                  onPress={() =>
                    router.push({
                      pathname: "/studio/edit-profile",
                      params: { name: myArtist.data!.name, bio: myArtist.data!.bio ?? "" },
                    })
                  }
                  right={<RowValue chevron />}
                />
              </>
            ) : null}
            {myArtist.data && stats?.data ? <ArtistAnalyticsPreview stats={stats.data} /> : null}
          </>
        ) : (
          <SettingsRow
            icon="mic-outline"
            label="Devenir créateur"
            sublabel="Publiez vos titres et touchez vos fans"
            onPress={() => setCreatorModalOpen(true)}
            right={<RowValue chevron />}
          />
        )}
      </SectionCard>

      {/* Following */}
      <View style={{ gap: spacing.sm }}>
        <AppText variant="heading">Artistes suivis</AppText>
        {following.isLoading ? (
          <LoadingView />
        ) : (following.data?.data ?? []).length === 0 ? (
          <AppText variant="bodyMuted">Vous ne suivez aucun artiste pour le moment.</AppText>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {(following.data?.data ?? []).map((follow) => (
              <Pressable
                key={follow.id}
                accessibilityRole="button"
                onPress={() => router.push(`/artist/${follow.artist.id}`)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                  backgroundColor: colors.surface,
                  borderRadius: radii.lg,
                  padding: spacing.md,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Artwork uri={follow.artist.avatarUrl} seed={follow.artist.id} label={follow.artist.name} size={44} radius={22} />
                <AppText variant="subheading">{follow.artist.name}</AppText>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* Account */}
      <SectionCard>
        <SettingsRow
          icon="log-out-outline"
          label={isSigningOut ? "Déconnexion…" : "Se déconnecter"}
          destructive
          onPress={() => void signOut()}
          right={isSigningOut ? <ActivityIndicator color={colors.danger} /> : undefined}
        />
      </SectionCard>

      <View style={{ alignItems: "center", gap: spacing.xs, paddingTop: spacing.sm }}>
        <AppText variant="small" style={{ letterSpacing: 2 }}>
          CHUYASSI EMMANUEL CE
        </AppText>
        <View style={{ width: 40, height: 4, borderRadius: radii.full, backgroundColor: colors.accent }} />
        <AppText variant="small">Version {Constants.expoConfig?.version ?? "1.0.0"}</AppText>
      </View>

      <BecomeArtistModal visible={creatorModalOpen} onClose={() => setCreatorModalOpen(false)} />
    </ScrollView>
  );
}

/** Compact analytics strip for the signed-in artist, right on their profile. */
function ArtistAnalyticsPreview({ stats }: { stats: ArtistStats }) {
  const { colors } = useTheme();
  const router = useRouter();
  const items = [
    { label: "Écoutes", value: stats.plays },
    { label: "Abonnés", value: stats.subscribers },
    { label: "Téléch.", value: stats.downloads },
    { label: "Titres", value: stats.songs },
  ];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push("/studio")}
      style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1, marginTop: spacing.sm })}
    >
      <View
        style={{
          flexDirection: "row",
          backgroundColor: colors.primaryTint,
          borderRadius: radii.md,
          padding: spacing.md,
          gap: spacing.sm,
        }}
      >
        {items.map((item) => (
          <View key={item.label} style={{ flex: 1, alignItems: "center", gap: 2 }}>
            <AppText variant="subheading" color={colors.primary}>
              {formatCount(item.value)}
            </AppText>
            <AppText variant="caption">{item.label}</AppText>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

function AppearanceSegmented() {  const mode = useThemeModeStore((state) => state.mode);
  const setMode = useThemeModeStore((state) => state.setMode);
  const { colors } = useTheme();

  return (
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
  );
}

function SectionCard({ title, children }: { title?: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.xs }}>
      {title ? <AppText variant="subheading">{title}</AppText> : null}
      {children}
    </View>
  );
}

function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.xs }} />;
}

interface SettingsRowProps {
  icon: IconName;
  label: string;
  sublabel?: string;
  destructive?: boolean;
  onPress?: () => void;
  right?: ReactNode;
}

function SettingsRow({ icon, label, sublabel, destructive, onPress, right }: SettingsRowProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : "none"}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingVertical: spacing.sm,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: radii.md,
          backgroundColor: destructive ? "transparent" : colors.primaryTint,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={17} color={destructive ? colors.danger : colors.primary} />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <AppText style={{ color: destructive ? colors.danger : colors.text, fontSize: 15, fontWeight: "500" }}>
          {label}
        </AppText>
        {sublabel ? <AppText variant="caption">{sublabel}</AppText> : null}
      </View>
      {right}
    </Pressable>
  );
}

/** Trailing text + optional chevron used on navigable / value rows. */
function RowValue({ children, chevron }: { children?: string; chevron?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      {children ? (
        <AppText variant="caption" color={colors.textMuted}>
          {children}
        </AppText>
      ) : null}
      {chevron ? <Ionicons name="chevron-forward" size={16} color={colors.textFaint} /> : null}
    </View>
  );
}
