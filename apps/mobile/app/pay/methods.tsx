import { useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { usePaymentMethodMutations, usePaymentMethods } from "@/hooks/use-wallet";
import {
  AppText,
  Button,
  ErrorView,
  IconButton,
  Input,
  LoadingView,
  PressableScale,
} from "@/components/ui";
import {
  FadeIn,
  PayBackdrop,
} from "@/components/wallet-ui";
import { radii, spacing, withAlpha } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import { formatPhone } from "@/utils/format";
import {
  MOBILE_MONEY_LABELS,
  type MobileMoneyProvider,
  type PaymentMethod,
} from "@/types/wallet";

const PROVIDER_DOT: Record<MobileMoneyProvider, string> = {
  ORANGE_MONEY: "#FF7900",
  MTN_MONEY: "#FFCC00",
};

/**
 * Moyens de paiement — the user's registered Orange Money / MTN numbers.
 * A number is the owner's wallet address: anyone knowing it can send money
 * straight to their wallet, and it doubles as a send/cash-out method.
 */
export default function PaymentMethodsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const methodsQuery = usePaymentMethods();
  const { addMethod, removeMethod, setDefaultMethod } =
    usePaymentMethodMutations();

  const [provider, setProvider] = useState<MobileMoneyProvider | null>(null);
  const [numberInput, setNumberInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const methods = methodsQuery.data ?? [];
  const busy = addMethod.isPending || removeMethod.isPending || setDefaultMethod.isPending;

  function add() {
    const digits = numberInput.replace(/[\s.-]/g, "");
    if (!provider) {
      setError("Choisissez un opérateur : Orange Money ou MTN Money.");
      return;
    }
    if (!/^[+0-9][0-9]{7,14}$/.test(digits)) {
      setError("Numéro invalide — ex. 07 07 07 07 07 ou +225 07 07 07 07 07.");
      return;
    }
    setError(null);
    addMethod.mutate(
      { provider, phoneNumber: digits },
      {
        onSuccess: () => {
          setNumberInput("");
          setProvider(null);
        },
        onError: (mutationError) =>
          setError((mutationError as Error).message),
      },
    );
  }

  function confirmRemove(method: PaymentMethod) {
    Alert.alert(
      "Supprimer ce moyen de paiement ?",
      `${MOBILE_MONEY_LABELS[method.provider]} · ${formatPhone(method.phoneNumber)} ne pourra plus recevoir d'argent par numéro.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: () => removeMethod.mutate(method.id),
        },
      ],
    );
  }

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
          variant="subheading"
          style={{ flex: 1, textAlign: "center", marginRight: 40 }}
          numberOfLines={1}
        >
          Moyens de paiement
        </AppText>
      </View>

      {methodsQuery.isLoading ? (
        <LoadingView label="Chargement de vos moyens de paiement…" />
      ) : methodsQuery.isError ? (
        <ErrorView
          message={(methodsQuery.error as Error)?.message}
          onRetry={() => void methodsQuery.refetch()}
        />
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: spacing.lg,
            gap: spacing.xl,
            paddingBottom: 48,
          }}
        >
          {/* Registered numbers */}
          <FadeIn>
            <View style={{ gap: spacing.md }}>
              <AppText
                variant="small"
                color={colors.textFaint}
                style={{ letterSpacing: 1.5 }}
              >
                VOS NUMÉROS
              </AppText>
              {methods.length === 0 ? (
                <AppText variant="bodyMuted">
                  Aucun numéro enregistré. Ajoutez votre numéro Orange Money ou
                  MTN Money pour recevoir de l'argent de quiconque le connaît.
                </AppText>
              ) : (
                <View style={{ gap: spacing.sm }}>
                  {methods.map((method) => (
                    <PressableScale
                      key={method.id}
                      onPress={() => setDefaultMethod.mutate(method.id)}
                      scaleTo={0.98}
                      accessibilityLabel={`Définir ${formatPhone(method.phoneNumber)} par défaut`}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: spacing.md,
                          padding: spacing.md,
                          backgroundColor: colors.surface,
                          borderRadius: radii.xl,
                          borderWidth: method.isDefault ? 1.5 : 0,
                          borderColor: colors.primary,
                        }}
                      >
                        <View
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: radii.full,
                            backgroundColor: withAlpha(
                              colors.primary,
                              0.14,
                            ),
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <View
                            style={{
                              width: 14,
                              height: 14,
                              borderRadius: 7,
                              backgroundColor: PROVIDER_DOT[method.provider],
                            }}
                          />
                        </View>
                        <View style={{ flex: 1, gap: 1 }}>
                          <AppText
                            variant="subheading"
                            numberOfLines={1}
                          >
                            {formatPhone(method.phoneNumber)}
                          </AppText>
                          <AppText variant="small" color={colors.textFaint}>
                            {MOBILE_MONEY_LABELS[method.provider]}
                          </AppText>
                        </View>
                        {method.isDefault ? (
                          <View
                            style={{
                              paddingHorizontal: spacing.sm + 2,
                              paddingVertical: 4,
                              borderRadius: radii.full,
                              backgroundColor: withAlpha(colors.success, 0.14),
                            }}
                          >
                            <AppText
                              variant="small"
                              color={colors.success}
                              style={{ fontWeight: "700" }}
                            >
                              PAR DÉFAUT
                            </AppText>
                          </View>
                        ) : (
                          <AppText variant="small" color={colors.textFaint}>
                            Définir par défaut
                          </AppText>
                        )}
                        <IconButton
                          icon="trash-outline"
                          size={18}
                          color={colors.danger}
                          onPress={() => confirmRemove(method)}
                          accessibilityLabel={`Supprimer ${formatPhone(method.phoneNumber)}`}
                        />
                      </View>
                    </PressableScale>
                  ))}
                </View>
              )}
            </View>
          </FadeIn>

          {/* Add a number */}
          <FadeIn delay={80}>
            <View style={{ gap: spacing.md }}>
              <AppText
                variant="small"
                color={colors.textFaint}
                style={{ letterSpacing: 1.5 }}
              >
                AJOUTER UN NUMÉRO
              </AppText>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                {(["ORANGE_MONEY", "MTN_MONEY"] as const).map((option) => {
                  const active = provider === option;
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
                          height: 48,
                          borderRadius: radii.lg,
                          borderWidth: 1.5,
                          borderColor: active ? colors.primary : colors.border,
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
                            width: 11,
                            height: 11,
                            borderRadius: 5.5,
                            backgroundColor: PROVIDER_DOT[option],
                          }}
                        />
                        <AppText
                          style={{
                            fontSize: 12,
                            fontWeight: "600",
                            color: active ? colors.primary : colors.textMuted,
                          }}
                        >
                          {MOBILE_MONEY_LABELS[option]}
                        </AppText>
                      </View>
                    </PressableScale>
                  );
                })}
              </View>
              <Input
                placeholder="07 07 07 07 07 ou +225…"
                value={numberInput}
                onChangeText={(text) => {
                  setNumberInput(text);
                  setError(null);
                }}
                keyboardType="phone-pad"
                autoCapitalize="none"
                style={{
                  backgroundColor: colors.surfaceHighlight,
                  borderWidth: 0,
                }}
              />
              {error ? (
                <AppText style={{ color: colors.danger, fontSize: 13 }}>
                  {error}
                </AppText>
              ) : null}
              <Button
                label="Ajouter ce numéro"
                icon="add"
                onPress={add}
                loading={addMethod.isPending}
                disabled={busy}
              />
            </View>
          </FadeIn>

          {/* How receiving works */}
          <FadeIn delay={140}>
            <View
              style={{
                flexDirection: "row",
                gap: spacing.md,
                padding: spacing.md,
                backgroundColor: withAlpha(colors.primary, 0.08),
                borderRadius: radii.xl,
              }}
            >
              <Ionicons
                name="information-circle-outline"
                size={18}
                color={colors.primary}
              />
              <AppText variant="small" color={colors.textMuted} style={{ flex: 1 }}>
                Votre numéro est votre adresse Chuyassi Pay : quiconque le
                connaît peut vous envoyer de l'argent, crédité instantanément.
                Touchez un numéro pour le définir par défaut.
              </AppText>
            </View>
          </FadeIn>
        </ScrollView>
      )}
    </View>
  );
}
