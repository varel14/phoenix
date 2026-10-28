import { useEffect, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Contacts from "expo-contacts";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useDevConfirmPhoneTransfer,
  useInitiatePhoneTransfer,
  usePaymentMethods,
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
import {
  AmountKeyboard,
  Chip,
  FadeIn,
  PayBackdrop,
  PeerFlow,
  QuickRecipient,
  SuccessHero,
  SummaryRow,
} from "@/components/wallet-ui";
import { radii, spacing } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import { useAuthStore } from "@/stores/auth-store";
import { formatAmount, formatMoney } from "@/utils/money";
import { formatPhone } from "@/utils/format";
import {
  MOBILE_MONEY_LABELS,
  type MobileMoneyProvider,
  type WalletRecipient,
  type WalletTransaction,
} from "@/types/wallet";

const QUICK_AMOUNTS = [1_000, 2_000, 5_000, 10_000];
const MAX_DIGITS = 9;

type Stage = "recipient" | "amount";

/** Blinking caret shown after the amount while it is being typed. */
function AmountCaret() {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 480,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 480,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={{
        width: 2,
        height: 36,
        borderRadius: 1,
        backgroundColor: colors.primary,
        opacity,
        marginLeft: 4,
      }}
    />
  );
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SendScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    recipientId?: string;
    recipientName?: string;
    recipientImage?: string;
  }>();
  const sessionUser = useAuthStore((state) => state.user);
  const walletQuery = useWallet();
  const transfer = useTransfer();
  const phoneInit = useInitiatePhoneTransfer();
  const phoneConfirm = useDevConfirmPhoneTransfer();
  const methodsQuery = usePaymentMethods();

  // Phone mode: wire money to a real-world Orange Money / MTN number, typed
  // by hand or picked from the device's contact list.
  const [mode, setMode] = useState<"contacts" | "phone">("contacts");
  const [provider, setProvider] = useState<MobileMoneyProvider | null>(null);
  const [phoneInput, setPhoneInput] = useState("");
  const [contactName, setContactName] = useState<string | null>(null);
  const [pickingContact, setPickingContact] = useState(false);
  const [phoneTarget, setPhoneTarget] = useState<{
    phoneNumber: string;
    provider: MobileMoneyProvider;
    displayName: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Preselect the operator of the user's default payment method, if any.
  useEffect(() => {
    const defaultMethod = methodsQuery.data?.find(
      (method) => method.isDefault,
    );
    if (defaultMethod) {
      setProvider((current) => current ?? defaultMethod.provider);
    }
  }, [methodsQuery.data]);

  // Deep link from the "Envoi rapide" rail: recipient is preselected.
  // Follow flags are unknown here — they are never rendered in this stage.
  const linkedRecipient =
    params.recipientId && params.recipientName
      ? {
          id: params.recipientId,
          name: params.recipientName,
          image: params.recipientImage || null,
          isFollowing: false,
          isMutual: false,
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
  const [noteFocused, setNoteFocused] = useState(false);
  const [result, setResult] = useState<{
    transaction: WalletTransaction;
    walletBalance: number;
    recipient: WalletRecipient;
  } | null>(null);
  const [failure, setFailure] = useState<{ message: string } | null>(null);
  const transferBusy =
    transfer.isPending || phoneInit.isPending || phoneConfirm.isPending;

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

  /** Custom keypad entry: appends digits and keeps thousand separators. */
  function appendDigits(input: string) {
    const digits = (amountInput.replace(/\D/g, "") + input).slice(
      0,
      MAX_DIGITS,
    );
    setAmountInput(digits ? formatAmount(Number.parseInt(digits, 10)) : "");
  }

  function backspaceAmount() {
    const digits = amountInput.replace(/\D/g, "").slice(0, -1);
    setAmountInput(digits ? formatAmount(Number.parseInt(digits, 10)) : "");
  }


  function selectRecipient(candidate: WalletRecipient) {
    setRecipient(candidate);
    setStage("amount");
  }

  function normalizePhoneDigits(raw: string): string {
    return raw.replace(/[\s.-]/g, "");
  }

  const phoneDigits = normalizePhoneDigits(phoneInput);
  const phoneReady =
    provider != null && /^[+0-9][0-9]{7,14}$/.test(phoneDigits);

  /** Opens the native contact picker and prefills the number. */
  async function pickContact() {
    if (pickingContact) return;
    setPickingContact(true);
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== Contacts.PermissionStatus.GRANTED) {
        setError(
          "L'accès aux contacts est requis — vous pouvez aussi saisir le numéro à la main.",
        );
        return;
      }
      const contact = await Contacts.presentContactPickerAsync();
      const raw = contact?.phoneNumbers?.[0]?.number;
      if (!raw) {
        setError("Ce contact n'a pas de numéro de téléphone.");
        return;
      }
      setPhoneInput(normalizePhoneDigits(raw));
      setContactName(contact.name ?? null);
      setError(null);
    } catch {
      setError("Impossible d'ouvrir les contacts.");
    } finally {
      setPickingContact(false);
    }
  }

  /** Validates the typed/picked number and moves to the amount stage. */
  function confirmPhoneTarget() {
    if (!provider) {
      setError("Choisissez un opérateur : Orange Money ou MTN Money.");
      return;
    }
    if (!phoneReady) {
      setError("Numéro invalide — ex. 07 07 07 07 07 ou +225 07 07 07 07 07.");
      return;
    }
    const displayName = contactName ?? formatPhone(phoneDigits);
    setPhoneTarget({ phoneNumber: phoneDigits, provider, displayName });
    setRecipient({
      id: `phone:${phoneDigits}`,
      name: displayName,
      image: null,
      isFollowing: false,
      isMutual: false,
    });
    setError(null);
    setStage("amount");
  }

  function sendNow() {
    if (!recipient || !amountValid || !wallet) return;
    setFailure(null);
    const notePayload = note.trim() ? { note: note.trim() } : {};

    // Mobile money: initiate PENDING, then run the provider-confirmation
    // pipeline (dev stand-in for the operator webhook) before showing the
    // receipt. Numbers registered by another user credit them instantly
    // server-side, so the receipt is the same either way.
    if (phoneTarget) {
      phoneInit.mutate(
        {
          phoneNumber: phoneTarget.phoneNumber,
          provider: phoneTarget.provider,
          amount,
          ...notePayload,
        },
        {
          onSuccess: (transaction) =>
            phoneConfirm.mutate(transaction.reference, {
              onSuccess: (data) => {
                setResult({
                  transaction: data.transaction,
                  walletBalance: data.wallet.balance,
                  recipient,
                });
              },
              onError: (mutationError) =>
                setFailure({ message: (mutationError as Error).message }),
            }),
          onError: (mutationError) =>
            setFailure({ message: (mutationError as Error).message }),
        },
      );
      return;
    }

    transfer.mutate(
      {
        recipientId: recipient.id,
        amount,
        ...notePayload,
      },
      {
        onSuccess: (data) => {
          setResult({
            transaction: data.transaction,
            walletBalance: data.wallet.balance,
            recipient,
          });
        },
        onError: (mutationError) =>
          setFailure({ message: (mutationError as Error).message }),
      },
    );
  }

  const goBack = () => {
    if (failure) {
      setFailure(null);
      return;
    }
    if (result) {
      router.replace("/pay");
      return;
    }
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
      <IconButton
        icon="chevron-back"
        onPress={goBack}
        accessibilityLabel="Retour"
      />
      <AppText
        variant="subheading"
        style={{ flex: 1, textAlign: "center", marginRight: 40 }}
        numberOfLines={1}
      >
        {result
          ? "Argent envoyé"
          : failure
            ? "Transfert échoué"
            : stage === "recipient"
              ? "Choisissez un contact"
              : "Montant à envoyer"}
      </AppText>
    </View>
  );

  if (result) {
    const { transaction, walletBalance } = result;
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <PayBackdrop />
        {header}
        <ScrollView
          contentContainerStyle={{
            padding: spacing.lg,
            gap: spacing.xl,
            paddingTop: spacing.xxl,
            paddingBottom: 24,
          }}
        >
          <FadeIn>
            <SuccessHero
              title="Transfert réussi"
              subtitle={`Vous avez envoyé de l'argent à ${result.recipient.name}`}
              amountText={formatMoney(transaction.amount, transaction.currency)}
              amountColor={colors.text}
              statusPill="Opération effectuée"
            />
          </FadeIn>

          {/* Receipt card — Destinataire / Date / Heure / Référence / Montants */}
          <FadeIn delay={80}>
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: radii.xl,
                padding: spacing.xl,
                gap: spacing.md,
              }}
            >
              <SummaryRow label="Destinataire" value={result.recipient.name} />
              {transaction.provider ? (
                <SummaryRow
                  label="Opérateur"
                  value={MOBILE_MONEY_LABELS[transaction.provider]}
                />
              ) : null}
              {transaction.phoneNumber ? (
                <SummaryRow
                  label="Numéro"
                  value={formatPhone(transaction.phoneNumber)}
                />
              ) : null}
              <SummaryRow
                label="Date"
                value={new Date(transaction.createdAt).toLocaleDateString(
                  "fr-FR",
                  {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  },
                )}
              />
              <SummaryRow
                label="Heure"
                value={new Date(transaction.createdAt).toLocaleTimeString(
                  "fr-FR",
                )}
              />
              <SummaryRow label="Référence" value={transaction.reference} />
              <SummaryRow
                label="Montant envoyé"
                value={formatMoney(transaction.amount, transaction.currency)}
              />
              <SummaryRow
                label="Frais de transfert"
                value={formatMoney(0, transaction.currency)}
              />
              <SummaryRow
                label="Total débité"
                value={formatMoney(transaction.amount, transaction.currency)}
                valueColor={colors.primary}
              />
              <SummaryRow
                label="Nouveau solde"
                value={formatMoney(walletBalance, transaction.currency)}
              />
              {transaction.note ? (
                <SummaryRow label="Note" value={transaction.note} />
              ) : null}
              <View
                style={{
                  height: StyleSheet.hairlineWidth,
                  backgroundColor: colors.hairline,
                  borderStyle: "dashed",
                }}
              />
              <AppText
                variant="caption"
                color={colors.textFaint}
                align="center"
              >
                Conservez ce reçu comme preuve de paiement. Une confirmation a
                été envoyée au destinataire.
              </AppText>
            </View>
          </FadeIn>

          {/* Mockup: share receipt + home, pinned to the bottom */}
          <View
            style={{
              gap: spacing.md,
              paddingBottom: 8,
            }}
          >
            <FadeIn delay={120}>
              <Button
                label="Partager le reçu"
                icon="share-social-outline"
                onPress={() =>
                  void Share.share({
                    message: [
                      "Reçu Chuyassi Pay — Transfert réussi",
                      `Destinataire : ${result.recipient.name}`,
                      ...(transaction.provider
                        ? [`Opérateur : ${MOBILE_MONEY_LABELS[transaction.provider]}`]
                        : []),
                      ...(transaction.phoneNumber
                        ? [`Numéro : ${formatPhone(transaction.phoneNumber)}`]
                        : []),
                      `Montant : ${formatMoney(transaction.amount, transaction.currency)}`,
                      `Référence : ${transaction.reference}`,
                      `Date : ${formatDateTime(transaction.createdAt)}`,
                    ].join("\n"),
                  })
                }
              />
            </FadeIn>
            <FadeIn delay={160}>
              <Button
                label="Retour à l'accueil"
                variant="secondary"
                onPress={() => router.replace("/pay")}
              />
            </FadeIn>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (failure) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <PayBackdrop />
        {header}
        <ScrollView
          contentContainerStyle={{
            padding: spacing.lg,
            gap: spacing.xl,
            paddingTop: spacing.xxl,
            paddingBottom: 48,
          }}
        >
          <FadeIn>
            <SuccessHero
              tone="danger"
              title="Transfert échoué"
              amountText={formatMoney(
                Number.isFinite(amount) ? amount : 0,
                wallet?.currency,
              )}
              amountColor={colors.text}
              message={failure.message}
            />
          </FadeIn>

          {/* Who was involved in the failed attempt */}
          {recipient ? (
            <FadeIn delay={80}>
              <View
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: radii.xl,
                  padding: spacing.xl,
                }}
              >
                <PeerFlow
                  from={{
                    id: sessionUser?.id ?? "me",
                    name: sessionUser?.name ?? "Moi",
                    image: sessionUser?.image ?? null,
                  }}
                  to={recipient}
                />
              </View>
            </FadeIn>
          ) : null}

          <FadeIn delay={140}>
            <View style={{ gap: spacing.md }}>
              <Button
                label="Réessayer"
                icon="refresh-outline"
                onPress={sendNow}
                loading={transferBusy}
              />
              <Button
                label="Modifier le montant"
                variant="secondary"
                onPress={() => setFailure(null)}
              />
              <Button
                label="Retour au portefeuille"
                variant="ghost"
                onPress={() => router.replace("/pay")}
              />
            </View>
          </FadeIn>
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
          {/* Destination mode: in-app contacts or a real-world mobile number */}
          <FadeIn>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Chip
                label="Contacts"
                active={mode === "contacts"}
                onPress={() => {
                  setMode("contacts");
                  setError(null);
                }}
              />
              <Chip
                label="Numéro mobile"
                active={mode === "phone"}
                onPress={() => {
                  setMode("phone");
                  setError(null);
                }}
              />
            </View>
          </FadeIn>

          {mode === "phone" ? (
            <FadeIn delay={60}>
              <View style={{ gap: spacing.lg }}>
                {/* Operator selection */}
                <View style={{ gap: spacing.sm }}>
                  <AppText
                    variant="small"
                    color={colors.textFaint}
                    style={{ letterSpacing: 1.5 }}
                  >
                    OPÉRATEUR
                  </AppText>
                  <View style={{ flexDirection: "row", gap: spacing.sm }}>
                    {(["ORANGE_MONEY", "MTN_MONEY"] as const).map((option) => {
                      const active = provider === option;
                      const dot =
                        option === "ORANGE_MONEY" ? "#FF7900" : "#FFCC00";
                      return (
                        <PressableScale
                          key={option}
                          onPress={() => {
                            setProvider(option);
                            setError(null);
                          }}
                          scaleTo={0.97}
                          accessibilityLabel={MOBILE_MONEY_LABELS[option]}
                          style={{ flex: 1 }}
                        >
                          <View
                            style={{
                              height: 52,
                              borderRadius: radii.lg,
                              borderWidth: 1.5,
                              borderColor: active
                                ? colors.primary
                                : colors.border,
                              backgroundColor: active
                                ? colors.primaryTint
                                : colors.surface,
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: spacing.sm,
                            }}
                          >
                            <View
                              style={{
                                width: 12,
                                height: 12,
                                borderRadius: 6,
                                backgroundColor: dot,
                              }}
                            />
                            <AppText
                              style={{
                                fontSize: 13,
                                fontWeight: "600",
                                color: active
                                  ? colors.primary
                                  : colors.textMuted,
                              }}
                            >
                              {MOBILE_MONEY_LABELS[option]}
                            </AppText>
                          </View>
                        </PressableScale>
                      );
                    })}
                  </View>
                </View>

                {/* Number entry */}
                <View style={{ gap: spacing.sm }}>
                  <AppText
                    variant="small"
                    color={colors.textFaint}
                    style={{ letterSpacing: 1.5 }}
                  >
                    NUMÉRO DU BÉNÉFICIAIRE
                  </AppText>
                  <Input
                    placeholder="07 07 07 07 07 ou +225…"
                    value={phoneInput}
                    onChangeText={(text) => {
                      setPhoneInput(text);
                      setError(null);
                    }}
                    keyboardType="phone-pad"
                    autoCapitalize="none"
                    style={{
                      backgroundColor: colors.surfaceHighlight,
                      borderWidth: 0,
                    }}
                  />
                  <Button
                    label="Choisir dans les contacts"
                    variant="secondary"
                    icon="people-outline"
                    onPress={() => void pickContact()}
                    loading={pickingContact}
                  />
                  {contactName ? (
                    <AppText variant="small" color={colors.textMuted}>
                      {contactName} · {formatPhone(phoneDigits)}
                    </AppText>
                  ) : null}
                </View>

                {error ? (
                  <AppText style={{ color: colors.danger, fontSize: 13 }}>
                    {error}
                  </AppText>
                ) : null}

                <Button
                  label="Continuer"
                  icon="arrow-forward"
                  onPress={confirmPhoneTarget}
                  disabled={!phoneReady}
                />
              </View>
            </FadeIn>
          ) : (
            <>
              <FadeIn>
                <Input
                  placeholder="Rechercher un contact…"
                  value={search}
                  onChangeText={setSearch}
                  style={{
                    backgroundColor: colors.surfaceHighlight,
                    borderWidth: 0,
                  }}
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
                      size={38}
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
                        }}
                      >
                        <UserAvatar user={candidate} size={36} />
                        <View style={{ flex: 1, gap: 1 }}>
                          <AppText variant="subheading" numberOfLines={1}>
                            {candidate.name}
                          </AppText>
                        </View>
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
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

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
          paddingBottom: 24,
        }}
      >
        {/* Recipient card */}
        <FadeIn>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              padding: spacing.md,
              backgroundColor: colors.surface,
              borderRadius: radii.xl,
              borderWidth: 1,
              borderColor: colors.border,
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

        {/* Amount entry — custom keypad below, display here */}
        <FadeIn delay={60}>
          <View style={{ alignItems: "center", gap: spacing.sm }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <AppText
                style={{
                  fontSize: 48,
                  fontWeight: "800",
                  letterSpacing: -1.5,
                  color: amountInput ? colors.text : colors.textFaint,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {amountInput || "0"}
              </AppText>
              <AmountCaret />
              <AppText
                style={{
                  fontSize: 16,
                  fontWeight: "600",
                  color: colors.textFaint,
                  marginLeft: spacing.sm,
                  marginBottom: 4,
                }}
              >
                FCFA
              </AppText>
            </View>
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
                  label={`${formatAmount(preset)} FCFA`}
                  active={amount === preset}
                  onPress={() => setAmountInput(formatAmount(preset))}
                />
              ))}
            </View>
          </View>
        </FadeIn>

        <FadeIn delay={120}>
          <Input
            placeholder="Message (optionnel)"
            value={note}
            onChangeText={setNote}
            onFocus={() => setNoteFocused(true)}
            onBlur={() => setNoteFocused(false)}
            maxLength={200}
          />
        </FadeIn>
      </ScrollView>

      {/* Mockup layout: primary action sits directly above the grid keypad */}
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingBottom: noteFocused
            ? Math.max(insets.bottom, spacing.md) + spacing.sm
            : spacing.sm,
        }}
      >
        <Button
          label={
            recipient
              ? Number.isFinite(amount) && amount > 0
                ? `Envoyer ${formatMoney(amount)}`
                : "Envoyer"
              : "Choisissez un destinataire"
          }
          onPress={sendNow}
          disabled={!canSend || transferBusy}
          loading={transferBusy}
        />
      </View>

      {/* Custom keypad — yields to the system keyboard while noting */}
      {!noteFocused ? (
        <AmountKeyboard
          onDigit={appendDigits}
          onDelete={backspaceAmount}
          style={{
            paddingHorizontal: spacing.xl,
            paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.xs,
          }}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}
