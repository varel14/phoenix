import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radii, spacing, withAlpha } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import { formatMoney } from "@/utils/money";
import { formatPhone } from "@/utils/format";
import { AppText, PressableScale } from "@/components/ui";
import { UserAvatar } from "@/components/chat/user-avatar";
import {
  MOBILE_MONEY_LABELS,
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
    case "PHONE_TRANSFER":
      return "call-outline";
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
    case "PHONE_TRANSFER":
      return "Transfert mobile";
  }
}

export function isCredit(transaction: WalletTransaction): boolean {
  return transaction.type === "TOPUP" || transaction.type === "TRANSFER_IN";
}

/** "Aujourd'hui · 09:24" / "Hier · 13:42" / "12 mai · 13:42" — reference row subtitle. */
function formatRowTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const time = date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (date.getTime() >= startOfToday) return `Aujourd'hui · ${time}`;
  if (date.getTime() >= startOfToday - 86_400_000) return `Hier · ${time}`;
  const day = date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  return `${day} · ${time}`;
}

/** Successful in/out sums for the current month — the Overview stat cards. */
export function monthInOut(transactions: WalletTransaction[]): {
  in: number;
  out: number;
} {
  const now = new Date();
  return transactions.reduce(
    (totals, transaction) => {
      const date = new Date(transaction.createdAt);
      if (
        transaction.status === "SUCCESS" &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear()
      ) {
        if (isCredit(transaction)) totals.in += transaction.amount;
        else totals.out += transaction.amount;
      }
      return totals;
    },
    { in: 0, out: 0 },
  );
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
        paddingVertical: spacing.sm + 2,
      }}
    >
      {counterparty ? (
        <UserAvatar user={counterparty} size={44} />
      ) : (
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radii.md,
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
            size={19}
            color={credit ? colors.success : colors.primary}
          />
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <AppText numberOfLines={1} style={{ fontSize: 15, fontWeight: "600" }}>
          {transaction.phoneNumber
            ? formatPhone(transaction.phoneNumber)
            : counterparty?.name ?? WALLET_TYPE_LABELS[transaction.type]}
        </AppText>
        <AppText variant="small" color={colors.textFaint} numberOfLines={1}>
          {transaction.provider
            ? `${MOBILE_MONEY_LABELS[transaction.provider]} · ${formatRowTime(transaction.createdAt)}`
            : formatRowTime(transaction.createdAt)}
        </AppText>
      </View>
      <View style={{ alignItems: "flex-end", gap: 2 }}>
        <AppText
          style={{
            fontSize: 15,
            fontWeight: "700",
            fontVariant: ["tabular-nums"],
            color: credit ? colors.success : colors.danger,
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
