import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useCart, useProductCategories, useProducts } from "@/hooks/use-market";
import { AppText, EmptyView, ErrorView, IconButton, Input, LoadingView } from "@/components/ui";
import { radii, spacing } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import { artworkGradient } from "@/utils/format";
import { formatMoney } from "@/utils/money";
import { API_URL } from "@/services/api/api-client";
import type { ProductCard } from "@/types/market";

export default function BoutiqueScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<"PHYSICAL" | "DIGITAL" | null>(null);

  const trimmed = search.trim();
  const categoriesQuery = useProductCategories();
  const productsQuery = useProducts({
    limit: 24,
    ...(trimmed ? { search: trimmed } : {}),
    ...(activeCategory ? { categoryId: activeCategory } : {}),
    ...(typeFilter ? { type: typeFilter } : {}),
  });
  const cartQuery = useCart();
  const itemCount = cartQuery.data?.itemCount ?? 0;

  const products = productsQuery.data?.data ?? [];
  const featured = !trimmed && !activeCategory && !typeFilter ? products[0] : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      {/* Header */}
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <AppText variant="title">Boutique</AppText>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <IconButton icon="receipt-outline" accessibilityLabel="Mes commandes" onPress={() => router.push("/boutique/orders")} />
            <Pressable accessibilityRole="button" accessibilityLabel="Panier" onPress={() => router.push("/boutique/cart")} style={{ position: "relative" }}>
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
                  <AppText style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>
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

      {/* Type filter */}
      <View style={{ flexDirection: "row", paddingHorizontal: spacing.lg, marginTop: spacing.md, gap: spacing.sm }}>
        {(
          [
            [null, "Tout"],
            ["PHYSICAL", "Physique"],
            ["DIGITAL", "Digital"],
          ] as Array<[null | "PHYSICAL" | "DIGITAL", string]>
        ).map(([value, label]) => (
          <Pressable
            key={label}
            accessibilityRole="button"
            onPress={() => setTypeFilter(value)}
            style={{
              paddingHorizontal: spacing.lg,
              height: 32,
              borderRadius: radii.full,
              backgroundColor: typeFilter === value ? colors.primary : colors.surface,
              borderWidth: 1,
              borderColor: typeFilter === value ? colors.primary : colors.border,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <AppText style={{ color: typeFilter === value ? colors.onPrimary : colors.textMuted, fontWeight: "600", fontSize: 12 }}>
              {label}
            </AppText>
          </Pressable>
        ))}
      </View>

      {/* Categories */}
      {categoriesQuery.data && categoriesQuery.data.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.md }} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
          <CategoryChip label="Toutes" active={activeCategory === null} onPress={() => setActiveCategory(null)} />
          {categoriesQuery.data.map((category) => (
            <CategoryChip key={category.id} label={category.name} active={activeCategory === category.id} onPress={() => setActiveCategory(category.id)} />
          ))}
        </ScrollView>
      ) : null}

      {/* Products */}
      {productsQuery.isLoading ? (
        <LoadingView label="Chargement de la boutique…" />
      ) : productsQuery.isError ? (
        <ErrorView message={(productsQuery.error as Error)?.message} onRetry={() => void productsQuery.refetch()} />
      ) : products.length === 0 ? (
        <EmptyView title="Aucun produit" subtitle="Essayez une autre recherche ou catégorie." />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }}>
          {featured ? <FeaturedCard product={featured} /> : null}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
            {products.map((product) => (
              <ProductCardTile key={product.id} product={product} />
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function CategoryChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        paddingHorizontal: spacing.lg,
        height: 34,
        borderRadius: radii.full,
        backgroundColor: active ? colors.primary : colors.surface,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <AppText style={{ color: active ? colors.onPrimary : colors.textMuted, fontWeight: "600", fontSize: 13 }}>
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
      style={{ marginBottom: spacing.lg }}
    >
      <View style={{ flexDirection: "row", backgroundColor: colors.surface, borderRadius: radii.lg, overflow: "hidden" }}>
        {image ? (
          <Image
            source={{ uri: image.startsWith("http") ? image : `${API_URL}${image}` }}
            style={{ width: 130, height: 130 }}
            contentFit="cover"
          />
        ) : (
          <View style={{ width: 130, height: 130, backgroundColor: colors.primaryTint, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="sparkles" size={30} color={colors.primary} />
          </View>
        )}
        <View style={{ flex: 1, padding: spacing.lg, gap: 4, justifyContent: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
            <Ionicons name={product.type === "DIGITAL" ? "download" : "cube-outline"} size={12} color={colors.accent} />
            <AppText variant="small" color={colors.accent}>
              {product.type === "DIGITAL" ? "PRODUIT DIGITAL" : "PRODUIT PHYSIQUE"}
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
  const outOfStock = product.type === "PHYSICAL" && product.stock != null && product.stock <= 0;

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
      <View style={{ borderRadius: radii.md, overflow: "hidden", position: "relative" }}>
        {image ? (
          <Image
            source={{ uri: image.startsWith("http") ? image : `${API_URL}${image}` }}
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
        <View
          style={{
            position: "absolute",
            top: spacing.sm,
            left: spacing.sm,
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            backgroundColor: "rgba(0,0,0,0.55)",
            borderRadius: radii.full,
            paddingHorizontal: 8,
            paddingVertical: 3,
          }}
        >
          <Ionicons name={product.type === "DIGITAL" ? "download" : "cube-outline"} size={10} color="#fff" />
          <AppText style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>
            {product.type === "DIGITAL" ? "DIGITAL" : "PHYSIQUE"}
          </AppText>
        </View>
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
            <AppText style={{ color: "#fff", fontSize: 11, fontWeight: "700", textAlign: "center" }}>Épuisé</AppText>
          </View>
        ) : null}
      </View>
      <View style={{ gap: 2 }}>
        <AppText variant="subheading" numberOfLines={2} style={{ fontSize: 14 }}>
          {product.name}
        </AppText>
        <AppText variant="small" color={colors.textFaint} numberOfLines={1}>
          {product.seller.name}
        </AppText>
        <AppText style={{ color: colors.accent, fontWeight: "700", fontSize: 14 }}>
          {formatMoney(product.price, product.currency)}
        </AppText>
      </View>
    </Pressable>
  );
}
