import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { storage as AsyncStorage } from "@/services/storage/mmkv";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  useWallet,
  useWalletRecipients,
  useWalletTransactions,
} from "@/hooks/use-wallet";
import {
  AppText,
  EmptyView,
  ErrorView,
  IconButton,
  PressableScale,
} from "@/components/ui";
import {
  monthInOut,
  WalletTransactionRow,
} from "@/components/wallet-transaction-row";
import { UserAvatar } from "@/components/chat/user-avatar";
import {
  FadeIn,
  GlassButton,
  PayBackdrop,
  QuickAction,
  QuickRecipient,
  SectionHeader,
} from "@/components/wallet-ui";
import { radii, spacing, withAlpha } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import { formatAmount } from "@/utils/money";
import { useAuthStore } from "@/stores/auth-store";

const BALANCE_HIDDEN_KEY = "phoenix/wallet-balance-hidden";

export default function WalletHomeScreen() {
  const { colors, gradients, glows } = useTheme();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const walletQuery = useWallet();
  const recentQuery = useWalletTransactions();
  const recipientsQuery = useWalletRecipients("");

  const wallet = walletQuery.data;
  const recent = (recentQuery.data?.data ?? []).slice(0, 4);
  const quickContacts = (recipientsQuery.data ?? []).slice(0, 8);
  const totals = monthInOut(recentQuery.data?.data ?? []);
  const firstName = user?.name.split(/\s+/)[0];

  // Hidden balances persist across visits, like a real banking app.
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    void AsyncStorage.getItem(BALANCE_HIDDEN_KEY).then((value) => {
      if (value === "1") setHidden(true);
    });
  }, []);
  const toggleHidden = () => {
    setHidden((previous) => {
      const next = !previous;
      void AsyncStorage.setItem(BALANCE_HIDDEN_KEY, next ? "1" : "0");
      return next;
    });
  };

  const openSend = (contact?: {
    id: string;
    name: string;
    image: string | null;
  }) => {
    if (contact) {
      router.push({
        pathname: "/pay/send",
        params: {
          recipientId: contact.id,
          recipientName: contact.name,
          recipientImage: contact.image ?? "",
        },
      });
    } else {
      router.push("/pay/send");
    }
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: insets.top,
      }}
    >
      <PayBackdrop />
      {/* Header — reference greeting: close, avatar, name, product line */}
      <FadeIn
        style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.sm }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
          }}
        >
          <IconButton
            icon="close"
            onPress={() => router.back()}
            accessibilityLabel="Fermer"
            tinted
          />
          {user ? (
            <UserAvatar
              user={{ id: user.id, name: user.name, image: user.image ?? null }}
              size={40}
            />
          ) : null}
          <View style={{ flex: 1, gap: 1 }}>
            <AppText
              style={{ fontSize: 17, fontWeight: "700" }}
              numberOfLines={1}
            >
              Bonjour{firstName ? `, ${firstName}` : ""}
            </AppText>
            <AppText variant="small" color={colors.textFaint}>
              Chuyassi Pay
            </AppText>
          </View>
        </View>
      </FadeIn>

      {walletQuery.isError ? (
        <ErrorView
          message={(walletQuery.error as Error)?.message}
          onRetry={() => void walletQuery.refetch()}
        />
      ) : walletQuery.isLoading || !wallet ? (
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator color={colors.accent} size="large" />
          <AppText variant="bodyMuted" style={{ marginTop: spacing.md }}>
            Ouverture du portefeuille…
          </AppText>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: spacing.lg,
            gap: spacing.xl,
            paddingBottom: 64,
          }}
        >
          {/* Balance hero card */}
          <FadeIn delay={60}>
            <LinearGradient
              colors={gradients.brand}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                {
                  borderRadius: 28,
                  padding: spacing.xl,
                  gap: spacing.lg,
                  overflow: "hidden",
                },
                { boxShadow: glows.brand },
              ]}
            >
              <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                <View
                  style={{
                    position: "absolute",
                    top: -64,
                    right: -44,
                    width: 190,
                    height: 190,
                    borderRadius: radii.full,
                    backgroundColor: withAlpha(colors.onPrimary, 0.1),
                  }}
                />
                <View
                  style={{
                    position: "absolute",
                    top: 36,
                    right: 68,
                    width: 84,
                    height: 84,
                    borderRadius: radii.full,
                    backgroundColor: withAlpha(colors.onPrimary, 0.08),
                  }}
                />
                <View
                  style={{
                    position: "absolute",
                    bottom: -72,
                    left: -32,
                    width: 170,
                    height: 170,
                    borderRadius: radii.full,
                    backgroundColor: "rgba(0, 0, 0, 0.10)",
                  }}
                />
              </View>

              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.sm,
                  }}
                >
                  <View
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 10,
                      backgroundColor: withAlpha(colors.onPrimary, 0.18),
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name="flash" size={16} color={colors.onPrimary} />
                  </View>
                  <AppText
                    variant="small"
                    color={withAlpha(colors.onPrimary, 0.72)}
                    style={{ letterSpacing: 1.6 }}
                  >
                    CHUYASSI PAY
                  </AppText>
                </View>
                <IconButton
                  icon={hidden ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={withAlpha(colors.onPrimary, 0.8)}
                  onPress={toggleHidden}
                  accessibilityLabel={
                    hidden ? "Afficher le solde" : "Masquer le solde"
                  }
                />
              </View>

              <View style={{ gap: spacing.xs }}>
                <AppText
                  variant="small"
                  color={withAlpha(colors.onPrimary, 0.68)}
                  style={{ letterSpacing: 1.2 }}
                >
                  SOLDE DISPONIBLE
                </AppText>
                {hidden ? (
                  <AppText
                    style={{
                      fontSize: 42,
                      fontWeight: "800",
                      letterSpacing: -1,
                      color: colors.onPrimary,
                      fontVariant: ["tabular-nums"],
                    }}
                    adjustsFontSizeToFit
                    numberOfLines={1}
                  >
                    ••••••
                  </AppText>
                ) : (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-end",
                      gap: 7,
                    }}
                  >
                    <AppText
                      style={{
                        fontSize: 42,
                        fontWeight: "800",
                        letterSpacing: -1,
                        color: colors.onPrimary,
                        fontVariant: ["tabular-nums"],
                        lineHeight: 46,
                      }}
                      adjustsFontSizeToFit
                      numberOfLines={1}
                    >
                      {formatAmount(wallet.balance)}
                    </AppText>
                    <AppText
                      style={{
                        fontSize: 15,
                        fontWeight: "700",
                        color: withAlpha(colors.onPrimary, 0.6),
                        paddingBottom: 6,
                      }}
                    >
                      {wallet.currency === "XOF" ? "FCFA" : wallet.currency}
                    </AppText>
                  </View>
                )}
              </View>

              <View
                style={{
                  flexDirection: "row",
                  gap: spacing.md,
                  marginTop: spacing.xs,
                }}
              >
                <GlassButton
                  icon="add"
                  label="Recharger"
                  onPress={() => router.push("/pay/topup")}
                />
                <GlassButton
                  icon="paper-plane-outline"
                  label="Envoyer"
                  onPress={() => openSend()}
                />
              </View>
            </LinearGradient>
          </FadeIn>

          {/* Quick actions */}
          <FadeIn delay={120}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                paddingHorizontal: spacing.xs,
              }}
            >
              <QuickAction
                icon="add-circle-outline"
                label="Recharger"
                highlighted
                onPress={() => router.push("/pay/topup")}
              />
              <QuickAction
                icon="paper-plane-outline"
                label="Envoyer"
                onPress={() => openSend()}
              />
              <QuickAction
                icon="time-outline"
                label="Activité"
                onPress={() => router.push("/pay/transactions")}
              />
              <QuickAction
                icon="cart-outline"
                label="Panier"
                onPress={() => router.push("/boutique/cart")}
              />
            </View>
          </FadeIn>

          {/* Overview — this month's in/out, the reference's Income/Expenses cards */}
          {recent.length > 0 ? (
            <FadeIn delay={150}>
              <View>
                <SectionHeader title="Aperçu" />
                <View style={{ flexDirection: "row", gap: spacing.md }}>
                  <StatCard
                    icon="arrow-down-outline"
                    label="Entrées · ce mois"
                    amount={`+${formatAmount(totals.in)} FCFA`}
                    tint={colors.success}
                  />
                  <StatCard
                    icon="arrow-up-outline"
                    label="Sorties · ce mois"
                    amount={`−${formatAmount(totals.out)} FCFA`}
                    tint={colors.danger}
                  />
                </View>
              </View>
            </FadeIn>
          ) : null}

          {/* Quick send contacts */}
          {quickContacts.length > 0 ? (
            <FadeIn delay={180}>
              <View>
                <SectionHeader
                  title="Envoi rapide"
                  actionLabel="Tout voir"
                  onAction={() => openSend()}
                />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{
                    gap: spacing.md,
                    paddingRight: spacing.lg,
                  }}
                >
                  <PressableScale
                    onPress={() => openSend()}
                    scaleTo={0.96}
                    accessibilityLabel="Nouvel envoi"
                    style={{ width: 60, alignItems: "center", gap: spacing.xs }}
                  >
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: radii.full,
                        borderWidth: 1.5,
                        borderStyle: "dashed",
                        borderColor: colors.textFaint,
                        backgroundColor: colors.surface,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons name="add" size={18} color={colors.textMuted} />
                    </View>
                    <AppText variant="caption" color={colors.textMuted}>
                      Nouveau
                    </AppText>
                  </PressableScale>
                  {quickContacts.map((contact) => (
                    <QuickRecipient
                      key={contact.id}
                      id={contact.id}
                      name={contact.name}
                      image={contact.image}
                      onPress={() => openSend(contact)}
                    />
                  ))}
                </ScrollView>
              </View>
            </FadeIn>
          ) : null}

          {/* Recent activity */}
          <FadeIn delay={240}>
            <View>
              <SectionHeader
                title="Activité récente"
                actionLabel="Tout voir"
                onAction={() => router.push("/pay/transactions")}
              />
              {recentQuery.isLoading ? (
                <View
                  style={{
                    height: 96,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ActivityIndicator color={colors.accent} />
                </View>
              ) : recentQuery.isError ? (
                <ErrorView
                  message={(recentQuery.error as Error)?.message}
                  onRetry={() => void recentQuery.refetch()}
                />
              ) : recent.length === 0 ? (
                <EmptyView
                  title="Aucune activité"
                  subtitle="Rechargez votre portefeuille ou envoyez de l'argent à un proche."
                />
              ) : (
                <View style={{ gap: spacing.sm }}>
                  {recent.map((transaction) => (
                    <WalletTransactionRow
                      key={transaction.id}
                      transaction={transaction}
                      onPress={() =>
                        router.push(`/pay/transactions/${transaction.id}`)
                      }
                    />
                  ))}
                </View>
              )}
            </View>
          </FadeIn>
        </ScrollView>
      )}
    </View>
  );
}

/** Reference-style overview card: tinted icon tile, label, colored amount. */
function StatCard({
  icon,
  label,
  amount,
  tint,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  amount: string;
  tint: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        backgroundColor: colors.surface,
        borderRadius: 20,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.hairline,
        padding: spacing.md,
      }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: radii.md,
          backgroundColor: withAlpha(tint, 0.14),
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={17} color={tint} />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <AppText variant="small" color={colors.textFaint} numberOfLines={1}>
          {label}
        </AppText>
        <AppText
          style={{
            fontSize: 15,
            fontWeight: "800",
            color: tint,
            fontVariant: ["tabular-nums"],
          }}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {amount}
        </AppText>
      </View>
    </View>
  );
}
