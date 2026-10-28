import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Alert, Animated, Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { radii, spacing, withAlpha } from "@/theme";
import { useTheme, useThemeModeStore, type ThemeMode } from "@/theme/theme-provider";
import { useAuthStore } from "@/stores/auth-store";
import { usePreferencesStore, type AudioQuality } from "@/stores/preferences-store";
import { useDownloadsStore } from "@/services/downloads/download-manager";
import { useFavorites, useFollowing, useMyArtist, useArtistStats } from "@/hooks/use-library";
import { useCart, useOrders } from "@/hooks/use-market";
import { usePaymentMethods, useWallet } from "@/hooks/use-wallet";
import { useQuery } from "@tanstack/react-query";
import { subscriptionsApi } from "@/services/api/subscriptions-api";
import { queryKeys } from "@/constants/query-keys";
import { AppText, Card, PressableScale } from "@/components/ui";
import { Artwork } from "@/components/media/artwork";
import { BecomeArtistModal } from "@/components/profile/become-artist-modal";
import { EditProfileModal } from "@/components/profile/edit-profile-modal";
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
  const { colors, gradients } = useTheme();
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
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Listener stats + wallet/shopping shortcuts (all real data, lazy queries).
  const walletQuery = useWallet();
  const paymentMethodsQuery = usePaymentMethods();
  const cartQuery = useCart();
  const ordersQuery = useOrders();
  const favoritesQuery = useFavorites();
  const downloadItems = useDownloadsStore((state) => state.items);

  const memberSince = useMemo(() => {
    if (!user?.createdAt) return null;
    return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(
      new Date(user.createdAt),
    );
  }, [user?.createdAt]);

  function confirmSignOut() {
    Alert.alert(
      "Se déconnecter ?",
      "Vous devrez vous reconnecter pour accéder à votre compte.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Se déconnecter",
          style: "destructive",
          onPress: () => void signOut(),
        },
      ],
    );
  }

  if (!user) return null;

  const isArtist = user.role === "ARTIST";
  const qualityLabel = QUALITY_OPTIONS.find((option) => option.value === audioQuality)?.label ?? "Automatique";

  function cycleAudioQuality() {
    const index = QUALITY_OPTIONS.findIndex((option) => option.value === audioQuality);
    setAudioQuality(QUALITY_OPTIONS[(index + 1) % QUALITY_OPTIONS.length].value);
  }

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 180, gap: spacing.xl }}>
      {/* Centered identity header — avatar on a brand ring, name, edit pill */}
      <View style={{ alignItems: "center", paddingTop: spacing.md }}>
        <PressableScale
          onPress={() => setEditModalOpen(true)}
          scaleTo={0.96}
          accessibilityLabel="Modifier mon profil"
        >
          <View>
            {/* Brand-gradient ring around the avatar */}
            <LinearGradient
              colors={gradients.brand}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ width: 126, height: 126, borderRadius: radii.full, padding: 3 }}
            >
              <View
                style={{
                  flex: 1,
                  borderRadius: radii.full,
                  backgroundColor: colors.background,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Artwork uri={user.image} seed={user.id} label={user.name} size={114} radius={radii.full} />
              </View>
            </LinearGradient>

            {/* Account-type badge straddling the ring's bottom edge */}
            <View
              pointerEvents="none"
              style={{ position: "absolute", bottom: -6, left: 0, right: 0, alignItems: "center" }}
            >
              {isArtist ? (
                <LinearGradient
                  colors={gradients.brand}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    borderRadius: radii.full,
                    borderWidth: 2,
                    borderColor: colors.background,
                    paddingHorizontal: spacing.sm + 2,
                    paddingVertical: 3,
                  }}
                >
                  <Ionicons name="mic" size={10} color={colors.onPrimary} />
                  <AppText style={{ color: colors.onPrimary, fontSize: 9, fontWeight: "800", letterSpacing: 1 }}>
                    CRÉATEUR
                  </AppText>
                </LinearGradient>
              ) : (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    borderRadius: radii.full,
                    borderWidth: 2,
                    borderColor: colors.background,
                    backgroundColor: "rgba(10, 10, 10, 0.78)",
                    paddingHorizontal: spacing.sm + 2,
                    paddingVertical: 3,
                  }}
                >
                  <Ionicons name="headset-outline" size={10} color={colors.onPrimary} />
                  <AppText style={{ color: colors.onPrimary, fontSize: 9, fontWeight: "800", letterSpacing: 1 }}>
                    AUDITEUR
                  </AppText>
                </View>
              )}
            </View>

            {/* Camera badge — the avatar is a shortcut into the editor */}
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                right: 4,
                bottom: 10,
                width: 30,
                height: 30,
                borderRadius: radii.full,
                borderWidth: 3,
                borderColor: colors.background,
                backgroundColor: colors.primary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="camera" size={13} color={colors.onPrimary} />
            </View>
          </View>
        </PressableScale>

        <View style={{ alignItems: "center", gap: 4, marginTop: spacing.lg }}>
          <AppText variant="title">{user.name}</AppText>
          <AppText variant="caption" color={colors.textMuted} numberOfLines={1}>
            {user.email}
          </AppText>
          {memberSince ? (
            <AppText variant="small" color={colors.textFaint}>
              Membre depuis {memberSince}
            </AppText>
          ) : null}
        </View>

        <PressableScale
          onPress={() => setEditModalOpen(true)}
          scaleTo={0.96}
          accessibilityLabel="Modifier mon profil"
          style={{ marginTop: spacing.lg }}
        >
          <View
            style={{
              height: 38,
              paddingHorizontal: spacing.xl,
              borderRadius: radii.full,
              borderWidth: 1,
              borderColor: withAlpha(colors.primary, 0.45),
              backgroundColor: colors.primaryTint,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: spacing.sm,
            }}
          >
            <Ionicons name="pencil" size={14} color={colors.primary} />
            <AppText style={{ color: colors.primary, fontSize: 13, fontWeight: "700" }}>
              Modifier le profil
            </AppText>
          </View>
        </PressableScale>
      </View>

      {/* Listener stats — live counts from the library */}
      <Card style={{ flexDirection: "row", paddingVertical: spacing.lg }}>
        <StatsTile
          value={following.data?.pagination.total ?? (following.data?.data.length ?? 0)}
          label="Suivis"
          onPress={() => router.push("/explore")}
        />
        <View style={{ width: StyleSheet.hairlineWidth, backgroundColor: colors.hairline }} />
        <StatsTile
          value={favoritesQuery.data?.pagination.total ?? (favoritesQuery.data?.data.length ?? 0)}
          label="Favoris"
          onPress={() => router.push("/library")}
        />
        <View style={{ width: StyleSheet.hairlineWidth, backgroundColor: colors.hairline }} />
        <StatsTile
          value={Object.keys(downloadItems).length}
          label="Téléch."
          onPress={() => router.push("/library")}
        />
      </Card>

      {/* Premium entry */}
      <PressableScale
        accessibilityRole="button"
        onPress={() => router.push("/premium")}
        scaleTo={0.98}
        style={{
          borderRadius: radii.xl,
          borderWidth: 1,
          borderColor: withAlpha(colors.gold, 0.45),
          backgroundColor: colors.surface,
          padding: spacing.lg,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          boxShadow: `0 8px 24px ${withAlpha(colors.gold, 0.12)}`,
        }}
      >
        <LinearGradient
          colors={gradients.premium}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: 44, height: 44, borderRadius: radii.md + 4, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="star" size={20} color="#FFFFFF" />
        </LinearGradient>
        <View style={{ flex: 1, gap: 1 }}>
          <AppText variant="subheading" color={colors.gold}>
            Premium
          </AppText>
          <AppText variant="caption" numberOfLines={2}>
            {subscriptionActive
              ? "Abonnement actif — musiques téléchargées hors connexion"
              : `Dès ${formatMoney(
                  subscriptionQuery.data?.pricing.monthlyPrice ?? 2500,
                  subscriptionQuery.data?.pricing.currency,
                )}/mois — téléchargements hors connexion`}
          </AppText>
        </View>
        {subscriptionActive ? (
          <LinearGradient
            colors={gradients.premium}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ borderRadius: radii.full, paddingHorizontal: spacing.sm + 2, paddingVertical: 4 }}
          >
            <AppText style={{ color: "#201500", fontSize: 10, fontWeight: "800", letterSpacing: 1 }}>ACTIF</AppText>
          </LinearGradient>
        ) : (
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: radii.full,
              backgroundColor: withAlpha(colors.gold, 0.14),
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="chevron-forward" size={16} color={colors.gold} />
          </View>
        )}
      </PressableScale>

      {/* Wallet & shopping */}
      <Section label="Portefeuille & achats">
        <SettingsRow
          icon="wallet-outline"
          label="Chuyassi Pay"
          sublabel="Transferts et rechargements"
          onPress={() => router.push("/pay")}
          right={<RowValue chevron>{walletQuery.data ? formatMoney(walletQuery.data.balance, walletQuery.data.currency) : undefined}</RowValue>}
        />
        <RowDivider />
        <SettingsRow
          icon="card-outline"
          label="Moyens de paiement"
          sublabel="Numéros Orange Money & MTN"
          onPress={() => router.push("/pay/methods")}
          right={<RowValue chevron>{paymentMethodsQuery.data ? `${paymentMethodsQuery.data.length}` : undefined}</RowValue>}
        />
        <RowDivider />
        <SettingsRow
          icon="cart-outline"
          label="Mon panier"
          onPress={() => router.push("/boutique/cart")}
          right={<RowValue chevron>{cartQuery.data?.itemCount ? `${cartQuery.data.itemCount}` : "Vide"}</RowValue>}
        />
        <RowDivider />
        <SettingsRow
          icon="bag-handle-outline"
          label="Mes commandes"
          onPress={() => router.push("/boutique/orders")}
          right={<RowValue chevron>{String(ordersQuery.data?.pagination.total ?? 0)}</RowValue>}
        />
      </Section>

      {/* Preferences */}
      <Section label="Apparence & lecture">
        <AppearanceSegmented />
        <RowDivider />
        <SettingsRow
          icon="musical-notes-outline"
          label="Qualité audio"
          sublabel="Streaming et lecture"
          onPress={cycleAudioQuality}
          right={<RowValue>{qualityLabel}</RowValue>}
        />
        <RowDivider />
        <SettingsRow
          icon="cloud-download-outline"
          label="Télécharger en Wi-Fi uniquement"
          onPress={() => setWifiOnlyDownloads(!wifiOnlyDownloads)}
          right={
            <Switch
              value={wifiOnlyDownloads}
              onValueChange={setWifiOnlyDownloads}
              trackColor={{ false: colors.surfaceHighlight, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          }
        />
        <RowDivider />
        <SettingsRow
          icon="notifications-outline"
          label="Notifications"
          sublabel="Nouveautés de vos artistes"
          onPress={() => setPushNotifications(!pushNotifications)}
          right={
            <Switch
              value={pushNotifications}
              onValueChange={setPushNotifications}
              trackColor={{ false: colors.surfaceHighlight, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          }
        />
      </Section>

      {/* Creator space */}
      <Section label="Créateur">
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
                <RowDivider />
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
      </Section>

      {/* Following */}
      <Section label="Artistes suivis">
        {following.isLoading ? (
          <ActivityIndicator color={colors.accent} style={{ paddingVertical: spacing.md }} />
        ) : (following.data?.data ?? []).length === 0 ? (
          <AppText variant="bodyMuted">Vous ne suivez aucun artiste pour le moment.</AppText>
        ) : (
          (following.data?.data ?? []).map((follow, index) => (
            <View key={follow.id}>
              <SettingsRow
                avatar={<Artwork uri={follow.artist.avatarUrl} seed={follow.artist.id} label={follow.artist.name} size={40} radius={radii.full} />}
                label={follow.artist.name}
                onPress={() => router.push(`/artist/${follow.artist.id}`)}
                right={<RowValue chevron />}
              />
              {index < (following.data?.data.length ?? 0) - 1 ? <RowDivider /> : null}
            </View>
          ))
        )}
      </Section>

      {/* Account */}
      <Section>
        <SettingsRow
          icon="log-out-outline"
          label={isSigningOut ? "Déconnexion…" : "Se déconnecter"}
          destructive
          onPress={confirmSignOut}
          right={isSigningOut ? <ActivityIndicator color={colors.danger} /> : undefined}
        />
      </Section>

      <View style={{ alignItems: "center", gap: spacing.sm, paddingTop: spacing.sm }}>
        <LinearGradient
          colors={gradients.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="headset" size={20} color={colors.onPrimary} />
        </LinearGradient>
        <AppText variant="small" style={{ letterSpacing: 2, color: colors.textFaint }}>
          CHUYASSI EMMANUEL CE
        </AppText>
        <AppText variant="small" style={{ color: colors.textFaint }}>
          Version {Constants.expoConfig?.version ?? "1.0.0"}
        </AppText>
      </View>

      <BecomeArtistModal visible={creatorModalOpen} onClose={() => setCreatorModalOpen(false)} />
      <EditProfileModal visible={editModalOpen} onClose={() => setEditModalOpen(false)} />
    </ScrollView>
  );
}

/** One live count in the stats strip; taps land in the relevant tab. */
function StatsTile({ value, label, onPress }: { value: number; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${value} ${label}`}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: "center",
        gap: 3,
        paddingVertical: 2,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <AppText variant="subheading" color={colors.primary} style={{ fontVariant: ["tabular-nums"] }}>
        {formatCount(value)}
      </AppText>
      <AppText variant="caption" style={{ color: colors.textMuted, fontSize: 12 }}>
        {label}
      </AppText>
    </Pressable>
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
    <PressableScale
      accessibilityRole="button"
      onPress={() => router.push("/studio")}
      scaleTo={0.98}
      style={{
        flexDirection: "row",
        backgroundColor: colors.primaryTint,
        borderRadius: radii.md + 2,
        padding: spacing.md,
        gap: spacing.sm,
        marginTop: spacing.sm,
      }}
    >
      {items.map((item) => (
        <View key={item.label} style={{ flex: 1, alignItems: "center", gap: 3 }}>
          <AppText variant="subheading" color={colors.primary} style={{ fontVariant: ["tabular-nums"] }}>
            {formatCount(item.value)}
          </AppText>
          <AppText variant="caption" style={{ color: colors.textMuted, fontSize: 12 }}>
            {item.label}
          </AppText>
        </View>
      ))}
    </PressableScale>
  );
}

function AppearanceSegmented() {
  const mode = useThemeModeStore((state) => state.mode);
  const setMode = useThemeModeStore((state) => state.setMode);
  const { colors, radii, shadows } = useTheme();
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const activeIndex = THEME_OPTIONS.findIndex((option) => option.value === mode);
  const indicatorX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (containerWidth === 0) return;
    Animated.spring(indicatorX, {
      toValue: activeIndex * ((containerWidth - 8) / THEME_OPTIONS.length),
      speed: 32,
      bounciness: 4,
      useNativeDriver: true,
    }).start();
  }, [activeIndex, containerWidth, indicatorX]);

  const itemWidth = containerWidth > 0 ? (containerWidth - 8) / THEME_OPTIONS.length : 0;

  return (
    <View
      onLayout={(event) => {
        setContainerWidth(event.nativeEvent.layout.width);
        setContainerHeight(event.nativeEvent.layout.height);
      }}
      style={{
        flexDirection: "row",
        backgroundColor: colors.surfaceHighlight,
        borderRadius: radii.md + 4,
        padding: 4,
        marginBottom: spacing.xs,
      }}
    >
      {itemWidth > 0 && containerHeight > 0 ? (
        <Animated.View
          style={{
            position: "absolute",
            top: 4,
            left: 4,
            width: itemWidth,
            height: containerHeight - 8,
            borderRadius: radii.md,
            backgroundColor: colors.surfaceElevated,
            boxShadow: shadows.card,
            transform: [{ translateX: indicatorX }],
          }}
        />
      ) : null}
      {THEME_OPTIONS.map((option) => {
        const active = mode === option.value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            onPress={() => setMode(option.value)}
            style={({ pressed }) => ({
              flex: 1,
              alignItems: "center",
              gap: spacing.xs,
              paddingVertical: spacing.md,
              borderRadius: radii.md,
              opacity: pressed ? 0.7 : 1,
              zIndex: 1,
            })}
          >
            <Ionicons name={option.icon} size={20} color={active ? colors.primary : colors.textMuted} />
            <AppText variant="caption" color={active ? colors.primary : colors.textMuted} style={{ fontWeight: "600" }}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Small-caps label sitting above a grouped card. */
function Section({ label, children }: { label?: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: spacing.sm + 2 }}>
      {label ? (
        <AppText
          variant="small"
          style={{ color: colors.textFaint, letterSpacing: 1.4, marginLeft: 6, textTransform: "uppercase" }}
        >
          {label}
        </AppText>
      ) : null}
      <Card>{children}</Card>
    </View>
  );
}

/** Hairline separator, inset to align with row text past the icon tile. */
function RowDivider() {
  const { colors } = useTheme();
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: colors.hairline,
        marginLeft: 36 + spacing.md,
        marginVertical: 5,
      }}
    />
  );
}

interface SettingsRowProps {
  icon?: IconName;
  /** Custom leading element (e.g. an avatar) rendered instead of the icon tile. */
  avatar?: ReactNode;
  label: string;
  sublabel?: string;
  destructive?: boolean;
  onPress?: () => void;
  right?: ReactNode;
}

function SettingsRow({ icon, avatar, label, sublabel, destructive, onPress, right }: SettingsRowProps) {
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
        paddingVertical: spacing.sm + 2,
        paddingHorizontal: spacing.xs,
        marginHorizontal: -spacing.xs,
        borderRadius: radii.sm,
        backgroundColor: pressed && onPress ? colors.surfaceHighlight : "transparent",
      })}
    >
      {avatar ?? (
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: radii.full,
            backgroundColor: destructive ? withAlpha(colors.danger, 0.12) : colors.primaryTint,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name={icon ?? "ellipse-outline"} size={17} color={destructive ? colors.danger : colors.primary} />
        </View>
      )}
      <View style={{ flex: 1, gap: 1 }}>
        <AppText
          style={{
            color: destructive ? colors.danger : colors.text,
            fontSize: 15,
            fontWeight: "500",
            lineHeight: 20,
          }}
        >
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
