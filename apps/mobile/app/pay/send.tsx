import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useTransfer,
  useWallet,
  useWalletRecipients,
} from "@/hooks/use-wallet";
import {
  AppText,
  Button,
  ErrorView,
  IconButton,
  Input,
  PressableScale,
} from "@/components/ui";
import { UserAvatar } from "@/components/chat/user-avatar";
import { Chip, FadeIn, QuickRecipient, SuccessHero } from "@/components/wallet-ui";
import { radii, spacing } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import { formatAmount, formatMoney } from "@/utils/money";
import type { WalletRecipient } from "@/types/wallet";

const QUICK_AMOUNTS = [1_000, 2_000, 5_000, 10_000];

type Stage = "recipient" | "amount";

export default function SendScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    recipientId?: string;
    recipientName?: string;
    recipientImage?: string;
  }>();
  const walletQuery = useWallet();
  const transfer = useTransfer();

  // Deep link from the "Envoi rapide" rail: recipient is preselected.
  const linkedRecipient =
    params.recipientId && params.recipientName
      ? {
          id: params.recipientId,
          name: params.recipientName,
          image: params.recipientImage || null,
        }
      : null;

  const [stage, setStage] = useState<Stage>(() =>
    linkedRecipient ? "amount" : "recipient",
  );
  const [recipient, setRecipient] = useState<WalletRecipient | null>(
    linkedRecipient,
  );
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [note, setNote] = useState("");
  const [result, setResult] = useState<{
    transactionBalance: number;
    amount: number;
    name: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const recipientsQuery = useWalletRecipients(debouncedSearch);
  const recipients = recipientsQuery.data ?? [];

  const wallet = walletQuery.data;
  const amount = Number.parseInt(amountInput.replace(/\D/g, ""), 10);
  const amountValid =
    Number.isFinite(amount) && amount >= 1 && (wallet?.balance ?? 0) >= amount;
  const canSend = recipient != null && amountValid;
  const exceedsBalance =
    recipient != null &&
    Number.isFinite(amount) &&
    amount > 0 &&
    wallet != null &&
    amount > wallet.balance;

  /** Keeps thousand separators while typing; stores the formatted value. */
  function handleAmountChange(text: string) {
    const digits = text.replace(/\D/g, "").slice(0, 9);
    setAmountInput(digits ? formatAmount(Number.parseInt(digits, 10)) : "");
    setError(null);
  }

  function selectRecipient(candidate: WalletRecipient) {
    setRecipient(candidate);
    setStage("amount");
  }

  function sendNow() {
    if (!recipient || !amountValid || !wallet) return;
    setError(null);
    transfer.mutate(
      {
        recipientId: recipient.id,
        amount,
        ...(note.trim() ? { note: note.trim() } : {}),
      },
      {
        onSuccess: (data) => {
          setResult({
            transactionBalance: data.wallet.balance,
            amount: data.transaction.amount,
            name: recipient.name,
          });
        },
        onError: (mutationError) => setError((mutationError as Error).message),
      },
    );
  }

  const goBack = () => {
    if (stage === "amount" && !linkedRecipient) {
      setStage("recipient");
      return;
    }
    router.back();
  };

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
      <IconButton icon="chevron-back" onPress={goBack} accessibilityLabel="Retour" />
      <View style={{ flex: 1, paddingRight: 40 }}>
        <AppText variant="subheading">
          {result
            ? "Argent envoyé"
            : stage === "recipient"
              ? "Envoyer de l'argent"
              : "Montant à envoyer"}
        </AppText>
        <AppText variant="small" color={colors.textFaint}>
          {wallet
            ? `Solde : ${formatMoney(wallet.balance, wallet.currency)}`
            : "À un contact"}
        </AppText>
      </View>
    </View>
  );

  if (result) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {header}
        <ScrollView
          contentContainerStyle={{
            padding: spacing.lg,
            gap: spacing.xl,
            paddingTop: spacing.xxl,
          }}
        >
          <SuccessHero
            title="Argent envoyé"
            amountText={`−${formatMoney(result.amount, wallet?.currency)}`}
            amountColor={colors.text}
            message={`${result.name} a bien reçu votre envoi.\nNouveau solde : ${formatMoney(
              result.transactionBalance,
              wallet?.currency,
            )}`}
          />
          <View style={{ gap: spacing.md, marginTop: spacing.md }}>
            <Button
              label="Envoyer à nouveau"
              variant="secondary"
              icon="paper-plane-outline"
              onPress={() => {
                setResult(null);
                setAmountInput("");
                setNote("");
                setError(null);
                setStage("amount");
              }}
            />
            <Button
              label="Retour au portefeuille"
              onPress={() => router.replace("/pay")}
            />
          </View>
        </ScrollView>
      </View>
    );
  }

  if (stage === "recipient") {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
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
            <Input
              placeholder="Rechercher un contact…"
              value={search}
              onChangeText={setSearch}
            />
          </FadeIn>

          {!search && recipients.length > 0 ? (
            <FadeIn delay={60}>
              <View style={{ gap: spacing.md }}>
                <AppText
                  variant="small"
                  color={colors.textFaint}
                  style={{ letterSpacing: 1.5 }}
                >
                  RÉCENTS
                </AppText>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{
                    gap: spacing.md,
                    paddingRight: spacing.lg,
                  }}
                >
                  {recipients.slice(0, 8).map((candidate) => (
                    <QuickRecipient
                      key={candidate.id}
                      id={candidate.id}
                      name={candidate.name}
                      image={candidate.image}
                      onPress={() => selectRecipient(candidate)}
                    />
                  ))}
                </ScrollView>
              </View>
            </FadeIn>
          ) : null}

          <FadeIn delay={120}>
            <View style={{ gap: spacing.md }}>
              <AppText
                variant="small"
                color={colors.textFaint}
                style={{ letterSpacing: 1.5 }}
              >
                {search ? "RÉSULTATS" : "TOUS LES CONTACTS"}
              </AppText>
              {recipientsQuery.isLoading ? (
                <AppText variant="bodyMuted">Chargement des contacts…</AppText>
              ) : recipientsQuery.isError ? (
                <ErrorView
                  message={(recipientsQuery.error as Error)?.message}
                  onRetry={() => void recipientsQuery.refetch()}
                />
              ) : recipients.length === 0 ? (
                <AppText variant="bodyMuted">
                  Aucun contact trouvé. Discutez avec quelqu'un dans les
                  messages ou recherchez par nom.
                </AppText>
              ) : (
                <View style={{ gap: spacing.sm }}>
                  {recipients.map((candidate) => (
                    <PressableScale
                      key={candidate.id}
                      onPress={() => selectRecipient(candidate)}
                      scaleTo={0.98}
                      accessibilityLabel={`Envoyer à ${candidate.name}`}
                    >
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
                        <UserAvatar user={candidate} size={44} />
                        <AppText
                          variant="subheading"
                          numberOfLines={1}
                          style={{ flex: 1 }}
                        >
                          {candidate.name}
                        </AppText>
                        <Ionicons
                          name="chevron-forward"
                          size={18}
                          color={colors.textFaint}
                        />
                      </View>
                    </PressableScale>
                  ))}
                </View>
              )}
            </View>
          </FadeIn>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {header}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: spacing.lg,
          gap: spacing.xl,
          paddingBottom: 48,
        }}
      >
        {/* Selected recipient */}
        <FadeIn>
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
            {recipient ? <UserAvatar user={recipient} size={44} /> : null}
            <View style={{ flex: 1 }}>
              <AppText variant="subheading" numberOfLines={1}>
                {recipient?.name}
              </AppText>
              <AppText variant="small" color={colors.textFaint}>
                Destinataire
              </AppText>
            </View>
            {!linkedRecipient ? (
              <Pressable
                accessibilityRole="button"
                hitSlop={12}
                onPress={() => setStage("recipient")}
              >
                <AppText
                  variant="small"
                  color={colors.accent}
                  style={{ fontWeight: "700" }}
                >
                  Modifier
                </AppText>
              </Pressable>
            ) : null}
          </View>
        </FadeIn>

        {/* Amount entry */}
        <FadeIn delay={60}>
          <View style={{ alignItems: "center", gap: spacing.sm }}>
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
              {wallet
                ? `Solde disponible : ${formatMoney(wallet.balance, wallet.currency)}`
                : "Montant en FCFA"}
            </AppText>
            {exceedsBalance ? (
              <AppText variant="small" color={colors.danger}>
                Montant supérieur au solde disponible
              </AppText>
            ) : null}
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                justifyContent: "center",
                gap: spacing.sm,
                marginTop: spacing.xs,
              }}
            >
              {QUICK_AMOUNTS.map((preset) => (
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
              {wallet && wallet.balance > 0 ? (
                <Chip
                  label="Max"
                  active={amount === wallet.balance}
                  onPress={() => {
                    setAmountInput(formatAmount(wallet.balance));
                    setError(null);
                  }}
                />
              ) : null}
            </View>
          </View>
        </FadeIn>

        <FadeIn delay={120}>
          <Input
            placeholder="Message (optionnel)"
            value={note}
            onChangeText={setNote}
            maxLength={200}
          />
        </FadeIn>

        {error ? (
          <AppText style={{ color: colors.danger, fontSize: 13 }}>
            {error}
          </AppText>
        ) : null}
        <Button
          label={
            recipient
              ? Number.isFinite(amount) && amount > 0
                ? `Envoyer ${formatMoney(amount)}`
                : "Envoyer"
              : "Choisissez un destinataire"
          }
          onPress={sendNow}
          disabled={!canSend || transfer.isPending}
          loading={transfer.isPending}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
