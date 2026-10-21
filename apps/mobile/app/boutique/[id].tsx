import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useCartMutations, useProduct } from "@/hooks/use-market";
import { AppText, Button, ErrorView, IconButton, LoadingView } from "@/components/ui";
import { radii, spacing } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import { formatMoney } from "@/utils/money";
import { API_URL } from "@/services/api/api-client";
import type { ProductVariant } from "@/types/market";

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const productQuery = useProduct(id);
  const { addItem } = useCartMutations();

  const [selectedImage, setSelectedImage] = useState(0);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const product = productQuery.data;
  const requiresVariant = (product?.variants.length ?? 0) > 0;
  const variant = useMemo(() => product?.variants.find((entry) => entry.id === variantId) ?? null, [product, variantId]);

  if (productQuery.isLoading) return <LoadingView label="Chargement du produit…" />;
  if (productQuery.isError || !product) {
    return <ErrorView message={(productQuery.error as Error)?.message} onRetry={() => void productQuery.refetch()} />;
  }

  const effectivePrice = variant?.priceOverride ?? product.price;
  const stock = variant ? variant.stock : product.stock;
  const isDigital = product.type === "DIGITAL";
  const soldOut = !isDigital && (stock != null ? stock <= 0 : true);
  const maxQuantity = !isDigital && stock != null ? stock : 99;
  const canAdd = !soldOut && (!requiresVariant || Boolean(variantId)) && quantity >= 1;

  function addToCart() {
    if (!canAdd) return;
    setError(null);
    setMessage(null);
    addItem.mutate(
      { productId: product!.id, quantity, ...(variantId ? { variantId } : {}) },
      {
        onSuccess: () => setMessage("Produit ajouté au panier."),
        onError: (mutationError) => setError((mutationError as Error).message),
      },
    );
  }

  function buyNow() {
    if (!canAdd) return;
    addItem.mutate(
      { productId: product!.id, quantity, ...(variantId ? { variantId } : {}) },
      { onSuccess: () => router.push("/boutique/cart") },
    );
  }

  const images = product.images.length > 0 ? product.images : [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 160 }}>
        {/* Image carousel */}
        <View>
          {images.length > 0 ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(event) => setSelectedImage(Math.round(event.nativeEvent.contentOffset.x / (event.nativeEvent.layoutMeasurement.width)))}
            >
              {images.map((image) => {
                const uri = image.url.startsWith("http") ? image.url : `${API_URL}${image.url}`;
                return <Image key={image.id} source={{ uri }} style={{ width: 400, height: 340 }} contentFit="cover" />;
              })}
            </ScrollView>
          ) : (
            <View style={{ height: 240, backgroundColor: colors.primaryTint, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="albums-outline" size={54} color={colors.primary} />
            </View>
          )}
          {/* Back over the image */}
          <View style={{ position: "absolute", top: insets.top + spacing.xs, left: spacing.sm }}>
            <IconButton
              icon="chevron-back"
              onPress={() => router.back()}
              accessibilityLabel="Retour"
              style={{ backgroundColor: "rgba(0,0,0,0.4)", borderRadius: radii.full }}
              color="#fff"
            />
          </View>
          {images.length > 1 ? (
            <View style={{ position: "absolute", bottom: spacing.md, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 6 }}>
              {images.map((image, index) => (
                <View
                  key={image.id}
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: radii.full,
                    backgroundColor: index === selectedImage ? colors.accent : "rgba(255,255,255,0.5)",
                  }}
                />
              ))}
            </View>
          ) : null}
        </View>

        <View style={{ padding: spacing.lg, gap: spacing.lg }}>
          {/* Title + price */}
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <Ionicons name={isDigital ? "download" : "cube-outline"} size={14} color={colors.accent} />
              <AppText variant="small" color={colors.accent}>
                {isDigital ? "PRODUIT DIGITAL" : "PRODUIT PHYSIQUE"} · {product.category.name}
              </AppText>
            </View>
            <AppText variant="title">{product.name}</AppText>
            <AppText variant="heading" color={colors.accent}>
              {formatMoney(effectivePrice, product.currency)}
            </AppText>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              {product.seller.isVerified ? <Ionicons name="checkmark-circle" size={14} color={colors.primary} /> : null}
              <AppText variant="bodyMuted">Vendu par {product.seller.name}</AppText>
            </View>
          </View>

          {/* Stock state */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              backgroundColor: colors.surface,
              borderRadius: radii.md,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
            }}
          >
            <Ionicons
              name={soldOut ? "close-circle" : isDigital ? "infinite" : "checkmark-circle"}
              size={18}
              color={soldOut ? colors.danger : colors.success}
            />
            <AppText variant="bodyMuted">
              {soldOut
                ? "Rupture de stock"
                : isDigital
                  ? product.downloadLimit != null
                    ? `Disponible immédiatement · ${product.downloadLimit} téléchargements autorisés`
                    : "Disponible immédiatement après paiement"
                  : stock != null
                    ? `${stock} en stock`
                    : "Disponible"}
            </AppText>
          </View>

          {/* Description */}
          {product.description ? <AppText variant="bodyMuted">{product.description}</AppText> : null}

          {/* Variants */}
          {requiresVariant ? (
            <View style={{ gap: spacing.md }}>
              <AppText variant="subheading">Choisir une option</AppText>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                {product.variants.map((entry) => (
                  <VariantChip
                    key={entry.id}
                    variant={entry}
                    selected={variantId === entry.id}
                    currency={product.currency}
                    onPress={() => setVariantId(entry.id === variantId ? null : entry.id)}
                  />
                ))}
              </View>
              {!variantId ? <AppText variant="small" color={colors.textFaint}>Sélectionnez une option pour continuer.</AppText> : null}
            </View>
          ) : null}

          {/* Quantity */}
          {!isDigital ? (
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <AppText variant="subheading">Quantité</AppText>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <IconButton
                  icon="remove-circle-outline"
                  size={26}
                  disabled={quantity <= 1}
                  onPress={() => setQuantity((value) => Math.max(1, value - 1))}
                  accessibilityLabel="Diminuer la quantité"
                />
                <AppText variant="subheading" style={{ minWidth: 28, textAlign: "center" }}>
                  {quantity}
                </AppText>
                <IconButton
                  icon="add-circle-outline"
                  size={26}
                  disabled={quantity >= maxQuantity}
                  onPress={() => setQuantity((value) => Math.min(maxQuantity, value + 1))}
                  accessibilityLabel="Augmenter la quantité"
                />
              </View>
            </View>
          ) : null}

          {message ? <AppText style={{ color: colors.success, fontSize: 13 }}>{message}</AppText> : null}
          {error ? <AppText style={{ color: colors.danger, fontSize: 13 }}>{error}</AppText> : null}
        </View>
      </ScrollView>

      {/* Bottom CTA */}
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
        {isDigital && !requiresVariant ? (
          <Button label="Acheter maintenant" onPress={buyNow} disabled={!canAdd || addItem.isPending} loading={addItem.isPending} />
        ) : null}
        <Button
          label="Ajouter au panier"
          variant={isDigital && !requiresVariant ? "secondary" : "primary"}
          onPress={addToCart}
          disabled={!canAdd || addItem.isPending}
        />
      </View>
    </View>
  );
}

function VariantChip({
  variant,
  selected,
  currency,
  onPress,
}: {
  variant: ProductVariant;
  selected: boolean;
  currency: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const outOfStock = variant.stock != null && variant.stock <= 0;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={outOfStock}
      style={{
        paddingHorizontal: spacing.lg,
        height: 40,
        borderRadius: radii.md,
        backgroundColor: selected ? colors.primary : colors.surface,
        borderWidth: 1,
        borderColor: selected ? colors.primary : colors.border,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 6,
        opacity: outOfStock ? 0.4 : 1,
      }}
    >
      <AppText style={{ color: selected ? colors.onPrimary : colors.text, fontWeight: "700", fontSize: 14 }}>
        {variant.name}
      </AppText>
      {variant.priceOverride != null ? (
        <AppText style={{ color: selected ? colors.onGradientMuted : colors.textFaint, fontSize: 12 }}>
          {formatMoney(variant.priceOverride, currency)}
        </AppText>
      ) : null}
      {outOfStock ? <AppText style={{ color: colors.danger, fontSize: 11 }}>épuisé</AppText> : null}
    </Pressable>
  );
}
