import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radii, spacing, withAlpha } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import { formatMoney } from "@/utils/money";
import { AppText, PressableScale } from "@/components/ui";
import { UserAvatar } from "@/components/chat/user-avatar";
import {
  WALLET_TYPE_LABELS,
  type WalletTransaction,
  type WalletTransactionType,
} from "@/types/wallet";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

export function transactionIcon(type: WalletTransactionType): IconName {
  switch (type) {
    case "TOPUP":
      return "add-circle-outline";
    case "TRANSFER_OUT":
      return "arrow-up-outline";
    case "TRANSFER_IN":
      return "arrow-down-outline";
  }
}

export function transactionLabel(
  type: WalletTransactionType,
  counterpartyName: string | undefined,
): string {
  switch (type) {
    case "TOPUP":
      return "Rechargement";
    case "TRANSFER_OUT":
      return `Envoyé à ${counterpartyName ?? "—"}`;
    case "TRANSFER_IN":
      return `Reçu de ${counterpartyName ?? "—"}`;
  }
}

export function isCredit(transaction: WalletTransaction): boolean {
  return transaction.type === "TOPUP" || transaction.type === "TRANSFER_IN";
}

/** Compact time for row subtitles: HH:MM today, otherwise "12 mai". */
function formatRowTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  if (date.getTime() >= startOfToday.getTime()) {
    return date.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

export function WalletTransactionRow({
  transaction,
  onPress,
}: {
  transaction: WalletTransaction;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const credit = isCredit(transaction);
  const pending = transaction.status === "PENDING";
  const counterparty = transaction.counterparty;

  const content = (
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
      {counterparty ? (
        <UserAvatar user={counterparty} size={44} />
      ) : (
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radii.lg,
            backgroundColor: withAlpha(
              credit ? colors.success : colors.primary,
              0.14,
            ),
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons
            name={transactionIcon(transaction.type)}
            size={20}
            color={credit ? colors.success : colors.primary}
          />
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="subheading" numberOfLines={1}>
          {counterparty?.name ?? WALLET_TYPE_LABELS[transaction.type]}
        </AppText>
        <AppText variant="small" color={colors.textFaint} numberOfLines={1}>
          {WALLET_TYPE_LABELS[transaction.type]} · {formatRowTime(transaction.createdAt)}
        </AppText>
      </View>
      <View style={{ alignItems: "flex-end", gap: 2 }}>
        <AppText
          style={{
            fontWeight: "700",
            fontVariant: ["tabular-nums"],
            color: credit ? colors.success : colors.text,
          }}
        >
          {credit ? "+" : "−"}
          {formatMoney(transaction.amount, transaction.currency)}
        </AppText>
        {pending ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Ionicons name="time-outline" size={12} color={colors.warning} />
            <AppText variant="small" color={colors.warning}>
              En attente
            </AppText>
          </View>
        ) : null}
      </View>
    </View>
  );

  if (!onPress) return content;
  return (
    <PressableScale onPress={onPress} scaleTo={0.98}>
      {content}
    </PressableScale>
  );
}
