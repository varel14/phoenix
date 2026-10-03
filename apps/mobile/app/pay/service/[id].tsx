import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { usePaymentService, useInitiatePayment, useDevConfirmPayment } from "@/hooks/use-payments";
import { AppText, Button, ErrorView, IconButton, Input, LoadingView } from "@/components/ui";
import { radii, spacing } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import { formatMoney } from "@/utils/money";
import type { InitiatePaymentResult, PaymentServiceField } from "@/types/payments";

type Step = "form" | "verify" | "paying" | "done";

export default function PayServiceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const serviceQuery = usePaymentService(id);
  const initiate = useInitiatePayment();
  const devConfirm = useDevConfirmPayment();

  const [step, setStep] = useState<Step>("form");
  const [values, setValues] = useState<Record<string, string>>({});
  const [amountInput, setAmountInput] = useState("");
  const [result, setResult] = useState<InitiatePaymentResult | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const service = serviceQuery.data;
  const needsAmount = service?.pricingMode !== "FIXED";

  const missingRequired = useMemo(() => {
    if (!service) return true;
    return service.fields.some((field) => field.required && !values[field.key]?.trim());
  }, [service, values]);

  if (serviceQuery.isLoading) return <LoadingView label="Chargement du service…" />;
  if (serviceQuery.isError || !service) {
    return <ErrorView message={(serviceQuery.error as Error)?.message} onRetry={() => void serviceQuery.refetch()} />;
  }

  const amount = needsAmount ? Number.parseInt(amountInput.replace(/\s/g, ""), 10) : service.fixedPrice ?? 0;
  const amountValid = Number.isFinite(amount) && amount >= (service.minPrice ?? 100);

  function updateField(key: string, value: string) {
    setValues((previous) => ({ ...previous, [key]: value }));
  }

  function goToVerify() {
    if (missingRequired || (needsAmount && !amountValid)) {
      setError(needsAmount ? "Veuillez renseigner tous les champs obligatoires et un montant valide." : "Veuillez renseigner tous les champs obligatoires.");
      return;
    }
    setError(null);
    setStep("verify");
  }

  function payNow() {
    if (!amountValid) return;
    setError(null);
    setStep("paying");
    initiate.mutate(
      {
        serviceId: service!.id,
        ...(needsAmount ? { amount } : {}),
        fields: values,
      },
      {
        onSuccess: (data) => setResult(data),
        onError: (mutationError) => {
          setError((mutationError as Error).message);
          setStep("form");
        },
      },
    );
  }

  /** Development flow only: confirm through the server-side pipeline. */
  function confirmPayment() {
    if (!result) return;
    devConfirm.mutate(result.transaction.reference, {
      onSuccess: () => setConfirmed(true),
      onError: (mutationError) => setError((mutationError as Error).message),
    });
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
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
          onPress={() => (step === "form" ? router.back() : setStep("form"))}
          accessibilityLabel="Retour"
        />
        <View style={{ flex: 1, paddingRight: 40 }}>
          <AppText variant="subheading" numberOfLines={1}>
            {step === "verify" ? "Vérification" : service.name}
          </AppText>
          <AppText variant="small" color={colors.textFaint}>
            {service.category.name}
          </AppText>
        </View>
      </View>

      {step === "form" ? (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 120 }}>
          {service.description ? (
            <View style={{ backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg }}>
              <AppText variant="bodyMuted">{service.description}</AppText>
            </View>
          ) : null}

          {needsAmount ? (
            <View style={{ gap: spacing.sm }}>
              <AppText variant="subheading">Montant à payer</AppText>
              <Input
                placeholder={`Minimum ${formatMoney(service.minPrice ?? 100, service.currency)}`}
                value={amountInput}
                onChangeText={setAmountInput}
                keyboardType="number-pad"
              />
            </View>
          ) : (
            <View style={{ backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg, flexDirection: "row", justifyContent: "space-between" }}>
              <AppText variant="subheading">Montant</AppText>
              <AppText variant="subheading" color={colors.accent}>
                {formatMoney(service.fixedPrice ?? 0, service.currency)}
              </AppText>
            </View>
          )}

          {service.fields.length > 0 ? (
            <View style={{ gap: spacing.md }}>
              <AppText variant="subheading">Informations requises</AppText>
              {service.fields.map((field) => (
                <ServiceFieldInput key={field.id} field={field} value={values[field.key] ?? ""} onChange={(value) => updateField(field.key, value)} />
              ))}
            </View>
          ) : null}

          {error ? <AppText style={{ color: colors.danger, fontSize: 13 }}>{error}</AppText> : null}
          <Button label="Vérifier" onPress={goToVerify} disabled={missingRequired || (needsAmount && !amountValid)} />
        </ScrollView>
      ) : null}

      {step === "verify" ? (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 120 }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.md }}>
            <SummaryRow label="Service" value={service.name} />
            <SummaryRow label="Montant" value={formatMoney(amount, service.currency)} />
            {service.fields.map((field) =>
              values[field.key] ? <SummaryRow key={field.id} label={field.label} value={values[field.key] ?? ""} /> : null,
            )}
          </View>
          <AppText variant="bodyMuted" align="center">
            Vérifiez les informations avant de payer. Le paiement est confirmé uniquement par le serveur.
          </AppText>
          {error ? <AppText style={{ color: colors.danger, fontSize: 13 }}>{error}</AppText> : null}
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Button label="Modifier" variant="secondary" onPress={() => setStep("form")} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="Payer maintenant" onPress={payNow} />
            </View>
          </View>
        </ScrollView>
      ) : null}

      {step === "paying" || step === "done" ? (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingTop: spacing.xxl }}>
          <View style={{ alignItems: "center", gap: spacing.md }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: radii.full,
                backgroundColor: confirmed ? colors.success : colors.primaryTint,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name={confirmed ? "checkmark" : "hourglass"} size={34} color={confirmed ? "#fff" : colors.primary} />
            </View>
            <AppText variant="heading">{confirmed ? "Paiement confirmé" : "Paiement en attente"}</AppText>
            {result ? (
              <>
                <AppText variant="bodyMuted" align="center">
                  {confirmed
                    ? "Votre paiement a été confirmé par le serveur."
                    : result.instructions ?? "Votre paiement est en attente de confirmation."}
                </AppText>
                <View style={{ backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.sm, alignSelf: "stretch" }}>
                  <SummaryRow label="Référence" value={result.transaction.reference} />
                  <SummaryRow label="Montant" value={formatMoney(result.transaction.amount, result.transaction.currency)} />
                </View>
              </>
            ) : (
              <LoadingView label="Initialisation du paiement…" />
            )}
            {error ? <AppText style={{ color: colors.danger, fontSize: 13 }}>{error}</AppText> : null}
            {result && !confirmed ? (
              <Button label="Confirmer le paiement (démo)" variant="secondary" onPress={confirmPayment} loading={devConfirm.isPending} />
            ) : null}
            {confirmed ? (
              <View style={{ gap: spacing.md, alignSelf: "stretch" }}>
                <Button label="Voir le reçu" onPress={() => router.replace(`/pay/receipt/${result!.transaction.id}`)} />
                <Button label="Retour à l'accueil" variant="ghost" onPress={() => router.dismissAll()} />
              </View>
            ) : null}
          </View>
        </ScrollView>
      ) : null}
    </KeyboardAvoidingView>
  );
}

