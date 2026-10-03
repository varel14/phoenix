import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { usePaymentCategories, usePaymentServices } from "@/hooks/use-payments";
import { AppText, EmptyView, ErrorView, IconButton, LoadingView } from "@/components/ui";
import { radii, spacing } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import { formatAmount } from "@/utils/money";

const FLOW_STEPS = ["Choisir un service", "Renseigner les informations", "Vérifier", "Payer", "Reçu"];

export default function PayHomeScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const categoriesQuery = usePaymentCategories();
  const servicesQuery = usePaymentServices(activeCategory ?? undefined);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      {/* Header */}
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <IconButton icon="chevron-back" onPress={() => router.back()} accessibilityLabel="Retour" />
          <View style={{ flex: 1, alignItems: "center", marginRight: 40 }}>
            <AppText variant="caption" style={{ letterSpacing: 2 }}>
              CHUYASSI EMMANUEL
            </AppText>
            <AppText variant="title">Payer / Échanger</AppText>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 120 }}>
        {/* Flow indicator */}
        <View style={{ backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.sm }}>
          <AppText variant="small" color={colors.textFaint} style={{ letterSpacing: 1.5 }}>
            COMMENT ÇA MARCHE
          </AppText>
          {FLOW_STEPS.map((step, index) => (
            <View key={step} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: radii.full,
                  backgroundColor: colors.primaryTint,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <AppText style={{ color: colors.primary, fontSize: 12, fontWeight: "700" }}>{index + 1}</AppText>
              </View>
              <AppText variant="body">{step}</AppText>
            </View>
          ))}
        </View>

        {/* Transactions link */}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/pay/transactions")}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
            backgroundColor: colors.surface,
            borderRadius: radii.lg,
            padding: spacing.lg,
          }}
        >
          <Ionicons name="receipt-outline" size={22} color={colors.accent} />
          <AppText variant="subheading" style={{ flex: 1 }}>
            Mes transactions
          </AppText>
          <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
        </Pressable>

        {/* Categories */}
        {categoriesQuery.isLoading ? (
          <LoadingView label="Chargement des services…" />
        ) : categoriesQuery.isError ? (
          <ErrorView message={(categoriesQuery.error as Error)?.message} onRetry={() => void categoriesQuery.refetch()} />
        ) : (
          <View style={{ gap: spacing.md }}>
            <AppText variant="heading">Catégories</AppText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
              <CategoryChip
                label="Tous"
                active={activeCategory === null}
                onPress={() => setActiveCategory(null)}
              />
              {(categoriesQuery.data ?? []).map((category) => (
                <CategoryChip
                  key={category.id}
                  label={category.name}
                  active={activeCategory === category.id}
                  onPress={() => setActiveCategory(category.id)}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Services */}
        {servicesQuery.isLoading ? (
          <LoadingView />
        ) : servicesQuery.isError ? (
          <ErrorView message={(servicesQuery.error as Error)?.message} onRetry={() => void servicesQuery.refetch()} />
        ) : (servicesQuery.data ?? []).length === 0 ? (
          <EmptyView title="Aucun service disponible" subtitle="Revenez bientôt — de nouveaux services arrivent." />
        ) : (
          <View style={{ gap: spacing.md }}>
            <AppText variant="heading">Services</AppText>
            {(servicesQuery.data ?? []).map((service) => (
              <Pressable
                key={service.id}
                accessibilityRole="button"
                onPress={() => router.push(`/pay/service/${service.id}`)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                  backgroundColor: pressed ? colors.surfaceHighlight : colors.surface,
                  borderRadius: radii.lg,
                  padding: spacing.lg,
                })}
              >
                <View
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: radii.md,
                    backgroundColor: colors.primaryTint,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name={serviceIcon(service.category.slug)} size={22} color={colors.primary} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="subheading" numberOfLines={1}>
                    {service.name}
                  </AppText>
                  {service.description ? (
                    <AppText variant="bodyMuted" numberOfLines={2}>
                      {service.description}
                    </AppText>
                  ) : null}
                  <AppText variant="small" color={colors.accent} style={{ marginTop: 2 }}>
                    {service.pricingMode === "FIXED" && service.fixedPrice != null
                      ? `${formatAmount(service.fixedPrice)} ${service.currency}`
                      : "Montant libre"}
                  </AppText>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
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
        height: 36,
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

function serviceIcon(slug: string): React.ComponentProps<typeof Ionicons>["name"] {
  switch (slug) {
    case "frais-scolaires":
      return "school-outline";
    case "factures":
      return "flash-outline";
    case "services-administratifs":
      return "document-text-outline";
    case "services-partenaires":
      return "business-outline";
    default:
      return "ellipsis-horizontal-circle-outline";
  }
}
