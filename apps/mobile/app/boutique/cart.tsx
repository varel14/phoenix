import { Pressable, ScrollView, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useCart, useCartMutations } from "@/hooks/use-market";
import { AppText, Button, EmptyView, ErrorView, IconButton, LoadingView } from "@/components/ui";
import { radii, spacing } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import { formatMoney } from "@/utils/money";
import { API_URL } from "@/services/api/api-client";
import type { CartItem } from "@/types/market";

export default function CartScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const cartQuery = useCart();
  const { updateItem, removeItem, clear } = useCartMutations();
  const cart = cartQuery.data;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.sm, paddingTop: spacing.xs, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <IconButton icon="chevron-back" onPress={() => router.back()} accessibilityLabel="Retour" />
        <AppText variant="heading" style={{ flex: 1, textAlign: "center" }}>
          Panier
        </AppText>
        {cart && cart.items.length > 0 ? (
          <Pressable accessibilityRole="button" onPress={() => clear.mutate()}>
            <AppText variant="small" color={colors.danger} style={{ marginRight: spacing.md }}>
              Vider
            </AppText>
          </Pressable>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {cartQuery.isLoading ? (
        <LoadingView label="Chargement du panier…" />
      ) : cartQuery.isError ? (
        <ErrorView message={(cartQuery.error as Error)?.message} onRetry={() => void cartQuery.refetch()} />
      ) : !cart || cart.items.length === 0 ? (
        <EmptyView title="Votre panier est vide" subtitle="Parcourez la Boutique et ajoutez vos produits favoris." />
      ) : (
        <View style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 160 }}>
            {cart.items.map((item) => (
              <CartRow
                key={item.id}
                item={item}
                onQuantity={(quantity) => updateItem.mutate({ itemId: item.id, quantity })}
                onRemove={() => removeItem.mutate(item.id)}
                busy={updateItem.isPending || removeItem.isPending}
              />
            ))}
          </ScrollView>

          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              padding: spacing.lg,
              paddingBottom: insets.bottom + spacing.sm,
              backgroundColor: colors.background,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              gap: spacing.md,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <AppText variant="subheading">
                Sous-total · {cart.itemCount} article{cart.itemCount > 1 ? "s" : ""}
              </AppText>
              <AppText variant="heading" color={colors.accent}>
                {formatMoney(cart.subtotal, cart.currency)}
              </AppText>
            </View>
            <Button label="Passer la commande" onPress={() => router.push("/boutique/checkout")} />
          </View>
        </View>
      )}
    </View>
  );
}

function CartRow({
  item,
  onQuantity,
  onRemove,
  busy,
}: {
  item: CartItem;
  onQuantity: (quantity: number) => void;
  onRemove: () => void;
  busy: boolean;
}) {
  const { colors } = useTheme();
  const image = item.product.images[0]?.url;
  const unitPrice = item.variant?.priceOverride ?? item.product.price;
  const maxQuantity = item.product.type === "PHYSICAL" && item.variant?.stock != null ? item.variant.stock : item.product.type === "PHYSICAL" && item.product.stock != null ? item.product.stock : 99;

  return (
    <View style={{ flexDirection: "row", gap: spacing.md, backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.md }}>
      {image ? (
        <Image
          source={{ uri: image.startsWith("http") ? image : `${API_URL}${image}` }}
          style={{ width: 72, height: 72, borderRadius: radii.md }}
          contentFit="cover"
        />
      ) : (
        <View style={{ width: 72, height: 72, borderRadius: radii.md, backgroundColor: colors.primaryTint, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="albums-outline" size={26} color={colors.primary} />
        </View>
      )}

      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="subheading" numberOfLines={2}>
              {item.product.name}
            </AppText>
            {item.variant ? <AppText variant="small" color={colors.textFaint}>Option : {item.variant.name}</AppText> : null}
            <AppText variant="small" color={item.product.type === "DIGITAL" ? colors.accent : colors.textFaint}>
              {item.product.type === "DIGITAL" ? "Digital" : "Physique"}
            </AppText>
          </View>
          <IconButton icon="trash-outline" size={20} color={colors.danger} onPress={onRemove} disabled={busy} accessibilityLabel="Retirer du panier" />
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <IconButton
              icon="remove-circle-outline"
              size={24}
              disabled={busy || item.quantity <= 1}
              onPress={() => onQuantity(Math.max(1, item.quantity - 1))}
              accessibilityLabel="Diminuer"
            />
            <AppText style={{ fontWeight: "700", minWidth: 22, textAlign: "center" }}>{item.quantity}</AppText>
            <IconButton
              icon="add-circle-outline"
              size={24}
              disabled={busy || item.quantity >= maxQuantity}
              onPress={() => onQuantity(Math.min(maxQuantity, item.quantity + 1))}
              accessibilityLabel="Augmenter"
            />
          </View>
          <AppText variant="subheading" color={colors.accent}>
            {formatMoney(unitPrice * item.quantity, item.product.currency)}
          </AppText>
        </View>
      </View>
    </View>
  );
}
