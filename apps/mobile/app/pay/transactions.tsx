import { useMemo, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useWalletTransactions } from "@/hooks/use-wallet";
import {
  AppText,
  EmptyView,
  ErrorView,
  IconButton,
} from "@/components/ui";
import {
  monthInOut,
  WalletTransactionRow,
} from "@/components/wallet-transaction-row";
import { Chip, FadeIn, PayBackdrop } from "@/components/wallet-ui";
import { radii, spacing } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import { formatAmount } from "@/utils/money";
import type {
  WalletTransaction,
  WalletTransactionType,
} from "@/types/wallet";

const FILTERS: Array<{ key: WalletTransactionType | null; label: string }> = [
  { key: null, label: "Tout" },
  { key: "TOPUP", label: "Rechargements" },
  { key: "TRANSFER_OUT", label: "Envoyés" },
  { key: "TRANSFER_IN", label: "Reçus" },
];

/** "Aujourd'hui" / "Hier" / "lundi 12 mai" for section headers. */
function dayLabel(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const time = date.getTime();
  if (time >= startOfToday) return "Aujourd'hui";
  if (time >= startOfToday - 86_400_000) return "Hier";
  const formatted = date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export default function WalletTransactionsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<WalletTransactionType | null>(null);
  const query = useWalletTransactions(filter ?? undefined);
  const transactions = query.data?.data ?? [];

  // Consecutive transactions share a day header (the list arrives date-desc).
  const sections = useMemo(() => {
    const groups: Array<{ label: string; items: WalletTransaction[] }> = [];
    for (const transaction of transactions) {
      const label = dayLabel(transaction.createdAt);
      const last = groups[groups.length - 1];
      if (last && last.label === label) {
        last.items.push(transaction);
      } else {
        groups.push({ label, items: [transaction] });
      }
    }
    return groups;
  }, [transactions]);

  // In/out for the current month, from the loaded page.
  const monthTotals = monthInOut(transactions);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: insets.top,
      }}
    >
      <PayBackdrop />
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
          Activité
        </AppText>
      </View>

      {/* Type filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          flexDirection: "row",
          gap: spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
        }}
      >
        {FILTERS.map((entry) => (
          <Chip
            key={entry.label}
            label={entry.label}
            active={filter === entry.key}
            onPress={() => setFilter(entry.key)}
          />
        ))}
      </ScrollView>

      {query.isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <AppText variant="bodyMuted">Chargement de l'activité…</AppText>
        </View>
      ) : query.isError ? (
        <ErrorView
          message={(query.error as Error)?.message}
          onRetry={() => void query.refetch()}
        />
      ) : transactions.length === 0 ? (
        <EmptyView
          title="Aucune transaction"
          subtitle="Vos rechargements et transferts apparaîtront ici."
        />
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching}
              onRefresh={() => void query.refetch()}
              tintColor={colors.accent}
            />
          }
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingBottom: 48,
            gap: spacing.lg,
          }}
        >
          {filter === null ? (
            <FadeIn>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: colors.surface,
                  borderRadius: radii.xl,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: colors.hairline,
                  padding: spacing.lg,
                }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.xs,
                    }}
                  >
                    <Ionicons
                      name="arrow-down-outline"
                      size={13}
                      color={colors.success}
                    />
                    <AppText variant="small" color={colors.textFaint}>
                      Ce mois · entrées
                    </AppText>
                  </View>
                  <AppText
                    style={{
                      fontWeight: "700",
                      color: colors.success,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    +{formatAmount(monthTotals.in)} FCFA
                  </AppText>
                </View>
                <View
                  style={{
                    width: 1,
                    height: 34,
                    backgroundColor: colors.hairline,
                    marginHorizontal: spacing.md,
                  }}
                />
                <View style={{ flex: 1, gap: 2, alignItems: "flex-end" }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.xs,
                    }}
                  >
                    <Ionicons
                      name="arrow-up-outline"
                      size={13}
                      color={colors.danger}
                    />
                    <AppText variant="small" color={colors.textFaint}>
                      Ce mois · sorties
                    </AppText>
                  </View>
                  <AppText
                    style={{
                      fontWeight: "700",
                      color: colors.danger,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    −{formatAmount(monthTotals.out)} FCFA
                  </AppText>
                </View>
              </View>
            </FadeIn>
          ) : null}

          {sections.map((section) => (
            <View key={section.label} style={{ gap: spacing.sm }}>
              <AppText
                variant="small"
                color={colors.textFaint}
                style={{ letterSpacing: 1.2 }}
              >
                {section.label.toUpperCase()}
              </AppText>
              {section.items.map((transaction) => (
                <WalletTransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  onPress={() =>
                    router.push(`/pay/transactions/${transaction.id}`)
                  }
                />
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
