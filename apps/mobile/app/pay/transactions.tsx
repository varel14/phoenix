import { Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useTransactions } from "@/hooks/use-payments";
import { AppText, EmptyView, ErrorView, IconButton, LoadingView } from "@/components/ui";
import { radii, spacing } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import { formatMoney } from "@/utils/money";
import { TRANSACTION_STATUS_LABELS, type PaymentTransaction } from "@/types/payments";

export default function TransactionsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const query = useTransactions();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.sm, paddingTop: spacing.xs, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <IconButton icon="chevron-back" onPress={() => router.back()} accessibilityLabel="Retour" />
        <AppText variant="heading" style={{ flex: 1, textAlign: "center", marginRight: 40 }}>
          Mes transactions
        </AppText>
      </View>

      {query.isLoading ? (
        <LoadingView label="Chargement des transactions…" />
      ) : query.isError ? (
        <ErrorView message={(query.error as Error)?.message} onRetry={() => void query.refetch()} />
      ) : !query.data || query.data.data.length === 0 ? (
        <EmptyView title="Aucune transaction" subtitle="Vos paiements apparaîtront ici." />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 120 }}>
          {query.data.data.map((transaction) => (
            <TransactionRow key={transaction.id} transaction={transaction} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function TransactionRow({ transaction }: { transaction: PaymentTransaction }) {
  const { colors } = useTheme();
  const statusColor =
    transaction.status === "SUCCESS"
      ? colors.success
      : transaction.status === "FAILED"
        ? colors.danger
        : transaction.status === "PENDING" || transaction.status === "PROCESSING"
          ? colors.warning
          : colors.textMuted;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/pay/receipt/${transaction.id}`)}
      style={({ pressed }) => ({
        backgroundColor: pressed ? colors.surfaceHighlight : colors.surface,
        borderRadius: radii.lg,
        padding: spacing.lg,
        gap: 6,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: radii.md,
            backgroundColor: colors.primaryTint,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="card-outline" size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="subheading" numberOfLines={1}>
            {transaction.service?.name ?? "Commande Boutique"}
          </AppText>
          <AppText variant="small" color={colors.textFaint}>
            {new Date(transaction.createdAt).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          </AppText>
        </View>
        <AppText variant="subheading" color={colors.text}>
          {formatMoney(transaction.amount, transaction.currency)}
        </AppText>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <AppText variant="small" color={colors.textFaint}>
          Réf. {transaction.reference}
        </AppText>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ width: 8, height: 8, borderRadius: radii.full, backgroundColor: statusColor }} />
          <AppText variant="small" color={statusColor} style={{ fontWeight: "700" }}>
            {TRANSACTION_STATUS_LABELS[transaction.status]}
          </AppText>
        </View>
      </View>
    </Pressable>
  );
}
