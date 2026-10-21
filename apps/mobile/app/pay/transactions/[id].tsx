import { ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useWalletTransaction } from "@/hooks/use-wallet";
import {
  AppText,
  ErrorView,
  IconButton,
  LoadingView,
} from "@/components/ui";
import { UserAvatar } from "@/components/chat/user-avatar";
import {
  isCredit,
  transactionIcon,
  transactionLabel,
} from "@/components/wallet-transaction-row";
import { FadeIn, StatusChip, SummaryRow } from "@/components/wallet-ui";
import { radii, spacing, withAlpha } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import { formatMoney } from "@/utils/money";
import { WALLET_TYPE_LABELS } from "@/types/wallet";

/** Full receipt for one wallet transaction (note, balance after, references). */
export default function WalletTransactionDetailScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string }>();
  const query = useWalletTransaction(params.id ?? "");
  const transaction = query.data;

  const credit = transaction ? isCredit(transaction) : false;
  const amountColor = credit ? colors.success : colors.text;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: insets.top,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: spacing.sm,
          paddingTop: spacing.xs,
          paddingBottom: spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <IconButton
          icon="chevron-back"
          onPress={() => router.back()}
          accessibilityLabel="Retour"
        />
        <AppText
          variant="heading"
          style={{ flex: 1, textAlign: "center", marginRight: 40 }}
        >
          Détail
        </AppText>
      </View>

      {query.isLoading ? (
        <LoadingView label="Chargement de l'opération…" />
      ) : query.isError || !transaction ? (
        <ErrorView
          message={(query.error as Error)?.message}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: spacing.lg,
            gap: spacing.xl,
            paddingBottom: 48,
          }}
        >
          <FadeIn>
            <View
              style={{
                alignItems: "center",
                gap: spacing.sm,
                paddingTop: spacing.md,
              }}
            >
              {transaction.counterparty ? (
                <UserAvatar user={transaction.counterparty} size={64} />
              ) : (
                <View
                  style={[
                    {
                      width: 64,
                      height: 64,
                      borderRadius: radii.full,
                      alignItems: "center",
                      justifyContent: "center",
                    },
                    {
                      backgroundColor: withAlpha(
                        credit ? colors.success : colors.primary,
                        0.14,
                      ),
                    },
                  ]}
                >
                  <Ionicons
                    name={transactionIcon(transaction.type)}
                    size={28}
                    color={credit ? colors.success : colors.primary}
                  />
                </View>
              )}
              <AppText variant="subheading" color={colors.textMuted}>
                {transactionLabel(
                  transaction.type,
                  transaction.counterparty?.name,
                )}
              </AppText>
              <AppText
                style={{
                  fontSize: 40,
                  fontWeight: "800",
                  letterSpacing: -1,
                  color: amountColor,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {credit ? "+" : "−"}
                {formatMoney(transaction.amount, transaction.currency)}
              </AppText>
              <StatusChip status={transaction.status} />
              <AppText variant="caption" color={colors.textFaint}>
                {new Date(transaction.createdAt).toLocaleString("fr-FR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </AppText>
            </View>
          </FadeIn>

          <FadeIn delay={80}>
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: radii.xl,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: colors.hairline,
                padding: spacing.lg,
                gap: spacing.md,
              }}
            >
              {transaction.note ? (
                <SummaryRow label="Note" value={transaction.note} />
              ) : null}
              {transaction.balanceAfter != null ? (
                <SummaryRow
                  label="Solde après opération"
                  value={formatMoney(
                    transaction.balanceAfter,
                    transaction.currency,
                  )}
                />
              ) : null}
              <SummaryRow
                label="Type"
                value={WALLET_TYPE_LABELS[transaction.type]}
              />
              <SummaryRow label="Référence" value={transaction.reference} />
              {transaction.transferRef ? (
                <SummaryRow
                  label="Opération liée"
                  value={transaction.transferRef}
                />
              ) : null}
            </View>
          </FadeIn>

          {transaction.counterparty ? (
            <FadeIn delay={140}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                  padding: spacing.md,
                  backgroundColor: colors.surface,
                  borderRadius: radii.xl,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: colors.hairline,
                }}
              >
                <UserAvatar user={transaction.counterparty} size={40} />
                <View style={{ flex: 1 }}>
                  <AppText variant="small" color={colors.textFaint}>
                    Contrepartie
                  </AppText>
                  <AppText variant="subheading" numberOfLines={1}>
                    {transaction.counterparty.name}
                  </AppText>
                </View>
              </View>
            </FadeIn>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}
