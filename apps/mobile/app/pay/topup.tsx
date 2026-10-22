import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useDevConfirmTopup, useInitiateTopup } from "@/hooks/use-wallet";
import {
  AppText,
  Button,
  ErrorView,
  IconButton,
  LoadingView,
} from "@/components/ui";
import {
  Chip,
  FadeIn,
  PayBackdrop,
  StatusChip,
  SuccessHero,
  SummaryRow,
} from "@/components/wallet-ui";
import { radii, spacing } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import { formatAmount, formatMoney } from "@/utils/money";
import type { WalletTransaction } from "@/types/wallet";

const PRESETS = [1_000, 2_000, 5_000, 10_000, 25_000, 50_000];

type Step = "form" | "pending" | "done";

export default function TopUpScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const initiate = useInitiateTopup();
  const devConfirm = useDevConfirmTopup();

  const [amountInput, setAmountInput] = useState("");
  const [step, setStep] = useState<Step>("form");
  const [transaction, setTransaction] = useState<WalletTransaction | null>(
    null,
  );
  const [balanceAfter, setBalanceAfter] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const amount = Number.parseInt(amountInput.replace(/\D/g, ""), 10);
  const amountValid = Number.isFinite(amount) && amount >= 100;

  /** Keeps thousand separators while typing. */
  function handleAmountChange(text: string) {
    const digits = text.replace(/\D/g, "").slice(0, 9);
    setAmountInput(digits ? formatAmount(Number.parseInt(digits, 10)) : "");
    setError(null);
  }

  function requestTopup() {
    if (!amountValid) {
      setError("Choisissez un montant d'au moins 100 FCFA.");
      return;
    }
    setError(null);
    setStep("pending");
    initiate.mutate(
      { amount },
      {
        onSuccess: (data) => setTransaction(data),
        onError: (mutationError) => {
          setError((mutationError as Error).message);
          setStep("form");
        },
      },
    );
  }

  /** Development flow only: confirm through the server-side pipeline. */
  function confirmTopup() {
    if (!transaction) return;
    devConfirm.mutate(transaction.reference, {
      onSuccess: (data) => {
        setTransaction(data.transaction);
        setBalanceAfter(data.wallet.balance);
        setStep("done");
      },
      onError: (mutationError) => setError((mutationError as Error).message),
    });
  }

  const header = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        paddingHorizontal: spacing.sm,
        paddingTop: insets.top + spacing.xs,
        paddingBottom: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <IconButton
        icon="chevron-back"
        onPress={() =>
          step === "form" || step === "pending"
            ? router.back()
            : router.replace("/pay")
        }
        accessibilityLabel="Retour"
      />
      <View style={{ flex: 1, paddingRight: 40 }}>
        <AppText variant="subheading">
          {step === "done" ? "Rechargement réussi" : "Recharger"}
        </AppText>
        <AppText variant="small" color={colors.textFaint}>
          Mobile money · carte bancaire
        </AppText>
      </View>
    </View>
  );

  if (step === "form") {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <PayBackdrop />
        {header}
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            padding: spacing.lg,
            gap: spacing.xl,
            paddingBottom: 48,
          }}
        >
          <FadeIn>
            <View style={{ alignItems: "center", gap: spacing.sm, marginTop: spacing.md }}>
              <TextInput
                value={amountInput}
                onChangeText={handleAmountChange}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={colors.textFaint}
                textAlign="center"
                style={{
                  fontSize: 40,
                  fontWeight: "800",
                  letterSpacing: -1,
                  color: colors.text,
                  fontVariant: ["tabular-nums"],
                  minHeight: 52,
                  width: "100%",
                }}
              />
              <AppText variant="caption" color={colors.textFaint}>
                Montant en FCFA · minimum 100
              </AppText>
            </View>
          </FadeIn>

          <FadeIn delay={60}>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                justifyContent: "center",
                gap: spacing.sm,
              }}
            >
              {PRESETS.map((preset) => (
                <Chip
                  key={preset}
                  label={formatAmount(preset)}
                  active={amount === preset}
                  onPress={() => {
                    setAmountInput(formatAmount(preset));
                    setError(null);
                  }}
                />
              ))}
            </View>
          </FadeIn>

          <FadeIn delay={120}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                padding: spacing.lg,
                backgroundColor: colors.surface,
                borderRadius: radii.xl,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: colors.hairline,
              }}
            >
              <Ionicons
                name="information-circle-outline"
                size={20}
                color={colors.primary}
              />
              <AppText variant="small" color={colors.textMuted} style={{ flex: 1 }}>
                Le solde est crédité après confirmation du paiement. Mode démo :
                la confirmation est simulée côté serveur.
              </AppText>
            </View>
          </FadeIn>

          {error ? (
            <AppText style={{ color: colors.danger, fontSize: 13 }}>
              {error}
            </AppText>
          ) : null}
          <Button
            label={
              amountValid ? `Recharger ${formatAmount(amount)} FCFA` : "Recharger"
            }
            onPress={requestTopup}
            disabled={!amountValid}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  if (step === "pending" || !transaction) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <PayBackdrop />
        {header}
        {error ? (
          <View style={{ padding: spacing.lg }}>
            <ErrorView message={error} onRetry={requestTopup} />
          </View>
        ) : (
          <LoadingView label="Initialisation du rechargement…" />
        )}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <PayBackdrop />
      {header}
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          gap: spacing.xl,
          paddingTop: spacing.xxl,
        }}
      >
        <SuccessHero
          title="Rechargement réussi"
          amountText={`+${formatMoney(transaction.amount, transaction.currency)}`}
          amountColor={colors.success}
          message={
            balanceAfter != null
              ? `Nouveau solde : ${formatMoney(balanceAfter, transaction.currency)}`
              : undefined
          }
        />
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
          <SummaryRow label="Référence" value={transaction.reference} />
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <AppText variant="bodyMuted">Statut</AppText>
            <StatusChip status={transaction.status} />
          </View>
        </View>
        <Button
          label="Retour au portefeuille"
          onPress={() => router.replace("/pay")}
        />
      </ScrollView>
    </View>
  );
}