function ServiceFieldInput({
  field,
  value,
  onChange,
}: {
  field: PaymentServiceField;
  value: string;
  onChange: (value: string) => void;
}) {
  const { colors } = useTheme();

  return (
    <View style={{ gap: 6 }}>
      <AppText variant="bodyMuted">
        {field.label}
        {field.required ? " *" : ""}
      </AppText>
      {field.type === "SELECT" && field.options && field.options.length > 0 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {field.options.map((option) => (
            <Pressable
              key={option}
              accessibilityRole="button"
              onPress={() => onChange(option)}
              style={{
                paddingHorizontal: spacing.lg,
                height: 36,
                borderRadius: radii.full,
                backgroundColor: value === option ? colors.primary : colors.surface,
                borderWidth: 1,
                borderColor: value === option ? colors.primary : colors.border,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <AppText style={{ color: value === option ? colors.onPrimary : colors.textMuted, fontSize: 13, fontWeight: "600" }}>
                {option}
              </AppText>
            </Pressable>
          ))}
        </View>
      ) : (
        <Input
          value={value}
          onChangeText={onChange}
          placeholder={field.placeholder ?? undefined}
          keyboardType={field.type === "NUMBER" || field.type === "PHONE" ? "number-pad" : field.type === "EMAIL" ? "email-address" : "default"}
          autoCapitalize={field.type === "TEXT" ? "words" : "none"}
        />
      )}
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.lg }}>
      <AppText variant="bodyMuted">{label}</AppText>
      <AppText style={{ fontWeight: "600", flexShrink: 1, textAlign: "right" }}>
        {value}
      </AppText>
    </View>
  );
}
