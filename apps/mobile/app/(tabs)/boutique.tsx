import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  useCart,
  useCartMutations,
  useProductCategories,
  useProducts,
} from "@/hooks/use-market";
import {
  AppText,
  EmptyView,
  ErrorView,
  IconButton,
  Input,
  LoadingView,
} from "@/components/ui";
import { radii, spacing, withAlpha } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import { artworkGradient } from "@/utils/format";
import { formatMoney } from "@/utils/money";
import { API_URL } from "@/services/api/api-client";
import type { CartItem, ProductCard } from "@/types/market";

/** Icon fallback per category slug (categories without artwork). */
const CATEGORY_ICONS: Record<
  string,
  React.ComponentProps<typeof Ionicons>["name"]
> = {
  livres: "book-outline",
  audiobooks: "headset-outline",
  vetements: "shirt-outline",
  bijoux: "diamond-outline",
  chaussures: "walk-outline",
  merch: "color-palette-outline",
};

export default function BoutiqueScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const trimmed = search.trim();
  const categoriesQuery = useProductCategories();
  const productsQuery = useProducts({
    limit: 24,
    ...(trimmed ? { search: trimmed } : {}),
    ...(activeCategory ? { categoryId: activeCategory } : {}),
  });
  const cartQuery = useCart();
  const itemCount = cartQuery.data?.itemCount ?? 0;

  const products = productsQuery.data?.data ?? [];
  const featured = !trimmed && !activeCategory ? products[0] : undefined;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: insets.top,
      }}
    >
      {/* Header */}
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <AppText variant="title">Boutique</AppText>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <IconButton
              icon="receipt-outline"
              accessibilityLabel="Mes commandes"
              onPress={() => router.push("/boutique/orders")}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Panier"
              onPress={() => router.push("/boutique/cart")}
              style={{ position: "relative" }}
            >
              <Ionicons name="bag-outline" size={24} color={colors.text} />
              {itemCount > 0 ? (
                <View
                  style={{
                    position: "absolute",
                    top: -6,
                    right: -8,
                    minWidth: 18,
                    height: 18,
                    borderRadius: radii.full,
                    backgroundColor: colors.accent,
                    alignItems: "center",
                    justifyContent: "center",
                    paddingHorizontal: 4,
                  }}
                >
                  <AppText
                    style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}
                  >
                    {itemCount > 9 ? "9+" : itemCount}
                  </AppText>
                </View>
              ) : null}
            </Pressable>
          </View>
        </View>
        <Input
          placeholder="Rechercher un produit…"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          style={{ marginTop: spacing.md }}
        />
      </View>

      {/* Category circles — tap to filter, mockup style */}
      {categoriesQuery.data && categoriesQuery.data.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: spacing.lg }}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            gap: spacing.lg,
          }}
        >
          <CategoryCircle
            label="Tout"
            imageUrl={null}
            slug="all"
            active={activeCategory === null}
            onPress={() => setActiveCategory(null)}
          />
          {categoriesQuery.data.map((category) => (
            <CategoryCircle
              key={category.id}
              label={category.name}
              imageUrl={category.imageUrl}
              slug={category.slug}
              active={activeCategory === category.id}
              onPress={() => setActiveCategory(category.id)}
            />
          ))}
        </ScrollView>
      ) : null}

      {/* Products */}
      {productsQuery.isLoading ? (
        <LoadingView label="Chargement de la boutique…" />
      ) : productsQuery.isError ? (
        <ErrorView
          message={(productsQuery.error as Error)?.message}
          onRetry={() => void productsQuery.refetch()}
        />
      ) : products.length === 0 ? (
        <EmptyView
          title="Aucun produit"
          subtitle="Essayez une autre recherche ou catégorie."
        />
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: spacing.lg,
            paddingBottom: 140,
            gap: spacing.lg,
          }}
        >
          {featured ? <FeaturedCard product={featured} /> : null}

          {/* Promo band — mockup's "Share as One" banner slot */}
          {!trimmed && !activeCategory ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Découvrir Chuyassi Pay"
              onPress={() => router.push("/pay")}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                backgroundColor: withAlpha(colors.primary, 0.12),
                borderRadius: radii.xl,
                padding: spacing.lg,
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: radii.full,
                  backgroundColor: withAlpha(colors.primary, 0.18),
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons
                  name="wallet-outline"
                  size={22}
                  color={colors.primary}
                />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="subheading" numberOfLines={1}>
                  Payez avec Chuyassi Pay
                </AppText>
                <AppText
                  variant="caption"
                  color={colors.textMuted}
                  numberOfLines={2}
                >
                  Rechargez votre portefeuille et réglez vos achats en un geste.
                </AppText>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={colors.primary}
              />
            </Pressable>
          ) : null}

          <View
            style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}
          >
            {products.map((product) => (
              <ProductCardTile key={product.id} product={product} />
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

/** Mockup-style category bubble: round artwork, label under, ring when active. */
function CategoryCircle({
  label,
  imageUrl,
  slug,
  active,
  onPress,
}: {
  label: string;
  imageUrl: string | null;
  slug: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const uri = imageUrl
    ? imageUrl.startsWith("http")
      ? imageUrl
      : `${API_URL}${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`
    : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Catégorie ${label}`}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        gap: 6,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: radii.full,
          borderWidth: active ? 2 : 1,
          borderColor: active ? colors.primary : colors.border,
          backgroundColor: active
            ? withAlpha(colors.primary, 0.12)
            : colors.surface,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {uri ? (
          <Image
            source={{ uri }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
          />
        ) : (
          <Ionicons
            name={CATEGORY_ICONS[slug] ?? "grid-outline"}
            size={26}
            color={active ? colors.primary : colors.textMuted}
          />
        )}
      </View>
      <AppText
        numberOfLines={1}
        style={{
          maxWidth: 72,
          fontSize: 11,
          fontWeight: active ? "700" : "500",
          color: active ? colors.primary : colors.textMuted,
        }}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

function FeaturedCard({ product }: { product: ProductCard }) {
  const { colors } = useTheme();
  const image = product.images[0]?.url;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/boutique/${product.id}`)}
      style={{ marginBottom: -spacing.md }}
    >
      <View
        style={{
          flexDirection: "row",
          backgroundColor: colors.surface,
          borderRadius: radii.lg,
          overflow: "hidden",
        }}
      >
        {image ? (
          <Image
            source={{
              uri: image.startsWith("http") ? image : `${API_URL}${image}`,
            }}
            style={{ width: 130, height: 130 }}
            contentFit="cover"
          />
        ) : (
          <View
            style={{
              width: 130,
              height: 130,
              backgroundColor: colors.primaryTint,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="sparkles" size={30} color={colors.primary} />
          </View>
        )}
        <View
          style={{
            flex: 1,
            padding: spacing.lg,
            gap: 4,
            justifyContent: "center",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.xs,
            }}
          >
            <Ionicons
              name={product.type === "DIGITAL" ? "download" : "cube-outline"}
              size={12}
              color={colors.accent}
            />
            <AppText variant="small" color={colors.accent}>
              {product.type === "DIGITAL"
                ? "PRODUIT DIGITAL"
                : "PRODUIT PHYSIQUE"}
            </AppText>
          </View>
          <AppText variant="subheading" numberOfLines={2}>
            {product.name}
          </AppText>
          <AppText variant="small" color={colors.textFaint} numberOfLines={1}>
            par {product.seller.name}
          </AppText>
          <AppText variant="subheading" color={colors.accent}>
            {formatMoney(product.price, product.currency)}
          </AppText>
        </View>
      </View>
    </Pressable>
  );
}

function ProductCardTile({ product }: { product: ProductCard }) {
  const { colors } = useTheme();
  const image = product.images[0]?.url;
  const { from, to } = artworkGradient(product.id);
  const outOfStock =
    product.type === "PHYSICAL" && product.stock != null && product.stock <= 0;
  const cart = useCart();
  const { addItem, updateItem, removeItem } = useCartMutations();

  /** Live cart quantity for this product (default-variant line). */
  const cartItem: CartItem | undefined = cart.data?.items.find(
    (item) => item.productId === product.id && item.variantId === null,
  );
  const quantity = cartItem?.quantity ?? 0;
  const busy =
    addItem.isPending || updateItem.isPending || removeItem.isPending;

  function increment() {
    addItem.mutate({ productId: product.id, quantity: 1 });
  }

  function decrement() {
    if (!cartItem) return;
    if (cartItem.quantity <= 1) removeItem.mutate(cartItem.id);
    else
      updateItem.mutate({
        itemId: cartItem.id,
        quantity: cartItem.quantity - 1,
      });
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/boutique/${product.id}`)}
      style={({ pressed }) => ({
        width: "47.5%",
        gap: spacing.sm,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <View
        style={{
          borderRadius: radii.lg,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {image ? (
          <Image
            source={{
              uri: image.startsWith("http") ? image : `${API_URL}${image}`,
            }}
            style={{ width: "100%", height: 140 }}
            contentFit="cover"
          />
        ) : (
          <View
            style={{
              width: "100%",
              height: 140,
              backgroundColor: `${to}33`,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="albums-outline" size={34} color={from} />
          </View>
        )}
        {outOfStock ? (
          <View
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: "rgba(0,0,0,0.65)",
              paddingVertical: 4,
            }}
          >
            <AppText
              style={{
                color: "#fff",
                fontSize: 11,
                fontWeight: "700",
                textAlign: "center",
              }}
            >
              Épuisé
            </AppText>
          </View>
        ) : null}
      </View>
      <View style={{ gap: 2 }}>
        <AppText
          variant="subheading"
          numberOfLines={2}
          style={{ fontSize: 14 }}
        >
          {product.name}
        </AppText>
        <AppText variant="small" color={colors.textFaint} numberOfLines={1}>
          {product.seller.name}
        </AppText>
        <AppText
          style={{ color: colors.accent, fontWeight: "800", fontSize: 15 }}
        >
          {formatMoney(product.price, product.currency)}
        </AppText>
      </View>
      {/* Mockup stepper: − qty + , wired to the live cart */}
      {!outOfStock ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            alignSelf: "flex-start",
            backgroundColor: colors.primary,
            borderRadius: radii.full,
            padding: 2,
            gap: 2,
            opacity: busy ? 0.7 : 1,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Retirer une unité de ${product.name}`}
            disabled={busy || quantity === 0}
            onPress={decrement}
            style={{
              width: 26,
              height: 26,
              alignItems: "center",
              justifyContent: "center",
              opacity: quantity === 0 ? 0.5 : 1,
            }}
          >
            <Ionicons name="remove" size={16} color="#FFFFFF" />
          </Pressable>
          <AppText
            style={{
              minWidth: 18,
              textAlign: "center",
              fontSize: 12,
              fontWeight: "800",
              color: "#FFFFFF",
              fontVariant: ["tabular-nums"],
            }}
          >
            {quantity}
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Ajouter ${product.name} au panier`}
            disabled={busy}
            onPress={increment}
            style={{
              width: 26,
              height: 26,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="add" size={16} color="#FFFFFF" />
          </Pressable>
        </View>
      ) : null}
    </Pressable>
  );
}
