import { ScrollView, Share, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useTransaction } from "@/hooks/use-payments";
import { AppText, Button, ErrorView, IconButton, LoadingView } from "@/components/ui";
import { radii, spacing } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import { formatMoney } from "@/utils/money";
import { TRANSACTION_STATUS_LABELS } from "@/types/payments";

export default function ReceiptScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, gradients } = useTheme();
  const insets = useSafeAreaInsets();
  const query = useTransaction(id);

  if (query.isLoading) return <LoadingView label="Chargement du reçu…" />;
  if (query.isError || !query.data) {
    return <ErrorView message={(query.error as Error)?.message} onRetry={() => void query.refetch()} />;
  }

  const transaction = query.data;

  async function shareReceipt() {
    const lines = [
      "Reçu Chuyassi Emmanuel CE",
      `Référence : ${transaction.reference}`,
      `Service : ${transaction.service?.name ?? "Commande Boutique"}`,
      `Montant : ${formatMoney(transaction.amount, transaction.currency)}`,
      `Statut : ${TRANSACTION_STATUS_LABELS[transaction.status]}`,
      `Date : ${new Date(transaction.paidAt ?? transaction.createdAt).toLocaleString("fr-FR")}`,
    ];
    await Share.share({ message: lines.join("\n") });
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.sm, paddingTop: spacing.xs, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <IconButton icon="chevron-back" onPress={() => router.back()} accessibilityLabel="Retour" />
        <AppText variant="heading" style={{ flex: 1, textAlign: "center", marginRight: 40 }}>
          Reçu
        </AppText>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 120 }}>
        {/* Receipt card */}
        <View style={{ backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.xl, gap: spacing.lg }}>
          <View style={{ alignItems: "center", gap: spacing.sm }}>
            <View
              style={{
                width: 60,
                height: 60,
                borderRadius: radii.full,
                backgroundColor: transaction.status === "SUCCESS" ? colors.success : colors.warning,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="checkmark" size={30} color="#fff" />
            </View>
            <AppText variant="heading">Paiement {TRANSACTION_STATUS_LABELS[transaction.status].toLowerCase()}</AppText>
            <AppText variant="title" color={colors.accent}>
              {formatMoney(transaction.amount, transaction.currency)}
            </AppText>
          </View>

          <View style={{ height: 1, borderTopWidth: 1, borderStyle: "dashed", borderTopColor: colors.border }} />

          <View style={{ gap: spacing.md }}>
            <Row label="Référence" value={transaction.reference} />
            {transaction.providerReference ? <Row label="Référence externe" value={transaction.providerReference} /> : null}
            <Row label="Service" value={transaction.service?.name ?? "Commande Boutique"} />
            <Row
              label="Date"
              value={new Date(transaction.paidAt ?? transaction.createdAt).toLocaleString("fr-FR", {
                day: "2-digit",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            />
            <Row label="Méthode" value={transaction.receipt?.method ?? transaction.provider} />
            <Row label="Statut" value={TRANSACTION_STATUS_LABELS[transaction.status]} />
            {transaction.receipt ? <Row label="N° de reçu" value={transaction.receipt.reference} /> : null}
          </View>

          <View style={{ height: 1, borderTopWidth: 1, borderStyle: "dashed", borderTopColor: colors.border }} />

          {Object.entries(transaction.metadata?.fields ?? {}).length > 0 ? (
            <View style={{ gap: spacing.md }}>
              <AppText variant="small" color={colors.textFaint} style={{ letterSpacing: 1.5 }}>
                INFORMATIONS FOURNIES
              </AppText>
              {Object.entries(transaction.metadata?.fields ?? {}).map(([key, value]) => (
                <Row key={key} label={key} value={value} />
              ))}
            </View>
          ) : null}
        </View>

        <Button label="Partager le reçu" variant="secondary" onPress={() => void shareReceipt()} />
      </ScrollView>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.lg }}>
      <AppText variant="bodyMuted">{label}</AppText>
      <AppText style={{ fontWeight: "600", flexShrink: 1, textAlign: "right" }}>
        {value}
      </AppText>
    </View>
  );
}
