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
import { WalletTransactionRow } from "@/components/wallet-transaction-row";
import {
  FadeIn,
  GlassButton,
  QuickAction,
  QuickRecipient,
  SectionHeader,
} from "@/components/wallet-ui";
import { radii, spacing, withAlpha } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import { formatMoney } from "@/utils/money";

const BALANCE_HIDDEN_KEY = "phoenix/wallet-balance-hidden";

export default function WalletHomeScreen() {
  const { colors, gradients, glows } = useTheme();
  const insets = useSafeAreaInsets();
  const walletQuery = useWallet();
  const recentQuery = useWalletTransactions();
  const recipientsQuery = useWalletRecipients("");

  const wallet = walletQuery.data;
  const recent = (recentQuery.data?.data ?? []).slice(0, 4);
  const quickContacts = (recipientsQuery.data ?? []).slice(0, 8);

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
      {/* Header */}
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
            icon="chevron-back"
            onPress={() => router.back()}
            accessibilityLabel="Retour"
            tinted
          />
          <View style={{ flex: 1 }}>
            <AppText
              variant="small"
              color={colors.textFaint}
              style={{ letterSpacing: 2 }}
            >
              CHUYASSI EMMANUEL PAY
            </AppText>
            <AppText variant="title">Portefeuille</AppText>
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
                <AppText
                  style={{
                    fontSize: 36,
                    fontWeight: "800",
                    letterSpacing: -0.8,
                    color: colors.onPrimary,
                    fontVariant: ["tabular-nums"],
                  }}
                  adjustsFontSizeToFit
                  numberOfLines={1}
                >
                  {hidden
                    ? "••••••"
                    : formatMoney(wallet.balance, wallet.currency)}
                </AppText>
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
                    style={{ width: 68, alignItems: "center", gap: spacing.xs }}
                  >
                    <View
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: radii.full,
                        borderWidth: 1.5,
                        borderStyle: "dashed",
                        borderColor: colors.textFaint,
                        backgroundColor: colors.surface,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons name="add" size={22} color={colors.textMuted} />
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
