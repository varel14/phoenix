import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useCart, useCreateOrder } from "@/hooks/use-market";
import { useDevConfirmPayment } from "@/hooks/use-payments";
import { AppText, Button, ErrorView, IconButton, Input, LoadingView } from "@/components/ui";
import { radii, spacing } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import { formatMoney } from "@/utils/money";
import type { ShippingAddressInput } from "@/types/market";

type Step = "infos" | "recap" | "paiement" | "confirmation";

export default function CheckoutScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const cartQuery = useCart();
  const createOrder = useCreateOrder();
  const devConfirm = useDevConfirmPayment();
  const cart = cartQuery.data;

  const [step, setStep] = useState<Step>("infos");
  const [address, setAddress] = useState<ShippingAddressInput>({
    recipientName: "",
    phone: "",
    city: "",
    area: "",
    addressLine: "",
    instructions: "",
  });
  const [orderRef, setOrderRef] = useState<string | null>(null);
  const [payRef, setPayRef] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (cartQuery.isLoading) return <LoadingView label="Chargement du panier…" />;
  if (cartQuery.isError) {
    return <ErrorView message={(cartQuery.error as Error)?.message} onRetry={() => void cartQuery.refetch()} />;
  }
  if (!cart || cart.items.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
        <BackHeader title="Livraison" />
        <LoadingView />
      </View>
    );
  }

  const requiresShipping = cart.requiresShipping;
  const addressValid =
    address.recipientName.trim().length >= 2 && address.phone.trim().length >= 8 && address.city.trim().length >= 2;

  function submitOrder() {
    setError(null);
    createOrder.mutate(requiresShipping ? address : undefined, {
      onSuccess: (data) => {
        setOrderRef(data.order.reference);
        setPayRef(data.transaction.reference);
        setStep("paiement");
      },
      onError: (mutationError) => setError((mutationError as Error).message),
    });
  }

  function confirmPayment() {
    if (!payRef) return;
    devConfirm.mutate(payRef, {
      onSuccess: () => {
        setPaid(true);
        setStep("confirmation");
      },
      onError: (mutationError) => setError((mutationError as Error).message),
    });
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <BackHeader title={step === "infos" ? "Informations" : step === "recap" ? "Récapitulatif" : step === "paiement" ? "Paiement" : "Confirmation"} />

      {/* Stepper */}
      <View style={{ flexDirection: "row", paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm }}>
        {(["infos", "recap", "paiement", "confirmation"] as Step[]).map((entry, index) => {
          const activeIndex = ["infos", "recap", "paiement", "confirmation"].indexOf(step);
          const done = index < activeIndex;
          const active = entry === step;
          return (
            <View key={entry} style={{ flex: 1, height: 4, borderRadius: radii.full, backgroundColor: done || active ? colors.primary : colors.surfaceHighlight }} />
          );
        })}
      </View>

      {step === "infos" ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 120 }}>
          {!requiresShipping ? (
            <View style={{ backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.sm, flexDirection: "row" }}>
              <Ionicons name="download" size={20} color={colors.accent} />
              <AppText variant="bodyMuted" style={{ flex: 1 }}>
                Votre panier ne contient que des produits digitaux — aucune adresse de livraison n'est nécessaire.
              </AppText>
            </View>
          ) : (
            <>
              <AppText variant="subheading">Adresse de livraison</AppText>
              <Input placeholder="Nom du destinataire *" value={address.recipientName} onChangeText={(value) => setAddress((previous) => ({ ...previous, recipientName: value }))} />
              <Input placeholder="Téléphone *" value={address.phone} onChangeText={(value) => setAddress((previous) => ({ ...previous, phone: value }))} keyboardType="phone-pad" />
              <Input placeholder="Ville *" value={address.city} onChangeText={(value) => setAddress((previous) => ({ ...previous, city: value }))} />
              <Input placeholder="Quartier" value={address.area} onChangeText={(value) => setAddress((previous) => ({ ...previous, area: value }))} />
              <Input placeholder="Adresse / indication" value={address.addressLine} onChangeText={(value) => setAddress((previous) => ({ ...previous, addressLine: value }))} />
              <Input placeholder="Informations complémentaires" value={address.instructions} onChangeText={(value) => setAddress((previous) => ({ ...previous, instructions: value }))} />
            </>
          )}
          {error ? <AppText style={{ color: colors.danger, fontSize: 13 }}>{error}</AppText> : null}
          <Button label="Continuer" onPress={() => setStep("recap")} disabled={requiresShipping && !addressValid} />
        </ScrollView>
      ) : null}

      {step === "recap" ? (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 120 }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.md }}>
            <AppText variant="subheading">Votre commande</AppText>
            {cart.items.map((item) => (
              <View key={item.id} style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.md }}>
                <AppText variant="body" numberOfLines={1} style={{ flex: 1 }}>
                  {item.quantity} × {item.product.name}
                  {item.variant ? ` (${item.variant.name})` : ""}
                </AppText>
                <AppText style={{ fontWeight: "600" }}>
                  {formatMoney((item.variant?.priceOverride ?? item.product.price) * item.quantity, cart.currency)}
                </AppText>
              </View>
            ))}
            <View style={{ height: 1, borderTopWidth: 1, borderTopColor: colors.border }} />
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <AppText variant="bodyMuted">Sous-total</AppText>
              <AppText>{formatMoney(cart.subtotal, cart.currency)}</AppText>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <AppText variant="bodyMuted">Livraison</AppText>
              <AppText>{cart.requiresShipping ? "À confirmer" : "—"}</AppText>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <AppText variant="subheading">Total</AppText>
              <AppText variant="subheading" color={colors.accent}>
                {formatMoney(cart.subtotal, cart.currency)}
              </AppText>
            </View>
          </View>

          {requiresShipping ? (
            <View style={{ backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg, gap: 6 }}>
              <AppText variant="subheading">Livraison</AppText>
              <AppText variant="bodyMuted">{address.recipientName}</AppText>
              <AppText variant="bodyMuted">
                {address.addressLine ? `${address.addressLine}, ` : ""}
                {address.area ? `${address.area}, ` : ""}
                {address.city}
              </AppText>
              <AppText variant="bodyMuted">{address.phone}</AppText>
              <Pressable onPress={() => setStep("infos")}>
                <AppText style={{ color: colors.primary, fontWeight: "600", marginTop: 4 }}>Modifier</AppText>
              </Pressable>
            </View>
          ) : null}

          {error ? <AppText style={{ color: colors.danger, fontSize: 13 }}>{error}</AppText> : null}
          <Button label="Passer au paiement" onPress={submitOrder} loading={createOrder.isPending} />
        </ScrollView>
      ) : null}

      {step === "paiement" ? (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingTop: spacing.xxl }}>
          <View style={{ alignItems: "center", gap: spacing.md }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: radii.full,
                backgroundColor: colors.primaryTint,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="card" size={32} color={colors.primary} />
            </View>
            <AppText variant="heading">Paiement en attente</AppText>
            {orderRef ? <AppText variant="bodyMuted">Commande {orderRef}</AppText> : null}
            <AppText variant="bodyMuted" align="center">
              La commande sera confirmée uniquement après validation du paiement par le serveur.
            </AppText>
            <View style={{ backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg, alignSelf: "stretch" }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <AppText variant="bodyMuted">À payer</AppText>
                <AppText variant="subheading" color={colors.accent}>
                  {formatMoney(cart.subtotal, cart.currency)}
                </AppText>
              </View>
            </View>
            {error ? <AppText style={{ color: colors.danger, fontSize: 13 }}>{error}</AppText> : null}
            <Button label="Confirmer le paiement (démo)" onPress={confirmPayment} loading={devConfirm.isPending} />
          </View>
        </ScrollView>
      ) : null}

      {step === "confirmation" ? (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingTop: spacing.xxl }}>
          <View style={{ alignItems: "center", gap: spacing.md }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: radii.full,
                backgroundColor: colors.success,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="checkmark" size={34} color="#fff" />
            </View>
            <AppText variant="title">Commande confirmée</AppText>
            {orderRef ? (
              <AppText variant="bodyMuted" align="center">
                Merci ! Votre commande {orderRef} est confirmée.
                {cart.requiresShipping ? " Elle sera préparée pour l'expédition." : " Vos contenus digitaux sont disponibles dans vos commandes."}
              </AppText>
            ) : null}
            <View style={{ gap: spacing.md, alignSelf: "stretch" }}>
              <Button label="Voir mes commandes" onPress={() => router.replace("/boutique/orders")} />
              <Button label="Retour à la Boutique" variant="ghost" onPress={() => router.dismissAll()} />
            </View>
          </View>
        </ScrollView>
      ) : null}
    </View>
  );
}

function BackHeader({ title }: { title: string }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.sm, paddingTop: spacing.xs, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <IconButton icon="chevron-back" onPress={() => router.back()} accessibilityLabel="Retour" />
      <AppText variant="heading" style={{ flex: 1, textAlign: "center", marginRight: 40 }}>
        {title}
      </AppText>
    </View>
  );
}
